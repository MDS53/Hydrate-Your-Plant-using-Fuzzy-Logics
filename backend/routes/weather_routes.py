from flask import Blueprint, request, jsonify
from services.weather_service import search_cities, get_weather_forecast
from fuzzy.engine import evaluate_fuzzy_watering

weather_bp = Blueprint("weather", __name__)

@weather_bp.route("/search", methods=["GET"])
def search_city():
    q = request.args.get("q", "")
    results = search_cities(q)
    return jsonify({"results": results})

@weather_bp.route("/live", methods=["GET"])
def live_weather():
    try:
        lat = float(request.args.get("lat", 47.3769))
        lon = float(request.args.get("lon", 8.5417))
        snapshot, is_fallback = get_weather_forecast(lat, lon)
        return jsonify({"snapshot": snapshot, "isFallback": is_fallback})
    except Exception as e:
        return jsonify({"error": str(e)}), 400

@weather_bp.route("/fuzzy-test", methods=["POST"])
def fuzzy_test():
    data = request.get_json() or {}
    res = evaluate_fuzzy_watering(
        temp=float(data.get("temp", 20)),
        humidity=float(data.get("humidity", 50)),
        rain_mm=float(data.get("rainMm", 0)),
        environment=data.get("environment", "indoor"),
        drought_tolerance=data.get("droughtTolerance", "medium"),
        pot_material=data.get("potMaterial", "plastic"),
        base_water_ml=int(data.get("baseWaterMl", 300)),
    )
    return jsonify(res)
