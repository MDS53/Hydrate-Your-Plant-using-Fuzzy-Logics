from apscheduler.schedulers.background import BackgroundScheduler
from datetime import datetime, date
from bson import ObjectId
from config import get_db, Config
from .weather_service import get_weather_forecast
from fuzzy.engine import evaluate_fuzzy_watering
from .email_service import send_watering_reminder_email

scheduler = None

def run_daily_weather_re_evaluation():
    db = get_db()
    today_str = date.today().isoformat()
    print(f"[Scheduler] Running daily morning weather re-evaluation for {today_str}...")

    # Find pending schedules for today
    schedules = list(db.schedules.find({"status": {"$in": ["pending", "snoozed"]}}))
    count = 0

    for sch in schedules:
        plant_id = sch.get("plantId")
        try:
            plant = db.plants.find_one({"_id": ObjectId(plant_id) if isinstance(plant_id, str) else plant_id})
        except Exception:
            plant = db.plants.find_one({"_id": plant_id})

        if not plant or "location" not in plant:
            continue

        loc = plant["location"]
        snapshot, _ = get_weather_forecast(loc["lat"], loc["lon"])

        fuzzy_res = evaluate_fuzzy_watering(
            temp=snapshot["temp"],
            humidity=snapshot["humidity"],
            rain_mm=snapshot["rainMm"],
            environment=plant.get("environment", "indoor"),
            drought_tolerance=plant.get("careInfo", {}).get("droughtTolerance", "medium"),
            pot_material=plant.get("pot", {}).get("material", "plastic"),
            base_water_ml=sch.get("baseMl", plant.get("baseWaterMl", 300)),
        )

        db.schedules.update_one(
            {"_id": sch["_id"]},
            {
                "$set": {
                    "suggestedMl": fuzzy_res["suggestedWaterMl"],
                    "fuzzyFactor": fuzzy_res["finalFuzzyFactor"],
                    "weatherSnapshot": snapshot,
                    "fuzzyTrace": {
                        "reason": fuzzy_res["reason"],
                        "factor": fuzzy_res["finalFuzzyFactor"],
                        "rulesFired": [r["description"] for r in fuzzy_res["explanation"]["rulesTriggered"]],
                        "memberships": fuzzy_res["explanation"]["memberships"],
                        "crispInputs": fuzzy_res["explanation"]["inputs"],
                    },
                }
            }
        )
        count += 1

    print(f"[Scheduler] Re-evaluated {count} schedules with live morning weather.")
    return count

def dispatch_morning_reminders():
    db = get_db()
    print("[Scheduler] Checking pending reminders to dispatch...")
    schedules = list(db.schedules.find({"status": "pending", "lastReminderSentAt": {"$exists": False}}))
    sent = 0

    for sch in schedules:
        plant_id = sch.get("plantId")
        plant = db.plants.find_one({"_id": ObjectId(plant_id) if isinstance(plant_id, str) else plant_id})
        if not plant:
            continue

        assigned = sch.get("assignedTo", {})
        action_url = f"{Config.APP_URL}/confirm?scheduleId={str(sch['_id'])}&token={sch.get('magicToken', '')}"

        badge = {
            "temp": f"{sch.get('weatherSnapshot', {}).get('temp', 20)}°C",
            "humidity": f"{sch.get('weatherSnapshot', {}).get('humidity', 50)}%",
            "rain": f"{sch.get('weatherSnapshot', {}).get('rainMm', 0)} mm",
            "emoji": "🌿",
        }

        send_watering_reminder_email(
            recipient_email=assigned.get("email", ""),
            recipient_name=assigned.get("name", "Gardener"),
            plant_name=plant.get("name", "Plant"),
            plant_emoji=plant.get("emoji", "🌿"),
            suggested_ml=sch.get("suggestedMl", plant.get("baseWaterMl", 300)),
            base_ml=sch.get("baseMl", plant.get("baseWaterMl", 300)),
            weather_reason=sch.get("fuzzyTrace", {}).get("reason", "Morning watering schedule"),
            weather_badge=badge,
            action_url=action_url,
        )

        db.schedules.update_one(
            {"_id": sch["_id"]},
            {"$set": {"lastReminderSentAt": datetime.utcnow().isoformat() + "Z"}}
        )
        sent += 1

    return sent

def start_scheduler():
    global scheduler
    if scheduler is not None and scheduler.running:
        return
    scheduler = BackgroundScheduler(daemon=True)
    # Run morning job every day at 8:00 AM
    scheduler.add_job(run_daily_weather_re_evaluation, "cron", hour=8, minute=0)
    scheduler.start()
    print("[Scheduler] Background APScheduler running.")
