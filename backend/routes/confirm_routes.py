from flask import Blueprint, request, jsonify
from bson import ObjectId
from datetime import datetime, timedelta
from config import get_db, Config
from services.analytics_service import check_and_award_achievements
from services.email_service import send_watering_confirmation_notification

confirm_bp = Blueprint("confirm", __name__)

@confirm_bp.route("/schedule/<schedule_id>", methods=["GET"])
def get_schedule_details(schedule_id: str):
    db = get_db()
    try:
        sch = db.schedules.find_one({"_id": ObjectId(schedule_id) if ObjectId.is_valid(schedule_id) else schedule_id})
    except Exception:
        sch = db.schedules.find_one({"_id": schedule_id})

    if not sch:
        return jsonify({"error": "Schedule not found"}), 404

    plant_id = sch.get("plantId")
    try:
        plant = db.plants.find_one({"_id": ObjectId(plant_id) if ObjectId.is_valid(plant_id) else plant_id})
    except Exception:
        plant = db.plants.find_one({"_id": plant_id})

    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    sch["_id"] = str(sch["_id"])
    plant["_id"] = str(plant["_id"])

    snoozes = list(db.snoozes.find({"scheduleId": schedule_id}))
    existing_log = db.waterlogs.find_one({"scheduleId": schedule_id})
    if existing_log:
        existing_log["_id"] = str(existing_log["_id"])

    return jsonify({
        "schedule": sch,
        "plant": plant,
        "existingLog": existing_log,
        "snoozeCount": len(snoozes),
        "isCompleted": sch.get("status") == "completed",
    })

@confirm_bp.route("/submit", methods=["POST"])
def submit_confirmation():
    data = request.get_json() or {}
    schedule_id = data.get("scheduleId")
    choice = data.get("choice", "yes")
    person_name = (data.get("personName") or "Plant Parent").strip()
    amount_poured = data.get("amountPouredMl", 0)
    reason = data.get("reason", "")
    snooze_minutes = data.get("snoozeMinutes", 30)

    db = get_db()
    try:
        sch = db.schedules.find_one({"_id": ObjectId(schedule_id) if ObjectId.is_valid(schedule_id) else schedule_id})
    except Exception:
        sch = db.schedules.find_one({"_id": schedule_id})

    if not sch:
        return jsonify({"error": "Schedule not found"}), 404

    plant_id = str(sch.get("plantId"))
    plant = db.plants.find_one({"_id": ObjectId(plant_id) if ObjectId.is_valid(plant_id) else plant_id})

    now_iso = datetime.utcnow().isoformat() + "Z"

    if choice == "yes":
        actual_amount = amount_poured or sch.get("suggestedMl", 300)
        log_doc = {
            "plantId": plant_id,
            "userId": str(plant.get("userId")) if plant else "",
            "scheduleId": schedule_id,
            "personName": person_name,
            "status": "poured",
            "amountMl": actual_amount,
            "baseAmountMl": sch.get("baseMl", 300),
            "suggestedAmountMl": sch.get("suggestedMl", 300),
            "pouredAt": now_iso,
            "notes": reason,
            "weatherSnapshot": sch.get("weatherSnapshot"),
            "fuzzyFactor": sch.get("fuzzyFactor", 1.0),
        }
        db.waterlogs.insert_one(log_doc)
        log_doc["_id"] = str(log_doc["_id"])

        db.schedules.update_one({"_id": sch["_id"]}, {"$set": {"status": "completed"}})

        # Badges
        badges = check_and_award_achievements(db, plant_id, log_doc["userId"], person_name, log_doc)

        # Notify
        recipients = [{"email": sch.get("assignedTo", {}).get("email", ""), "name": person_name}]
        send_watering_confirmation_notification(
            recipients=recipients,
            poured_by=person_name,
            plant_name=plant.get("name", "Plant") if plant else "Plant",
            plant_emoji=plant.get("emoji", "🌿") if plant else "🌿",
            amount_ml=actual_amount,
            status="poured",
            poured_at=now_iso,
        )

        return jsonify({
            "message": "Watering logged successfully! Great job!",
            "status": "completed",
            "log": log_doc,
            "badgesAwarded": badges,
        })

    elif choice == "no":
        log_doc = {
            "plantId": plant_id,
            "userId": str(plant.get("userId")) if plant else "",
            "scheduleId": schedule_id,
            "personName": person_name,
            "status": "missed",
            "amountMl": 0,
            "baseAmountMl": sch.get("baseMl", 300),
            "suggestedAmountMl": sch.get("suggestedMl", 300),
            "pouredAt": now_iso,
            "notes": reason or "Reported not watered",
            "weatherSnapshot": sch.get("weatherSnapshot"),
        }
        db.waterlogs.insert_one(log_doc)
        db.schedules.update_one({"_id": sch["_id"]}, {"$set": {"status": "missed"}})
        return jsonify({"message": "Marked as missed. Team alerted.", "status": "missed"})

    elif choice == "snooze":
        db.schedules.update_one({"_id": sch["_id"]}, {"$set": {"status": "snoozed"}})
        db.snoozes.insert_one({
            "scheduleId": schedule_id,
            "personName": person_name,
            "snoozeUntil": (datetime.utcnow() + timedelta(minutes=snooze_minutes)).isoformat() + "Z",
            "minutes": snooze_minutes,
        })
        return jsonify({"message": f"Snoozed for {snooze_minutes} minutes.", "status": "snoozed"})
