import bcrypt
from datetime import datetime, timedelta
import secrets
from config import get_db, Config
from fuzzy.engine import evaluate_fuzzy_watering

def seed_database():
    db = get_db()
    print("🌱 Starting Python database seeding...")

    # Clear existing
    db.users.delete_many({})
    db.plants.delete_many({})
    db.caretakers.delete_many({})
    db.schedules.delete_many({})
    db.waterlogs.delete_many({})
    db.achievements.delete_many({})
    db.snoozes.delete_many({})

    # 1. User
    salt = bcrypt.gensalt(10)
    password_hash = bcrypt.hashpw("password123".encode("utf-8"), salt).decode("utf-8")

    user_res = db.users.insert_one({
        "name": "Sophia Botanica",
        "email": "sophia@example.com",
        "passwordHash": password_hash,
        "timezone": "Europe/Zurich",
        "reminderTime": "08:00",
        "createdAt": datetime.utcnow().isoformat() + "Z",
    })
    user_id = str(user_res.inserted_id)
    print(f"👤 Created user: Sophia Botanica (sophia@example.com) / password123")

    # 2. Plants
    monstera_res = db.plants.insert_one({
        "userId": user_id,
        "name": "Monstera Deliciosa (Monty)",
        "emoji": "🪴",
        "location": {"city": "Zurich", "lat": 47.3769, "lon": 8.5417, "country": "Switzerland"},
        "environment": "indoor",
        "pot": {"volumeL": 5.0, "diameterCm": 22, "heightCm": 20, "material": "ceramic", "drainage": True},
        "careInfo": {
            "shortDescription": "Monstera deliciosa is an iconic tropical climbing plant with dramatic perforated leaves.",
            "idealTempMin": 18,
            "idealTempMax": 28,
            "criticalMinTemp": 10,
            "criticalMaxTemp": 35,
            "light": "Bright indirect sunlight",
            "humidity": "High (60-80%)",
            "soilType": "Chunky aroid mix with bark and perlite",
            "wateringNeeds": "Water when top 3-4 cm of soil dry out.",
            "waterMlPerPotLitre": 85,
            "waterTypicalRange": "70 - 100 ml/L",
            "recommendedFrequencyPerWeek": 1.5,
            "droughtTolerance": "medium",
            "overwateringSensitivity": "high",
            "commonProblems": ["Yellow leaves from overwatering", "Dry brown edges from low humidity"],
            "tips": ["Clean broad leaves with damp sponge", "Provide moss pole for climbing"],
        },
        "baseWaterMl": 400,
        "pourDaysOfWeek": [1, 5],
        "createdAt": datetime.utcnow().isoformat() + "Z",
    })
    monstera_id = str(monstera_res.inserted_id)

    snake_res = db.plants.insert_one({
        "userId": user_id,
        "name": "Sansevieria (Blade)",
        "emoji": "🌿",
        "location": {"city": "Zurich", "lat": 47.3769, "lon": 8.5417, "country": "Switzerland"},
        "environment": "balcony",
        "pot": {"volumeL": 3.5, "diameterCm": 18, "heightCm": 18, "material": "terracotta", "drainage": True},
        "careInfo": {
            "shortDescription": "Hardy architectural succulent with upright sword-like variegated foliage.",
            "idealTempMin": 16,
            "idealTempMax": 30,
            "criticalMinTemp": 8,
            "criticalMaxTemp": 38,
            "light": "Direct sun to medium indirect",
            "humidity": "Low to average (30-50%)",
            "soilType": "Gritty cactus & succulent soil",
            "wateringNeeds": "Let potting mix dry out completely before watering.",
            "waterMlPerPotLitre": 50,
            "waterTypicalRange": "40 - 65 ml/L",
            "recommendedFrequencyPerWeek": 1.0,
            "droughtTolerance": "high",
            "overwateringSensitivity": "high",
            "commonProblems": ["Root rot from water accumulation"],
            "tips": ["Never leave sitting in standing drainage water"],
        },
        "baseWaterMl": 200,
        "pourDaysOfWeek": [3],
        "createdAt": datetime.utcnow().isoformat() + "Z",
    })
    snake_id = str(snake_res.inserted_id)

    fig_res = db.plants.insert_one({
        "userId": user_id,
        "name": "Fiddle Leaf Fig (Figaro)",
        "emoji": "🌳",
        "location": {"city": "Zurich", "lat": 47.3769, "lon": 8.5417, "country": "Switzerland"},
        "environment": "indoor",
        "pot": {"volumeL": 7.0, "diameterCm": 25, "heightCm": 25, "material": "plastic", "drainage": True},
        "careInfo": {
            "shortDescription": "Magnificent indoor statement tree with glossy violin-shaped foliage.",
            "idealTempMin": 18,
            "idealTempMax": 26,
            "criticalMinTemp": 12,
            "criticalMaxTemp": 34,
            "light": "Bright filtered sunlight",
            "humidity": "Moderate to high (50-65%)",
            "soilType": "Rich aerated loamy mix",
            "wateringNeeds": "Water thoroughly once top 5 cm dry out.",
            "waterMlPerPotLitre": 90,
            "waterTypicalRange": "75 - 110 ml/L",
            "recommendedFrequencyPerWeek": 1.0,
            "droughtTolerance": "low",
            "overwateringSensitivity": "high",
            "commonProblems": ["Brown leaf spots", "Foliage drop if moved"],
            "tips": ["Keep away from drafty doorways or AC vents"],
        },
        "baseWaterMl": 630,
        "pourDaysOfWeek": [0, 4],
        "createdAt": datetime.utcnow().isoformat() + "Z",
    })
    fig_id = str(fig_res.inserted_id)
    print("🪴 Created 3 plants with complete botanical & pot profiles.")

    # 3. Caretakers
    db.caretakers.insert_many([
        {
            "plantId": monstera_id,
            "name": "Alex Green",
            "email": "alex@example.com",
            "invitedBy": user_id,
            "magicTokenHash": "token_alex_123",
            "tokenExpiresAt": (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z",
        },
        {
            "plantId": snake_id,
            "name": "Lucas Moss",
            "email": "lucas@example.com",
            "invitedBy": user_id,
            "magicTokenHash": "token_lucas_456",
            "tokenExpiresAt": (datetime.utcnow() + timedelta(days=30)).isoformat() + "Z",
        },
    ])
    print("👥 Created caretakers (Alex Green, Lucas Moss).")

    # 4. Historical logs
    now = datetime.utcnow()
    past_logs = [
        {"daysAgo": 21, "plantId": monstera_id, "person": "Sophia Botanica", "base": 400, "actual": 400, "temp": 19, "hum": 55},
        {"daysAgo": 18, "plantId": snake_id, "person": "Lucas Moss", "base": 200, "actual": 180, "temp": 14, "hum": 65},
        {"daysAgo": 14, "plantId": monstera_id, "person": "Alex Green", "base": 400, "actual": 440, "temp": 26, "hum": 35},
        {"daysAgo": 11, "plantId": fig_id, "person": "Sophia Botanica", "base": 630, "actual": 630, "temp": 22, "hum": 50},
        {"daysAgo": 7, "plantId": monstera_id, "person": "Sophia Botanica", "base": 400, "actual": 240, "temp": 1, "hum": 70},
        {"daysAgo": 4, "plantId": snake_id, "person": "Sophia Botanica", "base": 200, "actual": 230, "temp": 31, "hum": 30},
        {"daysAgo": 2, "plantId": fig_id, "person": "Alex Green", "base": 630, "actual": 630, "temp": 21, "hum": 50},
    ]

    for log in past_logs:
        log_dt = now - timedelta(days=log["daysAgo"])
        fuzzy = evaluate_fuzzy_watering(
            temp=log["temp"],
            humidity=log["hum"],
            rain_mm=0.0,
            base_water_ml=log["base"]
        )
        db.waterlogs.insert_one({
            "plantId": log["plantId"],
            "userId": user_id,
            "personName": log["person"],
            "status": "poured",
            "amountMl": log["actual"],
            "baseAmountMl": log["base"],
            "suggestedAmountMl": fuzzy["suggestedWaterMl"],
            "pouredAt": log_dt.isoformat() + "Z",
            "fuzzyFactor": fuzzy["finalFuzzyFactor"],
            "weatherSnapshot": {
                "temp": log["temp"],
                "humidity": log["hum"],
                "rainMm": 0.0,
                "conditionDescription": "Sunny / Pleasant",
            },
        })
    print(f"📊 Created {len(past_logs)} historical watering logs.")

    # 5. Upcoming Schedules (Today and next 10 days)
    upcoming = [
        {"days": 0, "plantId": monstera_id, "base": 400, "temp": 22, "hum": 48, "assigned": {"role": "owner", "name": "Sophia Botanica", "email": "sophia@example.com"}},
        {"days": 2, "plantId": snake_id, "base": 200, "temp": 24, "hum": 45, "assigned": {"role": "caretaker", "name": "Lucas Moss", "email": "lucas@example.com"}},
        {"days": 4, "plantId": fig_id, "base": 630, "temp": 19, "hum": 55, "assigned": {"role": "owner", "name": "Sophia Botanica", "email": "sophia@example.com"}},
        {"days": 5, "plantId": monstera_id, "base": 400, "temp": 23, "hum": 50, "assigned": {"role": "caretaker", "name": "Alex Green", "email": "alex@example.com"}},
        {"days": 7, "plantId": fig_id, "base": 630, "temp": 20, "hum": 52, "assigned": {"role": "owner", "name": "Sophia Botanica", "email": "sophia@example.com"}},
    ]

    for item in upcoming:
        sch_dt = now + timedelta(days=item["days"])
        fuzzy = evaluate_fuzzy_watering(
            temp=item["temp"],
            humidity=item["hum"],
            rain_mm=0.0,
            base_water_ml=item["base"]
        )
        db.schedules.insert_one({
            "plantId": item["plantId"],
            "userId": user_id,
            "date": sch_dt.strftime("%Y-%m-%dT08:00:00Z"),
            "assignedTo": item["assigned"],
            "baseMl": item["base"],
            "suggestedMl": fuzzy["suggestedWaterMl"],
            "fuzzyFactor": fuzzy["finalFuzzyFactor"],
            "fuzzyTrace": {
                "reason": fuzzy["reason"],
                "factor": fuzzy["finalFuzzyFactor"],
                "rulesFired": [r["description"] for r in fuzzy["explanation"]["rulesTriggered"]],
                "memberships": fuzzy["explanation"]["memberships"],
                "crispInputs": fuzzy["explanation"]["inputs"],
            },
            "weatherSnapshot": {
                "temp": item["temp"],
                "humidity": item["hum"],
                "rainMm": 0.0,
                "conditionDescription": "Mild & Sunny",
            },
            "magicToken": secrets.token_hex(16),
            "status": "pending",
            "createdAt": datetime.utcnow().isoformat() + "Z",
        })
    print(f"📅 Created {len(upcoming)} scheduled watering events including TODAY.")

    # 6. Achievements
    db.achievements.insert_many([
        {
            "plantId": monstera_id,
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Plant Whisperer",
            "description": "Poured exact fuzzy recommended volume within 5% precision!",
            "icon": "🎯",
            "awardedAt": (now - timedelta(days=7)).isoformat() + "Z",
        },
        {
            "plantId": monstera_id,
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Weather Warrior",
            "description": "Successfully adapted watering during a 1°C freezing cold snap!",
            "icon": "🛡️",
            "awardedAt": (now - timedelta(days=7)).isoformat() + "Z",
        },
        {
            "plantId": monstera_id,
            "userId": user_id,
            "personName": "Alex Green",
            "badge": "Early Bird",
            "description": "Poured water before 9:00 AM on schedule!",
            "icon": "🌅",
            "awardedAt": (now - timedelta(days=14)).isoformat() + "Z",
        },
        {
            "plantId": snake_id,
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Never Missed",
            "description": "Completed 5 consecutive watering sessions without missing a single pour!",
            "icon": "⭐",
            "awardedAt": (now - timedelta(days=4)).isoformat() + "Z",
        },
        {
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Thirst Trap Slayer",
            "description": "Rescued a screaming parched plant within 15 minutes of soil alert! 🧃",
            "icon": "🧃",
            "awardedAt": (now - timedelta(days=5)).isoformat() + "Z",
        },
        {
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Anti-Submarine Admiral",
            "description": "Smartly obeyed fuzzy logic and didn't drown plants during a torrential downpour! 🤿",
            "icon": "🤿",
            "awardedAt": (now - timedelta(days=3)).isoformat() + "Z",
        },
        {
            "plantId": snake_id,
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Desert Chad Certified",
            "description": "Demonstrated master-level restraint: succulent is thriving on sheer audacity. 🌵",
            "icon": "🌵",
            "awardedAt": (now - timedelta(days=1)).isoformat() + "Z",
        },
        {
            "userId": user_id,
            "personName": "Sophia Botanica",
            "badge": "Photosynthesis Royalty",
            "description": "Maintained a collective plant sanctuary vitality score above 90%! 👑",
            "icon": "👑",
            "awardedAt": (now - timedelta(days=2)).isoformat() + "Z",
        },
    ])
    print("🏆 Awarded badges (Plant Whisperer, Weather Warrior, Early Bird, Never Missed, MVP of Month).")
    print("✅ Seed completed successfully! You can log in with sophia@example.com / password123")

if __name__ == "__main__":
    seed_database()
