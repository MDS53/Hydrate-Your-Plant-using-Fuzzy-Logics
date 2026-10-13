from flask import Blueprint, request, jsonify, g
from bson import ObjectId
from config import get_db
from middleware.auth import require_auth
from services.scheduler_service import run_daily_weather_re_evaluation, dispatch_morning_reminders

schedule_bp = Blueprint("schedules", __name__)

@schedule_bp.route("/plant/<plant_id>", methods=["GET"])
@require_auth
def get_plant_schedules(plant_id: str):
    db = get_db()
    schedules = list(db.schedules.find({"plantId": plant_id}).sort("date", 1))
    for s in schedules:
        s["_id"] = str(s["_id"])
    return jsonify({"schedules": schedules})

@schedule_bp.route("/trigger-eval", methods=["POST"])
@require_auth
def trigger_eval():
    count = run_daily_weather_re_evaluation()
    return jsonify({"message": "Morning weather re-evaluation complete", "evaluatedCount": count})

@schedule_bp.route("/trigger-reminders", methods=["POST"])
@require_auth
def trigger_reminders():
    count = dispatch_morning_reminders()
    return jsonify({"message": "Morning reminders dispatched", "sentCount": count})
