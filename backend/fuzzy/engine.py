from typing import Dict, Any, List
from .sets import get_temperature_memberships, get_humidity_memberships, get_rain_memberships
from .rules import FUZZY_RULES
from .defuzzifier import centroid_defuzzify

def evaluate_fuzzy_watering(
    temp: float,
    humidity: float,
    rain_mm: float,
    environment: str = "indoor",
    drought_tolerance: str = "medium",
    pot_material: str = "plastic",
    base_water_ml: int = 300
) -> Dict[str, Any]:
    """
    Evaluates Mamdani fuzzy inference and centroid defuzzification
    returning the weather-adjusted watering volume, factor, and trace.
    """
    # 1. Fuzzification
    temp_memberships = get_temperature_memberships(temp)
    humidity_memberships = get_humidity_memberships(humidity)
    rain_memberships = get_rain_memberships(rain_mm)

    context = {
        "environment": environment,
        "drought_tolerance": drought_tolerance,
        "pot_material": pot_material,
    }

    # 2. Mamdani Inference (Min operator for antecedents, Max aggregation)
    strengths = {
        "Skip": 0.0,
        "VeryLow": 0.0,
        "Low": 0.0,
        "Normal": 0.0,
        "High": 0.0,
        "VeryHigh": 0.0,
    }
    rules_fired: List[Dict[str, Any]] = []

    for rule in FUZZY_RULES:
        alpha, consequent = rule["eval"](
            temp_memberships, humidity_memberships, rain_memberships, context
        )
        if alpha > 0.01:
            rules_fired.append({
                "ruleId": rule["id"],
                "description": rule["description"],
                "strength": round(alpha, 3),
                "consequent": consequent,
            })
            if alpha > strengths[consequent]:
                strengths[consequent] = alpha

    # 3. Defuzzification
    raw_factor, _ = centroid_defuzzify(strengths)

    # 4. Plant Context Adjustments
    adjusted = raw_factor

    # Drought tolerance (succulents / desert species)
    if drought_tolerance == "high":
        if adjusted > 1.0:
            adjusted = 1.0 + (adjusted - 1.0) * 0.40  # dampen heat increases
        else:
            adjusted = 1.0 - (1.0 - adjusted) * 1.35  # amplify cold/rain decreases
    elif drought_tolerance == "low":
        if adjusted > 1.0:
            adjusted = 1.0 + (adjusted - 1.0) * 1.15
        else:
            adjusted = 1.0 - (1.0 - adjusted) * 0.75

    # Environment damping & rain saturation
    final_factor = adjusted
    if environment == "indoor":
        final_factor = 1.0 + (adjusted - 1.0) * 0.45
    elif environment == "balcony":
        final_factor = 1.0 + (adjusted - 1.0) * 0.80
        if rain_mm >= 5.0:
            final_factor *= 0.65
    else:  # outdoor
        if rain_mm >= 4.0:
            rain_offset = min(0.85, (rain_mm / 10.0) * 0.8)
            final_factor = max(0.05, final_factor * (1.0 - rain_offset))

    # Safety clamping
    final_factor = max(0.05, min(1.60, final_factor))
    final_factor = round(final_factor, 2)

    # 5. Calculate suggested volume (rounded to nearest 10 ml)
    suggested_ml = max(10, int(round((base_water_ml * final_factor) / 10.0) * 10))

    should_skip = (
        final_factor <= 0.35 or
        (environment == "outdoor" and rain_mm >= 5.0) or
        temp <= 2.0
    )

    percent_diff = int(round((final_factor - 1.0) * 100))

    # Plain language reason & badges
    emoji = "🌱"
    if temp <= 2.0:
        emoji = "❄️"
        reason = f"Freezing frost alert ({temp}°C)! Water slashed by {abs(percent_diff)}% to prevent root frostbite."
    elif environment == "outdoor" and rain_mm >= 4.5:
        emoji = "🌧️"
        reason = f"Nature already watered! Outdoor rain ({rain_mm:.1f} mm) slashed irrigation by {abs(percent_diff)}%."
    elif temp >= 28.0 and humidity <= 40.0:
        emoji = "☀️"
        reason = f"Thirst trap weather ({temp}°C, {humidity}% dry air)! Boosted by {percent_diff}%."
    elif temp >= 28.0:
        emoji = "🌡️"
        reason = f"Summer heatwave ({temp}°C)! Evaporation boosted by {percent_diff}%."
    elif temp <= 12.0 and humidity >= 70.0:
        emoji = "🌫️"
        reason = f"Chilly & damp ({temp}°C, {humidity}% humidity)! Trimmed by {abs(percent_diff)}%."
    elif temp <= 14.0:
        emoji = "🧤"
        reason = f"Cooler weather ({temp}°C), reduced by {abs(percent_diff)}%."
    elif humidity <= 35.0:
        emoji = "💨"
        reason = f"Arid dry air ({humidity}% humidity), increased by {percent_diff}%."
    elif abs(percent_diff) <= 5:
        emoji = "✨"
        reason = f"Optimal botanical sweetspot ({temp}°C, {humidity}% humidity), standard pour."
    elif percent_diff > 0:
        emoji = "🌤️"
        reason = f"Warm conditions ({temp}°C), increased by {percent_diff}%."
    else:
        emoji = "🌿"
        reason = f"Cool or humid conditions, reduced by {abs(percent_diff)}%."

    if drought_tolerance == "high":
        reason += " (succulent reserve active)"

    diff_ml = suggested_ml - base_water_ml
    if diff_ml < -75:
        verbal_suggestion = "Drastically reduce water (minimal pour)"
    elif diff_ml < -25:
        verbal_suggestion = "Reduce it moderately"
    elif diff_ml < -5:
        verbal_suggestion = "Reduce it slightly"
    elif diff_ml <= 5:
        verbal_suggestion = "Maintain standard hydration"
    elif diff_ml <= 25:
        verbal_suggestion = "Increase it slightly"
    elif diff_ml <= 75:
        verbal_suggestion = "Increase it moderately"
    else:
        verbal_suggestion = "Substantially increase water"

    if diff_ml < 0:
        crisp_bracket_text = f"[Reduce by {abs(diff_ml)} ml, Crisp target: {suggested_ml} ml]"
    elif diff_ml > 0:
        crisp_bracket_text = f"[Increase by {diff_ml} ml, Crisp target: {suggested_ml} ml]"
    else:
        crisp_bracket_text = f"[Standard pour, Crisp target: {suggested_ml} ml]"

    return {
        "rawFuzzyFactor": raw_factor,
        "finalFuzzyFactor": final_factor,
        "suggestedWaterMl": suggested_ml,
        "baseWaterMl": base_water_ml,
        "crispDeltaMl": diff_ml,
        "verbalSuggestion": verbal_suggestion,
        "crispBracketText": crisp_bracket_text,
        "shouldSkipOrMinimal": should_skip,
        "reason": reason,
        "badge": {
            "temp": f"{temp:.1f}°C",
            "humidity": f"{int(round(humidity))}%",
            "rain": f"{rain_mm:.1f} mm",
            "emoji": emoji,
        },
        "explanation": {
            "inputs": {
                "temp": temp,
                "humidity": humidity,
                "rainMm": rain_mm,
                "environment": environment,
                "droughtTolerance": drought_tolerance,
                "potMaterial": pot_material,
            },
            "memberships": {
                "temperature": {k: round(v, 2) for k, v in temp_memberships.items() if v > 0.01},
                "humidity": {k: round(v, 2) for k, v in humidity_memberships.items() if v > 0.01},
                "rain": {k: round(v, 2) for k, v in rain_memberships.items() if v > 0.01},
            },
            "rulesTriggered": rules_fired,
            "defuzzification": {
                "centroidFactor": raw_factor,
                "afterPlantContextDamping": adjusted,
                "finalRoundedFactor": final_factor,
            },
        },
    }
