from typing import Dict, List, Any

FUZZY_RULES = [
    {
        "id": "R1_FREEZING",
        "description": "IF temp is Freezing THEN water is VeryLow",
        "eval": lambda t, h, r, ctx: (t["Freezing"], "VeryLow"),
    },
    {
        "id": "R2_COLD_HUMID",
        "description": "IF temp is Cold AND humidity is Humid THEN water is Low",
        "eval": lambda t, h, r, ctx: (min(t["Cold"], h["Humid"]), "Low"),
    },
    {
        "id": "R3_COLD_DRY",
        "description": "IF temp is Cold AND (humidity is Dry OR Comfortable) THEN water is Low",
        "eval": lambda t, h, r, ctx: (min(t["Cold"], max(h["Dry"], h["Comfortable"])), "Low"),
    },
    {
        "id": "R4_COOL_HUMID",
        "description": "IF temp is Cool AND humidity is Humid THEN water is Low",
        "eval": lambda t, h, r, ctx: (min(t["Cool"], h["Humid"]), "Low"),
    },
    {
        "id": "R5_COOL_NORMAL",
        "description": "IF temp is Cool AND (humidity is Comfortable OR Dry) THEN water is Normal",
        "eval": lambda t, h, r, ctx: (min(t["Cool"], max(h["Comfortable"], h["Dry"])), "Normal"),
    },
    {
        "id": "R6_MILD_COMFORTABLE",
        "description": "IF temp is Mild AND humidity is Comfortable THEN water is Normal",
        "eval": lambda t, h, r, ctx: (min(t["Mild"], h["Comfortable"]), "Normal"),
    },
    {
        "id": "R7_MILD_DRY",
        "description": "IF temp is Mild AND humidity is Dry THEN water is High",
        "eval": lambda t, h, r, ctx: (min(t["Mild"], h["Dry"]), "High"),
    },
    {
        "id": "R8_MILD_HUMID",
        "description": "IF temp is Mild AND humidity is Humid THEN water is Normal",
        "eval": lambda t, h, r, ctx: (min(t["Mild"], h["Humid"]), "Normal"),
    },
    {
        "id": "R9_WARM_DRY",
        "description": "IF temp is Warm AND humidity is Dry THEN water is High",
        "eval": lambda t, h, r, ctx: (min(t["Warm"], h["Dry"]), "High"),
    },
    {
        "id": "R10_WARM_COMFORTABLE",
        "description": "IF temp is Warm AND humidity is Comfortable THEN water is High",
        "eval": lambda t, h, r, ctx: (min(t["Warm"], h["Comfortable"]), "High"),
    },
    {
        "id": "R11_WARM_HUMID",
        "description": "IF temp is Warm AND humidity is Humid THEN water is Normal",
        "eval": lambda t, h, r, ctx: (min(t["Warm"], h["Humid"]), "Normal"),
    },
    {
        "id": "R12_HOT_NONE_RAIN",
        "description": "IF (temp is Hot OR ScorchingHot) AND rain is None THEN water is VeryHigh",
        "eval": lambda t, h, r, ctx: (min(max(t["Hot"], t["ScorchingHot"]), r["None"]), "VeryHigh"),
    },
    {
        "id": "R13_HOT_DRY_HUMIDITY",
        "description": "IF (temp is Hot OR ScorchingHot) AND humidity is Dry THEN water is VeryHigh",
        "eval": lambda t, h, r, ctx: (min(max(t["Hot"], t["ScorchingHot"]), h["Dry"]), "VeryHigh"),
    },
    {
        "id": "R14_OUTDOOR_HEAVY_RAIN",
        "description": "IF rain is Heavy AND plant is Outdoor THEN water is Skip",
        "eval": lambda t, h, r, ctx: (r["Heavy"] if ctx.get("environment") == "outdoor" else 0.0, "Skip"),
    },
    {
        "id": "R15_OUTDOOR_LIGHT_RAIN",
        "description": "IF rain is Light AND plant is Outdoor THEN water is Low",
        "eval": lambda t, h, r, ctx: (r["Light"] if ctx.get("environment") == "outdoor" else 0.0, "Low"),
    },
    {
        "id": "R16_BALCONY_HEAVY_RAIN",
        "description": "IF rain is Heavy AND plant is Balcony THEN water is Low",
        "eval": lambda t, h, r, ctx: (r["Heavy"] * 0.75 if ctx.get("environment") == "balcony" else 0.0, "Low"),
    },
]
