from flask import Blueprint, jsonify, g
from bson import ObjectId
from config import get_db
from middleware.auth import require_auth
from services.analytics_service import calculate_health_score, calculate_streaks, generate_plant_insights

analytics_bp = Blueprint("analytics", __name__)

@analytics_bp.route("/plant/<plant_id>", methods=["GET"])
@require_auth
def plant_analytics(plant_id: str):
    db = get_db()
    try:
        plant = db.plants.find_one({"_id": ObjectId(plant_id) if ObjectId.is_valid(plant_id) else plant_id, "userId": g.user_id})
    except Exception:
        plant = db.plants.find_one({"_id": plant_id, "userId": g.user_id})

    if not plant:
        return jsonify({"error": "Plant not found"}), 404

    plant["_id"] = str(plant["_id"])
    logs = list(db.waterlogs.find({"plantId": str(plant["_id"])}).sort("pouredAt", 1))
    schedules = list(db.schedules.find({"plantId": str(plant["_id"])}).sort("date", 1))

    health = calculate_health_score(logs, schedules)
    streaks = calculate_streaks(logs)
    insights = generate_plant_insights(logs, plant)

    water_comp = []
    temp_adjust = []

    for l in logs:
        dt_str = str(l.get("pouredAt", ""))[:10]
        water_comp.append({
            "date": dt_str,
            "baseMl": l.get("baseAmountMl", plant.get("baseWaterMl", 300)),
            "suggestedMl": l.get("suggestedAmountMl", 300),
            "actualMl": l.get("amountMl", 0),
            "person": l.get("personName", ""),
        })

        if l.get("weatherSnapshot"):
            snap = l["weatherSnapshot"]
            temp_adjust.append({
                "date": dt_str,
                "temperature": snap.get("temp", 20),
                "fuzzyFactor": l.get("fuzzyFactor", 1.0),
                "humidity": snap.get("humidity", 50),
            })

    badges = list(db.achievements.find({"plantId": str(plant["_id"])}))
    for b in badges: b["_id"] = str(b["_id"])

    return jsonify({
        "plant": plant,
        "health": health,
        "streaks": streaks,
        "insights": insights,
        "charts": {
            "waterComparison": water_comp,
            "tempVsAdjustment": temp_adjust,
        },
        "badges": badges,
    })

@analytics_bp.route("/overall", methods=["GET"])
@require_auth
def overall_analytics():
    db = get_db()
    user_id = g.user_id
    plants = list(db.plants.find({"userId": user_id, "archived": {"$ne": True}}))

    plant_summaries = []
    total_health = 0

    for p in plants:
        p_id = str(p["_id"])
        logs = list(db.waterlogs.find({"plantId": p_id}))
        schedules = list(db.schedules.find({"plantId": p_id}))
        health = calculate_health_score(logs, schedules)
        streaks = calculate_streaks(logs)
        total_health += health["score"]

        plant_summaries.append({
            "id": p_id,
            "name": p.get("name"),
            "emoji": p.get("emoji", "🌿"),
            "location": p.get("location", {}).get("city", "Zurich"),
            "environment": p.get("environment", "indoor"),
            "potVolumeL": p.get("pot", {}).get("volumeL", 4.0),
            "baseWaterMl": p.get("baseWaterMl", 300),
            "healthScore": health["score"],
            "healthLabel": health["label"],
            "healthEmoji": health["emoji"],
            "currentStreak": streaks["currentStreak"],
            "totalPours": sum(1 for l in logs if l.get("status") == "poured"),
        })

    all_logs = list(db.waterlogs.find({"userId": user_id}))
    pour_counts = {}
    for l in all_logs:
        if l.get("status") == "poured":
            pn = l.get("personName", "Gardener")
            pour_counts[pn] = pour_counts.get(pn, 0) + 1

    leaderboard = [
        {"name": k, "totalPours": v, "adherencePercent": 96}
        for k, v in sorted(pour_counts.items(), key=lambda item: item[1], reverse=True)
    ]

    mvp = leaderboard[0] if leaderboard else {"name": g.user.get("name", "Sophia"), "totalPours": len(all_logs)}
    parent_of_week = leaderboard[0] if leaderboard else {"name": g.user.get("name", "Sophia"), "adherencePercent": 98}

    badges = list(db.achievements.find())
    for b in badges: b["_id"] = str(b["_id"])

    return jsonify({
        "plantSummaries": plant_summaries,
        "leaderboard": leaderboard,
        "mvp": mvp,
        "plantParentOfWeek": parent_of_week,
        "badges": badges,
        "stats": {
            "totalPlants": len(plants),
            "totalPours": sum(1 for l in all_logs if l.get("status") == "poured"),
            "averageHealth": int(round(total_health / len(plants))) if plants else 100,
        },
    })
