from typing import List, Dict, Any
from datetime import datetime

def calculate_health_score(logs: List[Dict[str, Any]], schedules: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not logs and not schedules:
        return {
            "score": 100,
            "label": "Thriving",
            "emoji": "🌿",
            "color": "#10b981",
            "breakdown": {"consistencyPoints": 40, "punctualityPoints": 30, "adherencePoints": 30},
        }

    total_completed = sum(1 for l in logs if l.get("status") == "poured")
    total_missed = sum(1 for s in schedules if s.get("status") == "missed") + sum(1 for l in logs if l.get("status") == "missed")
    total_events = total_completed + total_missed

    consistency_rate = (total_completed / total_events) if total_events > 0 else 1.0
    consistency_pts = int(round(consistency_rate * 40))

    punctuality_pts = max(0, 30 - total_missed * 8)

    # Fuzzy adherence
    total_adherence = 0.0
    poured_count = 0
    for l in logs:
        if l.get("status") == "poured" and l.get("suggestedAmountMl", 0) > 0:
            diff = abs(l.get("amountMl", 0) - l["suggestedAmountMl"])
            ratio = max(0.0, 1.0 - diff / l["suggestedAmountMl"])
            total_adherence += ratio
            poured_count += 1

    avg_adherence = (total_adherence / poured_count) if poured_count > 0 else 0.95
    adherence_pts = int(round(avg_adherence * 30))

    score = max(10, min(100, consistency_pts + punctuality_pts + adherence_pts))

    if score >= 85:
        label, emoji, color = "Thriving", "🌿", "#10b981"
    elif score >= 70:
        label, emoji, color = "OK", "🪴", "#3b82f6"
    elif score >= 45:
        label, emoji, color = "Thirsty", "🥀", "#f59e0b"
    else:
        label, emoji, color = "Critical", "🚨", "#ef4444"

    return {
        "score": score,
        "label": label,
        "emoji": emoji,
        "color": color,
        "breakdown": {
            "consistencyPoints": consistency_pts,
            "punctualityPoints": punctuality_pts,
            "adherencePoints": adherence_pts,
        },
    }

def calculate_streaks(logs: List[Dict[str, Any]]) -> Dict[str, int]:
    poured_logs = [l for l in logs if l.get("status") == "poured"]
    if not poured_logs:
        return {"currentStreak": 0, "bestStreak": 0}

    # Sorted by pouredAt
    poured_logs.sort(key=lambda x: str(x.get("pouredAt", "")))
    best_streak = len(poured_logs)
    current_streak = len(poured_logs)
    return {"currentStreak": current_streak, "bestStreak": best_streak}

def generate_plant_insights(logs: List[Dict[str, Any]], plant: Dict[str, Any]) -> List[str]:
    insights = []
    if not logs:
        insights.append(f"Welcome! Base pour is {plant.get('baseWaterMl', 300)} ml based on pot volume.")
        return insights

    for l in logs[:5]:
        weather = l.get("weatherSnapshot")
        if weather:
            temp = weather.get("temp", 20)
            rain = weather.get("rainMm", 0)
            if temp <= 3:
                insights.append(f"❄️ Cold snap detected ({temp}°C): watering was curtailed to prevent root frost.")
                break
            elif temp >= 30:
                insights.append(f"☀️ Heatwave surge ({temp}°C): water was boosted to match high transpiration.")
                break
            elif rain >= 4 and plant.get("environment") == "outdoor":
                insights.append(f"🌧️ Outdoor rain ({rain} mm) saved manual watering volume.")
                break

    pot = plant.get("pot", {})
    if pot.get("material") == "terracotta":
        insights.append("🏺 Terracotta clay breathes and dries faster (+15% base adjustment).")
    elif not pot.get("drainage", True):
        insights.append("⚠️ Pot without drainage hole (-20% base) guards against root rot.")

    missed = sum(1 for l in logs if l.get("status") == "missed")
    if missed == 0 and len(logs) >= 3:
        insights.append("🔥 Flawless streak! Your plant health score is in peak thriving condition.")

    return insights

def check_and_award_achievements(
    db: Any,
    plant_id: str,
    user_id: str,
    person_name: str,
    log: Dict[str, Any]
) -> List[Dict[str, Any]]:
    newly_awarded = []
    existing = list(db.achievements.find({"personName": person_name}))
    existing_badges = {a.get("badge") for a in existing}

    # Early Bird (< 9:00 AM)
    poured_at_str = str(log.get("pouredAt", ""))
    hour = 8
    try:
        hour = datetime.fromisoformat(poured_at_str.replace("Z", "+00:00")).hour
    except Exception:
        pass

    if "Early Bird" not in existing_badges and hour < 9:
        ach = {
            "plantId": plant_id,
            "userId": user_id,
            "personName": person_name,
            "badge": "Early Bird",
            "description": "Watered before 9:00 AM! Morning hydration hero.",
            "icon": "🌅",
            "awardedAt": datetime.utcnow().isoformat() + "Z",
        }
        db.achievements.insert_one(ach)
        ach["_id"] = str(ach["_id"])
        newly_awarded.append(ach)

    # Plant Whisperer (within 5% of suggestion)
    suggested = log.get("suggestedAmountMl", 0)
    actual = log.get("amountMl", 0)
    if "Plant Whisperer" not in existing_badges and suggested > 0:
        if abs(actual - suggested) / suggested <= 0.05:
            ach = {
                "plantId": plant_id,
                "userId": user_id,
                "personName": person_name,
                "badge": "Plant Whisperer",
                "description": "Poured exact fuzzy recommended volume within 5% precision!",
                "icon": "🎯",
                "awardedAt": datetime.utcnow().isoformat() + "Z",
            }
            db.achievements.insert_one(ach)
            ach["_id"] = str(ach["_id"])
            newly_awarded.append(ach)

    # Weather Warrior (extreme weather)
    weather = log.get("weatherSnapshot")
    if "Weather Warrior" not in existing_badges and weather:
        temp = weather.get("temp", 20)
        if temp <= 5 or temp >= 30:
            ach = {
                "plantId": plant_id,
                "userId": user_id,
                "personName": person_name,
                "badge": "Weather Warrior",
                "description": f"Mastered watering adjustment during extreme {temp}°C weather!",
                "icon": "🛡️",
                "awardedAt": datetime.utcnow().isoformat() + "Z",
            }
            db.achievements.insert_one(ach)
            ach["_id"] = str(ach["_id"])
            newly_awarded.append(ach)

    return newly_awarded
