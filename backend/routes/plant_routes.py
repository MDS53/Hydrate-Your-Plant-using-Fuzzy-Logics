from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from datetime import datetime, timedelta, date, timezone
import secrets
from config import get_db, Config
from middleware.auth import require_auth
from services.ai_service import generate_plant_care_info, calculate_base_water_ml
from services.weather_service import get_weather_forecast
from fuzzy.engine import evaluate_fuzzy_watering
from services.analytics_service import calculate_health_score
from services.email_service import (
    send_schedule_notification_email,
    send_watering_task_completion_email,
    send_watering_confirmation_notification
)

plant_bp = Blueprint("plants", __name__)

@plant_bp.route("/ai-preview", methods=["POST"])
@require_auth
def ai_preview():
    data = request.get_json() or {}
    name = data.get("name", "").strip()
    if not name:
        return jsonify({"error": "Plant name is required"}), 400
    care_info = generate_plant_care_info(name)
    return jsonify({"careInfo": care_info})

@plant_bp.route("", methods=["GET"])
@require_auth
def list_plants():
    db = get_db()
    user_id = g.user_id
    plants = list(db.plants.find({"userId": user_id, "archived": {"$ne": True}}))

    today_str = date.today().isoformat()
    summaries = []

    for plant in plants:
        p_id = str(plant["_id"])

        # Check if plant was watered today
        today_start = datetime.utcnow().strftime("%Y-%m-%dT00:00:00Z")
        watered_today_log = db.waterlogs.find_one(
            {"plantId": p_id, "pouredAt": {"$gte": today_start}},
            sort=[("pouredAt", -1)]
        )
        is_watered_today = bool(watered_today_log)

        # Next pending/snoozed schedule
        next_sch = db.schedules.find_one(
            {"plantId": p_id, "status": {"$in": ["pending", "snoozed"]}},
            sort=[("date", 1)]
        )

        can_water_now = False
        next_watering_date_str = None

        if next_sch:
            next_watering_date_str = next_sch.get("date")
            if not is_watered_today:
                try:
                    sch_dt = datetime.fromisoformat(next_watering_date_str.replace("Z", "+00:00"))
                    now_dt = datetime.now(timezone.utc)
                    # Water Now is STRICTLY enabled only when scheduled time occurred exactly (sch_dt <= now_dt)
                    can_water_now = (sch_dt <= now_dt)
                except Exception:
                    can_water_now = False
        else:
            can_water_now = False

        if is_watered_today:
            can_water_now = False
            # Find next upcoming schedule strictly in the future (after today)
            tomorrow_start = (datetime.utcnow() + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
            next_future_sch = db.schedules.find_one(
                {"plantId": p_id, "status": {"$in": ["pending", "snoozed"]}, "date": {"$gte": tomorrow_start}},
                sort=[("date", 1)]
            )
            if next_future_sch:
                next_watering_date_str = next_future_sch.get("date")
            else:
                # Compute next upcoming recurrence from pourDaysOfWeek
                pour_days = plant.get("pourDaysOfWeek", [1])
                now_utc = datetime.utcnow()
                w_time = plant.get("wateringTime", "08:00")
                try:
                    h, m = int(w_time.split(":")[0]), int(w_time.split(":")[1])
                except Exception:
                    h, m = 8, 0
                for d in range(1, 15):
                    cand_dt = now_utc + timedelta(days=d)
                    cand_day_idx = (cand_dt.weekday() + 1) % 7
                    if cand_day_idx in pour_days:
                        cand_dt = cand_dt.replace(hour=h, minute=m, second=0, microsecond=0)
                        next_watering_date_str = cand_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                        db.schedules.insert_one({
                            "plantId": p_id,
                            "userId": plant.get("userId", g.user_id),
                            "date": next_watering_date_str,
                            "assignedTo": {"role": "owner", "name": g.user.get("name", "Owner"), "email": g.user.get("email", "")},
                            "baseMl": plant.get("baseWaterMl", 300),
                            "suggestedMl": plant.get("baseWaterMl", 300),
                            "fuzzyFactor": 1.0,
                            "status": "pending",
                            "createdAt": datetime.utcnow().isoformat() + "Z",
                        })
                        break
        elif not next_watering_date_str:
            # If no schedule exists at all, generate one for the nearest scheduled day
            pour_days = plant.get("pourDaysOfWeek", [1])
            now_utc = datetime.utcnow()
            w_time = plant.get("wateringTime", "08:00")
            try:
                h, m = int(w_time.split(":")[0]), int(w_time.split(":")[1])
            except Exception:
                h, m = 8, 0
            for d in range(0, 15):
                cand_dt = now_utc + timedelta(days=d)
                cand_day_idx = (cand_dt.weekday() + 1) % 7
                if cand_day_idx in pour_days:
                    cand_dt = cand_dt.replace(hour=h, minute=m, second=0, microsecond=0)
                    next_watering_date_str = cand_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                    try:
                        sch_dt = cand_dt.replace(tzinfo=timezone.utc)
                        now_dt = datetime.now(timezone.utc)
                        can_water_now = (sch_dt <= now_dt) and not is_watered_today
                    except Exception:
                        can_water_now = False
                    db.schedules.insert_one({
                        "plantId": p_id,
                        "userId": plant.get("userId", g.user_id),
                        "date": next_watering_date_str,
                        "assignedTo": {"role": "owner", "name": g.user.get("name", "Owner"), "email": g.user.get("email", "")},
                        "baseMl": plant.get("baseWaterMl", 300),
                        "suggestedMl": plant.get("baseWaterMl", 300),
                        "fuzzyFactor": 1.0,
                        "status": "pending",
                        "createdAt": datetime.utcnow().isoformat() + "Z",
                    })
                    break

        logs = list(db.waterlogs.find({"plantId": p_id}).sort("pouredAt", -1).limit(10))
        schedules = list(db.schedules.find({"plantId": p_id}).sort("date", -1).limit(10))
        health = calculate_health_score(logs, schedules)

        today_sugg = {
            "suggestedMl": plant.get("baseWaterMl", 300),
            "baseMl": plant.get("baseWaterMl", 300),
            "reason": "Standard botanical hydration baseline",
            "fuzzyFactor": 1.0,
            "badge": {"temp": "20.0°C", "humidity": "50%", "rain": "0.0 mm", "emoji": "🌿"},
            "shouldSkipOrMinimal": False,
        }

        snap_data = None
        if next_sch and next_sch.get("weatherSnapshot"):
            snap = next_sch["weatherSnapshot"]
            snap_data = snap
            today_sugg = {
                "suggestedMl": next_sch.get("suggestedMl", plant.get("baseWaterMl", 300)),
                "baseMl": next_sch.get("baseMl", plant.get("baseWaterMl", 300)),
                "reason": next_sch.get("fuzzyTrace", {}).get("reason", "Weather evaluated"),
                "fuzzyFactor": next_sch.get("fuzzyFactor", 1.0),
                "badge": {
                    "temp": f"{snap.get('temp', 20)}°C",
                    "humidity": f"{snap.get('humidity', 50)}%",
                    "rain": f"{snap.get('rainMm', 0)} mm",
                    "emoji": "❄️" if next_sch.get("fuzzyFactor", 1.0) < 0.6 else "☀️" if next_sch.get("fuzzyFactor", 1.0) > 1.15 else "🌿",
                },
                "shouldSkipOrMinimal": next_sch.get("fuzzyFactor", 1.0) < 0.40,
            }
        elif plant.get("location"):
            try:
                snap, _ = get_weather_forecast(plant["location"]["lat"], plant["location"]["lon"])
                snap_data = snap
                fuzzy = evaluate_fuzzy_watering(
                    temp=snap["temp"],
                    humidity=snap["humidity"],
                    rain_mm=snap["rainMm"],
                    environment=plant.get("environment", "indoor"),
                    drought_tolerance=plant.get("careInfo", {}).get("droughtTolerance", "medium"),
                    pot_material=plant.get("pot", {}).get("material", "plastic"),
                    base_water_ml=plant.get("baseWaterMl", 300),
                )
                today_sugg = {
                    "suggestedMl": fuzzy["suggestedWaterMl"],
                    "baseMl": fuzzy["baseWaterMl"],
                    "reason": fuzzy["reason"],
                    "fuzzyFactor": fuzzy["finalFuzzyFactor"],
                    "badge": fuzzy["badge"],
                    "shouldSkipOrMinimal": fuzzy["shouldSkipOrMinimal"],
                    "verbalSuggestion": fuzzy.get("verbalSuggestion"),
                    "crispBracketText": fuzzy.get("crispBracketText"),
                    "crispDeltaMl": fuzzy.get("crispDeltaMl"),
                }
            except Exception:
                pass

        base_ml = today_sugg["baseMl"]
        sugg_ml = today_sugg["suggestedMl"]
        diff_ml = sugg_ml - base_ml
        if diff_ml < -75:
            verbal_sugg = "Drastically reduce water (minimal pour)"
        elif diff_ml < -25:
            verbal_sugg = "Reduce it moderately"
        elif diff_ml < -5:
            verbal_sugg = "Reduce it slightly"
        elif diff_ml <= 5:
            verbal_sugg = "Maintain standard hydration"
        elif diff_ml <= 25:
            verbal_sugg = "Increase it slightly"
        elif diff_ml <= 75:
            verbal_sugg = "Increase it moderately"
        else:
            verbal_sugg = "Substantially increase water"

        if diff_ml < 0:
            crisp_text = f"[Reduce by {abs(diff_ml)} ml, Crisp target: {sugg_ml} ml]"
        elif diff_ml > 0:
            crisp_text = f"[Increase by {diff_ml} ml, Crisp target: {sugg_ml} ml]"
        else:
            crisp_text = f"[Standard pour, Crisp target: {sugg_ml} ml]"

        today_sugg["verbalSuggestion"] = today_sugg.get("verbalSuggestion") or verbal_sugg
        today_sugg["crispBracketText"] = today_sugg.get("crispBracketText") or crisp_text
        today_sugg["crispDeltaMl"] = diff_ml
        today_sugg["weatherSnapshot"] = snap_data or {"temp": 18.0, "humidity": 60, "rainMm": 0.0, "description": "Mild"}

        summaries.append({
            "id": p_id,
            "name": plant.get("name"),
            "emoji": plant.get("emoji", "🌿"),
            "pot": plant.get("pot", {}),
            "location": plant.get("location", {}),
            "environment": plant.get("environment", "indoor"),
            "baseWaterMl": plant.get("baseWaterMl", 300),
            "nextWateringDate": next_watering_date_str,
            "isWateredToday": is_watered_today,
            "canWaterNow": can_water_now,
            "lastWateredAt": watered_today_log.get("pouredAt") if watered_today_log else (logs[0].get("pouredAt") if logs else None),
            "todaySuggestion": today_sugg,
            "health": health,
            "pourDaysOfWeek": plant.get("pourDaysOfWeek", [1]),
            "wateringTime": plant.get("wateringTime", "08:00"),
        })

    return jsonify({"plants": summaries})

@plant_bp.route("", methods=["POST"])
@require_auth
def create_plant():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "Plant name is required"}), 400

    db = get_db()
    user_id = g.user_id

    pot = data.get("pot", {"volumeL": 4.0, "material": "plastic", "drainage": True})
    care_info = data.get("careInfo", generate_plant_care_info(name))

    base_water_ml = calculate_base_water_ml(
        care_info.get("waterMlPerPotLitre", 80),
        pot.get("volumeL", 4.0),
        pot.get("material", "plastic"),
        pot.get("drainage", True)
    )

    watering_time = data.get("wateringTime", "08:00")
    try:
        t_parts = watering_time.split(":")
        w_hour, w_minute = int(t_parts[0]), int(t_parts[1])
    except Exception:
        w_hour, w_minute = 8, 0

    plant_doc = {
        "userId": user_id,
        "name": name,
        "emoji": data.get("emoji", "🌿"),
        "location": data.get("location", {"city": "Zurich", "lat": 47.3769, "lon": 8.5417}),
        "environment": data.get("environment", "indoor"),
        "pot": pot,
        "careInfo": care_info,
        "baseWaterMl": base_water_ml,
        "pourDaysOfWeek": data.get("pourDaysOfWeek", [1]),
        "wateringTime": watering_time,
        "createdAt": datetime.utcnow().isoformat() + "Z",
    }
    res = db.plants.insert_one(plant_doc)
    plant_id = str(res.inserted_id)
    plant_doc["_id"] = plant_id

    # Caretakers
    caretakers = data.get("caretakers", [])
    created_caretakers = []
    for ct in caretakers:
        ct_doc = {
            "plantId": plant_id,
            "name": ct.get("name", "").strip(),
            "email": ct.get("email", "").lower().strip(),
            "invitedBy": user_id,
            "magicTokenHash": secrets.token_hex(16),
            "tokenExpiresAt": (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z",
        }
        db.caretakers.insert_one(ct_doc)
        ct_doc["_id"] = str(ct_doc["_id"])
        created_caretakers.append(ct_doc)

    # Initial Schedule generation for 2 weeks
    now = datetime.utcnow()
    assigned_dates = []
    ct_index = 0

    snap = None
    try:
        snap, _ = get_weather_forecast(plant_doc["location"]["lat"], plant_doc["location"]["lon"])
    except Exception:
        pass

    for i in range(14):
        target_dt = now + timedelta(days=i)
        target_dt = target_dt.replace(hour=w_hour, minute=w_minute, second=0, microsecond=0)
        target_day_idx = (target_dt.weekday() + 1) % 7  # Python: Monday=0, Sun=6 -> Sunday=0

        if target_day_idx in plant_doc["pourDaysOfWeek"]:
            # Rotate owner & caretakers
            if not created_caretakers or ct_index % (len(created_caretakers) + 1) == 0:
                assigned_to = {"role": "owner", "name": g.user.get("name", "Owner"), "email": g.user.get("email", "")}
            else:
                ct_obj = created_caretakers[(ct_index - 1) % len(created_caretakers)]
                assigned_to = {"role": "caretaker", "name": ct_obj["name"], "email": ct_obj["email"]}
            ct_index += 1

            fuzzy_factor = 1.0
            suggested_ml = base_water_ml
            fuzzy_trace = None

            if snap:
                f_res = evaluate_fuzzy_watering(
                    temp=snap["temp"],
                    humidity=snap["humidity"],
                    rain_mm=snap["rainMm"],
                    environment=plant_doc["environment"],
                    drought_tolerance=care_info.get("droughtTolerance", "medium"),
                    pot_material=pot.get("material", "plastic"),
                    base_water_ml=base_water_ml
                )
                fuzzy_factor = f_res["finalFuzzyFactor"]
                suggested_ml = f_res["suggestedWaterMl"]
                fuzzy_trace = {
                    "reason": f_res["reason"],
                    "factor": fuzzy_factor,
                    "rulesFired": [r["description"] for r in f_res["explanation"]["rulesTriggered"]],
                    "memberships": f_res["explanation"]["memberships"],
                    "crispInputs": f_res["explanation"]["inputs"],
                }

            magic_token = secrets.token_hex(16)
            sch_doc = {
                "plantId": plant_id,
                "userId": user_id,
                "date": target_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "assignedTo": assigned_to,
                "baseMl": base_water_ml,
                "suggestedMl": suggested_ml,
                "fuzzyFactor": fuzzy_factor,
                "fuzzyTrace": fuzzy_trace,
                "weatherSnapshot": snap,
                "magicToken": magic_token,
                "status": "pending",
                "createdAt": datetime.utcnow().isoformat() + "Z",
            }
            db.schedules.insert_one(sch_doc)
            assigned_dates.append(target_dt.strftime("%a, %b %d at %I:%M %p"))

    # Send Schedule Email
    send_schedule_notification_email(
        recipient_email=g.user.get("email", ""),
        recipient_name=g.user.get("name", "Gardener"),
        plant_name=plant_doc["name"],
        plant_emoji=plant_doc["emoji"],
        assigned_dates=assigned_dates,
        base_amount_ml=base_water_ml,
        app_url=Config.APP_URL
    )

    return jsonify({"message": "Plant created successfully", "plant": plant_doc}), 201

@plant_bp.route("/<plant_id>", methods=["GET"])
@require_auth
def get_plant_detail(plant_id: str):
    db = get_db()
    query = {"$or": [
        {"_id": ObjectId(plant_id)} if ObjectId.is_valid(plant_id) else {"_id": plant_id},
        {"_id": plant_id}
    ]}
    plant = db.plants.find_one(query)

    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    plant["_id"] = str(plant["_id"])
    p_id = plant["_id"]

    caretakers = list(db.caretakers.find({"plantId": p_id}))
    for c in caretakers: c["_id"] = str(c["_id"])

    # Upcoming schedules (pending or snoozed ONLY)
    upcoming_schedules = list(
        db.schedules.find({
            "plantId": p_id,
            "status": {"$in": ["pending", "snoozed"]}
        }).sort("date", 1).limit(14)
    )

    # If no upcoming schedule exists, auto-generate the next one
    if not upcoming_schedules:
        pour_days = plant.get("pourDaysOfWeek", [1])
        now_utc = datetime.utcnow()
        w_time = plant.get("wateringTime", "08:00")
        try:
            h, m = int(w_time.split(":")[0]), int(w_time.split(":")[1])
        except Exception:
            h, m = 8, 0
        for d in range(1, 15):
            cand_dt = now_utc + timedelta(days=d)
            cand_day_idx = (cand_dt.weekday() + 1) % 7
            if cand_day_idx in pour_days:
                cand_dt = cand_dt.replace(hour=h, minute=m, second=0, microsecond=0)
                gen_date_str = cand_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                new_sch = {
                    "plantId": p_id,
                    "userId": plant.get("userId", g.user_id),
                    "date": gen_date_str,
                    "assignedTo": {"role": "owner", "name": g.user.get("name", "Owner"), "email": g.user.get("email", "")},
                    "baseMl": plant.get("baseWaterMl", 300),
                    "suggestedMl": plant.get("baseWaterMl", 300),
                    "fuzzyFactor": 1.0,
                    "status": "pending",
                    "createdAt": datetime.utcnow().isoformat() + "Z",
                }
                res = db.schedules.insert_one(new_sch)
                new_sch["_id"] = str(res.inserted_id)
                upcoming_schedules.append(new_sch)
                break

    for s in upcoming_schedules: s["_id"] = str(s["_id"])

    # Completed schedules (status == 'completed' ONLY)
    completed_schedules = list(
        db.schedules.find({
            "plantId": p_id,
            "status": "completed"
        }).sort([("completedAt", -1), ("date", -1)]).limit(20)
    )
    for s in completed_schedules: s["_id"] = str(s["_id"])

    logs = list(db.waterlogs.find({"plantId": p_id}).sort("pouredAt", -1).limit(10))
    for l in logs: l["_id"] = str(l["_id"])

    today_start = datetime.utcnow().strftime("%Y-%m-%dT00:00:00Z")
    watered_today_log = db.waterlogs.find_one(
        {"plantId": p_id, "pouredAt": {"$gte": today_start}},
        sort=[("pouredAt", -1)]
    )
    is_watered_today = bool(watered_today_log)

    can_water_now = False
    if upcoming_schedules and not is_watered_today:
        try:
            sch_dt = datetime.fromisoformat(upcoming_schedules[0]["date"].replace("Z", "+00:00"))
            now_dt = datetime.now(timezone.utc)
            can_water_now = (sch_dt <= now_dt)
        except Exception:
            can_water_now = False

    health = calculate_health_score(logs, upcoming_schedules + completed_schedules)

    return jsonify({
        "plant": plant,
        "caretakers": caretakers,
        "upcomingSchedules": upcoming_schedules,
        "completedSchedules": completed_schedules,
        "recentLogs": logs,
        "health": health,
        "isWateredToday": is_watered_today,
        "canWaterNow": can_water_now,
    })

@plant_bp.route("/<plant_id>", methods=["DELETE"])
@require_auth
def delete_plant(plant_id: str):
    db = get_db()
    query = {"$or": [
        {"_id": ObjectId(plant_id)} if ObjectId.is_valid(plant_id) else {"_id": plant_id},
        {"_id": plant_id}
    ]}
    plant = db.plants.find_one(query)
    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    p_id_str = str(plant["_id"])
    plant_name = plant.get("name", "Plant")

    # Delete plant document permanently
    db.plants.delete_one({"_id": plant["_id"]})
    # Cascade delete all related schedules, logs, caretakers, achievements
    db.schedules.delete_many({"plantId": p_id_str})
    db.waterlogs.delete_many({"plantId": p_id_str})
    db.caretakers.delete_many({"plantId": p_id_str})
    db.achievements.delete_many({"plantId": p_id_str})

    print(f"[Plant] 🗑 Deleted plant '{plant_name}' ({p_id_str}) and all associated records.")
    return jsonify({
        "message": f"Plant '{plant_name}' and all associated records deleted successfully.",
        "deletedId": p_id_str
    }), 200

@plant_bp.route("/<plant_id>/water-now", methods=["POST"])
@require_auth
def water_plant_now(plant_id: str):
    db = get_db()
    data = request.get_json() or {}

    query = {"$or": [
        {"_id": ObjectId(plant_id)} if ObjectId.is_valid(plant_id) else {"_id": plant_id},
        {"_id": plant_id}
    ]}
    plant = db.plants.find_one(query)

    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    p_id = str(plant["_id"])
    person_name = (data.get("personName") or g.user.get("name") or "Sophia Botanica").strip()
    amount_ml = data.get("amountMl")
    if amount_ml is None:
        amount_ml = plant.get("baseWaterMl", 300)
    else:
        try:
            amount_ml = int(amount_ml)
        except Exception:
            amount_ml = plant.get("baseWaterMl", 300)

    notes = data.get("notes") or "Instant pour logged from dashboard modal"

    # Fetch current weather snapshot
    snap = None
    if plant.get("location"):
        try:
            snap, _ = get_weather_forecast(plant["location"]["lat"], plant["location"]["lon"])
        except Exception:
            pass

    now_iso = datetime.utcnow().isoformat() + "Z"

    # Insert water log
    log_doc = {
        "plantId": p_id,
        "userId": g.user_id,
        "amountMl": amount_ml,
        "baseAmountMl": plant.get("baseWaterMl", 300),
        "personName": person_name,
        "pouredBy": person_name,
        "status": "poured",
        "pouredAt": now_iso,
        "notes": notes,
        "weatherSnapshot": snap,
    }
    res = db.waterlogs.insert_one(log_doc)
    log_doc["_id"] = str(res.inserted_id)

    # Mark pending schedule as completed if one exists
    pending_sch = db.schedules.find_one(
        {"plantId": p_id, "status": {"$in": ["pending", "snoozed"]}},
        sort=[("date", 1)]
    )
    if pending_sch:
        db.schedules.update_one(
            {"_id": pending_sch["_id"]},
            {"$set": {
                "status": "completed",
                "completedAt": now_iso,
                "completedBy": person_name,
                "actualMl": amount_ml
            }}
        )
    else:
        # Create a completed schedule document so it appears in completed schedules
        db.schedules.insert_one({
            "plantId": p_id,
            "userId": g.user_id,
            "date": now_iso,
            "assignedTo": {"role": "owner", "name": person_name, "email": g.user.get("email", "")},
            "baseMl": plant.get("baseWaterMl", 300),
            "suggestedMl": amount_ml,
            "actualMl": amount_ml,
            "status": "completed",
            "completedAt": now_iso,
            "completedBy": person_name,
            "weatherSnapshot": snap,
            "createdAt": now_iso,
        })

    # Ensure a next upcoming pending schedule exists
    remaining_pending = db.schedules.find_one(
        {"plantId": p_id, "status": {"$in": ["pending", "snoozed"]}},
        sort=[("date", 1)]
    )
    next_schedule_date_str = None
    if remaining_pending:
        next_schedule_date_str = remaining_pending.get("date")
    else:
        # Generate next recurrence
        pour_days = plant.get("pourDaysOfWeek", [1])
        now_utc = datetime.utcnow()
        w_time = plant.get("wateringTime", "08:00")
        try:
            h, m = int(w_time.split(":")[0]), int(w_time.split(":")[1])
        except Exception:
            h, m = 8, 0
        for d in range(1, 15):
            cand_dt = now_utc + timedelta(days=d)
            cand_day_idx = (cand_dt.weekday() + 1) % 7
            if cand_day_idx in pour_days:
                cand_dt = cand_dt.replace(hour=h, minute=m, second=0, microsecond=0)
                next_schedule_date_str = cand_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                db.schedules.insert_one({
                    "plantId": p_id,
                    "userId": plant.get("userId", g.user_id),
                    "date": next_schedule_date_str,
                    "assignedTo": {"role": "owner", "name": g.user.get("name", "Owner"), "email": g.user.get("email", "")},
                    "baseMl": plant.get("baseWaterMl", 300),
                    "suggestedMl": plant.get("baseWaterMl", 300),
                    "fuzzyFactor": 1.0,
                    "status": "pending",
                    "createdAt": datetime.utcnow().isoformat() + "Z",
                })
                break

    # Format human-friendly next schedule date
    formatted_next_date = "Upcoming schedule"
    if next_schedule_date_str:
        try:
            ndt = datetime.fromisoformat(next_schedule_date_str.replace("Z", "+00:00"))
            formatted_next_date = ndt.strftime("%a, %b %d at %I:%M %p")
        except Exception:
            formatted_next_date = next_schedule_date_str

    # SEND COMPLETION EMAIL
    send_watering_task_completion_email(
        recipient_email=g.user.get("email", "owner@plantcare.local"),
        recipient_name=g.user.get("name", "Plant Caretaker"),
        plant_name=plant.get("name", "Plant"),
        plant_emoji=plant.get("emoji", "🌿"),
        amount_ml=amount_ml,
        base_ml=plant.get("baseWaterMl", 300),
        poured_by=person_name,
        next_schedule_date=formatted_next_date,
        notes=notes
    )

    # Also notify caretakers if any exist
    caretakers = list(db.caretakers.find({"plantId": p_id}))
    if caretakers:
        send_watering_confirmation_notification(
            recipients=[{"name": c.get("name"), "email": c.get("email")} for c in caretakers],
            poured_by=person_name,
            plant_name=plant.get("name"),
            plant_emoji=plant.get("emoji", "🌿"),
            amount_ml=amount_ml,
            status="completed",
            poured_at=datetime.utcnow().strftime("%a, %b %d at %I:%M %p UTC")
        )

    return jsonify({
        "message": f"Successfully recorded pour by {person_name} for {plant.get('name')} ({amount_ml} ml)! Task completed & summary email sent.",
        "log": log_doc,
        "plantName": plant.get("name"),
        "isWateredToday": True,
        "nextScheduleDate": next_schedule_date_str,
        "emailSent": True,
        "emailRecipient": g.user.get("email"),
    }), 200

@plant_bp.route("/<plant_id>/send-schedule", methods=["POST"])
@require_auth
def send_plant_schedule(plant_id: str):
    db = get_db()
    try:
        plant = db.plants.find_one({"_id": ObjectId(plant_id)})
    except Exception:
        plant = db.plants.find_one({"_id": plant_id})

    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    caretakers = list(db.caretakers.find({"plantId": str(plant["_id"])}))
    schedules = list(
        db.schedules.find({
            "plantId": str(plant["_id"]),
            "status": {"$in": ["pending", "snoozed"]}
        }).sort("date", 1).limit(14)
    )

    app_url = Config.APP_URL
    assigned_dates = []
    for s in schedules:
        d_str = s.get("date", "")
        try:
            dt = datetime.fromisoformat(d_str.replace("Z", "+00:00"))
            assigned_dates.append(dt.strftime("%a, %b %d at %I:%M %p"))
        except Exception:
            assigned_dates.append(d_str)

    if not assigned_dates:
        assigned_dates = ["Morning watering as scheduled"]

    recipients_map = {}
    if g.user.get("email"):
        recipients_map[g.user["email"].lower()] = g.user.get("name", "Plant Owner")
    for ct in caretakers:
        if ct.get("email"):
            recipients_map[ct["email"].lower()] = ct.get("name", "Caretaker")

    sent_count = 0
    preview_url = None
    for email, name in recipients_map.items():
        try:
            res = send_schedule_notification_email(
                recipient_email=email,
                recipient_name=name,
                plant_name=plant.get("name", "Plant"),
                plant_emoji=plant.get("emoji", "🌿"),
                assigned_dates=assigned_dates,
                base_amount_ml=plant.get("baseWaterMl", 300),
                app_url=app_url
            )
            if isinstance(res, dict) and res.get("previewUrl"):
                preview_url = res["previewUrl"]
            sent_count += 1
        except Exception as e:
            print(f"[Email] Failed sending to {email}: {e}")

    return jsonify({
        "message": f"Successfully emailed watering schedule to {sent_count} recipient(s)!",
        "recipients": list(recipients_map.keys()),
        "sentCount": sent_count,
        "previewUrl": preview_url
    }), 200

