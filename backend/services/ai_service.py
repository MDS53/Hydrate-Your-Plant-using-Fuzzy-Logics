import json
import re
import requests
from typing import Dict, Any
from config import Config

BOTANICAL_PRESETS: Dict[str, Dict[str, Any]] = {
    "monstera": {
        "shortDescription": "Monstera deliciosa (Swiss Cheese Plant) is an iconic tropical climbing vine with dramatic fenestrated foliage.",
        "idealTempMin": 18,
        "idealTempMax": 28,
        "criticalMinTemp": 10,
        "criticalMaxTemp": 35,
        "light": "Bright indirect light; tolerates medium light",
        "humidity": "High (60-80%), adapts to normal room humidity",
        "soilType": "Chunky aroid mix (bark, perlite, coco peat)",
        "wateringNeeds": "Allow top 50% of soil to dry out before thorough drenching.",
        "waterMlPerPotLitre": 85,
        "waterTypicalRange": "70 - 100 ml/L",
        "recommendedFrequencyPerWeek": 1.0,
        "droughtTolerance": "medium",
        "overwateringSensitivity": "high",
        "commonProblems": ["Yellowing leaves from soggy soil", "Crispy brown tips from dry air"],
        "tips": ["Wipe leaves with a damp cloth monthly", "Stake with a moss pole for aerial roots"],
    },
    "snake plant": {
        "shortDescription": "Sansevieria is an architectural, nearly indestructible succulent that purifies air and thrives on neglect.",
        "idealTempMin": 16,
        "idealTempMax": 30,
        "criticalMinTemp": 8,
        "criticalMaxTemp": 38,
        "light": "Low to bright indirect light; tolerates direct sun",
        "humidity": "Low to dry (30-50%)",
        "soilType": "Fast-draining cactus and succulent mix with coarse sand",
        "wateringNeeds": "Allow soil to dry out 100% completely between waterings.",
        "waterMlPerPotLitre": 50,
        "waterTypicalRange": "40 - 65 ml/L",
        "recommendedFrequencyPerWeek": 0.5,
        "droughtTolerance": "high",
        "overwateringSensitivity": "high",
        "commonProblems": ["Rhizome mushiness from overwatering"],
        "tips": ["Never let water pool inside the leaf rosette", "Use terracotta for quick drying"],
    },
    "fiddle leaf fig": {
        "shortDescription": "Ficus lyrata is a breathtaking statement tree with large glossy, violin-shaped foliage.",
        "idealTempMin": 18,
        "idealTempMax": 26,
        "criticalMinTemp": 12,
        "criticalMaxTemp": 34,
        "light": "Abundant bright, filtered light with gentle morning sun",
        "humidity": "Moderate to high (50-65%)",
        "soilType": "Rich, well-aerated potting soil with perlite",
        "wateringNeeds": "Water thoroughly once top 5 cm of soil is dry.",
        "waterMlPerPotLitre": 90,
        "waterTypicalRange": "75 - 110 ml/L",
        "recommendedFrequencyPerWeek": 1.0,
        "droughtTolerance": "low",
        "overwateringSensitivity": "high",
        "commonProblems": ["Brown leaf edema spots", "Sudden leaf drop if moved"],
        "tips": ["Keep away from air conditioning vents and cold drafts"],
    },
    "pothos": {
        "shortDescription": "Epipremnum aureum (Golden Pothos) is a resilient, lush trailing vine that forgives imperfect watering.",
        "idealTempMin": 18,
        "idealTempMax": 29,
        "criticalMinTemp": 10,
        "criticalMaxTemp": 35,
        "light": "Low to bright indirect light",
        "humidity": "Moderate household humidity (40-60%)",
        "soilType": "Well-draining standard indoor potting soil",
        "wateringNeeds": "Water when top 3 cm of soil is dry.",
        "waterMlPerPotLitre": 75,
        "waterTypicalRange": "60 - 90 ml/L",
        "recommendedFrequencyPerWeek": 1.0,
        "droughtTolerance": "medium",
        "overwateringSensitivity": "medium",
        "commonProblems": ["Drooping when dry (perks up quickly after drink)"],
        "tips": ["Trim vines in spring to promote fuller bushy stems"],
    },
    "peace lily": {
        "shortDescription": "Spathiphyllum features glossy deep-green leaves and elegant white spathes, acting as a natural soil hygrometer.",
        "idealTempMin": 18,
        "idealTempMax": 27,
        "criticalMinTemp": 12,
        "criticalMaxTemp": 32,
        "light": "Low to medium indirect light",
        "humidity": "High (50-70%)",
        "soilType": "Moisture-retentive potting mix with peat and perlite",
        "wateringNeeds": "Keep soil slightly moist; droops dramatically when thirsty.",
        "waterMlPerPotLitre": 95,
        "waterTypicalRange": "80 - 115 ml/L",
        "recommendedFrequencyPerWeek": 1.5,
        "droughtTolerance": "low",
        "overwateringSensitivity": "medium",
        "commonProblems": ["Severe wilting if thirsty", "Brown leaf tips from tap chlorine"],
        "tips": ["Use filtered or rested room-temperature water"],
    },
    "aloe vera": {
        "shortDescription": "Aloe barbadensis is a soothing medicinal succulent with plump, gel-filled leaves.",
        "idealTempMin": 15,
        "idealTempMax": 30,
        "criticalMinTemp": 5,
        "criticalMaxTemp": 38,
        "light": "Bright direct sunlight (6+ hours daily)",
        "humidity": "Low (30-40%)",
        "soilType": "Gritty cactus mix with pumice",
        "wateringNeeds": "Water deeply but rarely; allow complete dry-out.",
        "waterMlPerPotLitre": 45,
        "waterTypicalRange": "35 - 60 ml/L",
        "recommendedFrequencyPerWeek": 0.5,
        "droughtTolerance": "high",
        "overwateringSensitivity": "high",
        "commonProblems": ["Mushy brown leaves from wet roots"],
        "tips": ["Unglazed terracotta pot is ideal"],
    },
}

def generate_plant_care_info(plant_name: str) -> Dict[str, Any]:
    norm_name = re.sub(r"[^a-z0-9 ]", "", plant_name.lower()).strip()

    # 1. If Gemini API Key provided, call Gemini API first!
    if Config.GEMINI_API_KEY:
        print(f"[AIService] 🤖 Calling Google Gemini API for plant: '{plant_name}'...")
        models_to_try = ["gemini-3.5-flash", "gemini-3.8-flash", "gemini-flash-latest"]
        for model in models_to_try:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={Config.GEMINI_API_KEY}"
                prompt = f"""You are a master botanist. Provide comprehensive care guidelines for the plant '{plant_name}'.
Return ONLY a valid JSON object matching this schema:
{{
  "shortDescription": "string",
  "idealTempMin": number,
  "idealTempMax": number,
  "criticalMinTemp": number,
  "criticalMaxTemp": number,
  "light": "string",
  "humidity": "string",
  "soilType": "string",
  "wateringNeeds": "string",
  "waterMlPerPotLitre": number,
  "waterTypicalRange": "string",
  "recommendedFrequencyPerWeek": number,
  "droughtTolerance": "low" | "medium" | "high",
  "overwateringSensitivity": "low" | "medium" | "high",
  "commonProblems": ["string", "string"],
  "tips": ["string", "string"]
}}"""
                body = {"contents": [{"parts": [{"text": prompt}]}]}
                resp = requests.post(url, json=body, timeout=15)
                if resp.status_code == 200:
                    raw_text = resp.json()["candidates"][0]["content"]["parts"][0]["text"]
                    cleaned = re.sub(r"```(json)?", "", raw_text).strip()
                    data = json.loads(cleaned)
                    print(f"[AIService] ✅ Gemini ({model}) successfully generated botanical care guidelines for '{plant_name}'!")
                    return {
                        "shortDescription": data.get("shortDescription", f"{plant_name} is a lovely houseplant."),
                        "idealTempMin": float(data.get("idealTempMin", 18)),
                        "idealTempMax": float(data.get("idealTempMax", 27)),
                        "criticalMinTemp": float(data.get("criticalMinTemp", 10)),
                        "criticalMaxTemp": float(data.get("criticalMaxTemp", 35)),
                        "light": data.get("light", "Bright indirect light"),
                        "humidity": data.get("humidity", "Moderate (40-60%)"),
                        "soilType": data.get("soilType", "Well-draining potting soil"),
                        "wateringNeeds": data.get("wateringNeeds", "Water when topsoil is dry to the touch."),
                        "waterMlPerPotLitre": max(30, min(180, int(data.get("waterMlPerPotLitre", 80)))),
                        "waterTypicalRange": data.get("waterTypicalRange", "60 - 90 ml/L"),
                        "recommendedFrequencyPerWeek": float(data.get("recommendedFrequencyPerWeek", 1.0)),
                        "droughtTolerance": data.get("droughtTolerance", "medium") if data.get("droughtTolerance") in ["low", "medium", "high"] else "medium",
                        "overwateringSensitivity": data.get("overwateringSensitivity", "medium") if data.get("overwateringSensitivity") in ["low", "medium", "high"] else "medium",
                        "commonProblems": data.get("commonProblems", ["Overwatering", "Underwatering"])[:3],
                        "tips": data.get("tips", ["Ensure pot has drainage", "Check soil before watering"])[:3],
                        "isAiGenerated": True,
                        "source": f"Google Gemini ({model})",
                    }
                else:
                    print(f"[AIService] Gemini {model} returned status {resp.status_code}: {resp.text[:200]}")
            except Exception as e:
                print(f"[AIService] Gemini {model} call failed for {plant_name}: {e}")

    # 2. Check preset library if Gemini is not configured or failed
    for key, preset in BOTANICAL_PRESETS.items():
        if key in norm_name or norm_name in key:
            print(f"[AIService] 🌿 Using botanical preset library for '{plant_name}' (matched preset: '{key}').")
            return preset

    # Sensible botanical fallback
    return {
        "shortDescription": f"{plant_name} thrives with consistent, observant watering and indirect sunlight.",
        "idealTempMin": 18,
        "idealTempMax": 26,
        "criticalMinTemp": 10,
        "criticalMaxTemp": 35,
        "light": "Bright indirect sunlight",
        "humidity": "Moderate humidity (45-60%)",
        "soilType": "Aerated indoor potting soil amended with perlite",
        "wateringNeeds": "Water thoroughly once the top 3-4 cm of potting soil is dry.",
        "waterMlPerPotLitre": 75,
        "waterTypicalRange": "60 - 90 ml/L",
        "recommendedFrequencyPerWeek": 1.0,
        "droughtTolerance": "medium",
        "overwateringSensitivity": "medium",
        "commonProblems": ["Yellowing foliage from overwatering", "Leaf tip browning from dry indoor atmosphere"],
        "tips": ["Never let roots sit in standing puddle runoff", "Inspect foliage weekly"],
    }

def calculate_base_water_ml(
    water_ml_per_pot_litre: int,
    volume_l: float,
    material: str = "plastic",
    has_drainage: bool = True
) -> int:
    material_factor = 1.0
    if material == "terracotta":
        material_factor = 1.15
    elif material == "ceramic":
        material_factor = 0.95

    drainage_factor = 1.0 if has_drainage else 0.80

    raw_ml = water_ml_per_pot_litre * volume_l * material_factor * drainage_factor
    return max(10, int(round(raw_ml / 10.0) * 10))
