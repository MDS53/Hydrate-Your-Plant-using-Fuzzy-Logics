import time
import requests
from typing import Dict, Any, List, Tuple
from config import Config

_weather_cache: Dict[str, Tuple[Dict[str, Any], float]] = {}
CACHE_TTL_SECONDS = 30 * 60  # 30 minutes

def search_cities(query: str) -> List[Dict[str, Any]]:
    if not query or len(query.strip()) < 2:
        return []

    try:
        url = "https://geocoding-api.open-meteo.com/v1/search"
        resp = requests.get(url, params={"name": query.strip(), "count": 6, "language": "en", "format": "json"}, timeout=5)
        if resp.status_code != 200:
            return []
        data = resp.json()
        results = data.get("results", [])
        return [
            {
                "city": item.get("name"),
                "country": item.get("country") or item.get("admin1") or "",
                "lat": round(float(item.get("latitude")), 4),
                "lon": round(float(item.get("longitude")), 4),
            }
            for item in results
        ]
    except Exception as e:
        print(f"[WeatherService] City search failed: {e}")
        return []

def get_weather_forecast(lat: float, lon: float) -> Tuple[Dict[str, Any], bool]:
    cache_key = f"{round(lat, 2)}_{round(lon, 2)}"
    now = time.time()

    if cache_key in _weather_cache:
        cached_data, expires_at = _weather_cache[cache_key]
        if expires_at > now:
            return cached_data, False

    # Fetch from Open-Meteo
    try:
        url = "https://api.open-meteo.com/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,uv_index_max",
            "timezone": "auto",
            "forecast_days": 2,
        }
        resp = requests.get(url, params=params, timeout=6)
        if resp.status_code != 200:
            raise Exception(f"Open-Meteo returned status {resp.status_code}")

        data = resp.json()
        current = data.get("current", {})
        daily = data.get("daily", {})

        temp = float(current.get("temperature_2m", 20.0))
        temp_max = float(daily.get("temperature_2m_max", [temp + 3])[0])
        temp_min = float(daily.get("temperature_2m_min", [temp - 3])[0])
        humidity = int(round(float(current.get("relative_humidity_2m", 50.0))))
        rain_mm = float(daily.get("precipitation_sum", [current.get("precipitation", 0.0)])[0])
        rain_prob = int(round(float(daily.get("precipitation_probability_max", [0])[0])))
        wind_speed = float(current.get("wind_speed_10m", 0.0))
        uv_index = float(daily.get("uv_index_max", [3])[0])

        wmo_code = current.get("weather_code", 0)
        condition = "Clear sky"
        if 1 <= wmo_code <= 3: condition = "Partly cloudy"
        elif 45 <= wmo_code <= 48: condition = "Foggy"
        elif 51 <= wmo_code <= 55: condition = "Drizzle"
        elif 61 <= wmo_code <= 65: condition = "Rain"
        elif 71 <= wmo_code <= 77: condition = "Snow"
        elif 80 <= wmo_code <= 82: condition = "Showers"
        elif wmo_code >= 95: condition = "Thunderstorm"

        snapshot = {
            "temp": round(temp, 1),
            "tempMax": round(temp_max, 1),
            "tempMin": round(temp_min, 1),
            "humidity": humidity,
            "rainMm": round(rain_mm, 1),
            "rainProb": rain_prob,
            "windSpeed": round(wind_speed, 1),
            "uvIndex": round(uv_index, 1),
            "conditionDescription": condition,
            "source": "Open-Meteo",
            "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        _weather_cache[cache_key] = (snapshot, now + CACHE_TTL_SECONDS)
        return snapshot, False

    except Exception as e:
        print(f"[WeatherService] Weather fetch failed ({e}). Returning fallback snapshot.")
        fallback = {
            "temp": 21.0,
            "tempMax": 24.0,
            "tempMin": 18.0,
            "humidity": 50,
            "rainMm": 0.0,
            "rainProb": 0,
            "windSpeed": 5.0,
            "uvIndex": 3.0,
            "conditionDescription": "Offline fallback snapshot",
            "source": "Fallback",
            "fetchedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        return fallback, True
