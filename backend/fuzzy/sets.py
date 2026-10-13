from typing import Dict
from .membership import triangular, shoulder_left, shoulder_right

def get_temperature_memberships(temp: float) -> Dict[str, float]:
    """
    Evaluates temperature against 7 linguistic sets:
    Freezing (<= 2°C), Cold, Cool, Mild, Warm, Hot, ScorchingHot
    """
    return {
        "Freezing": shoulder_left(temp, 2.0, 5.0),
        "Cold": triangular(temp, 2.0, 7.0, 13.0),
        "Cool": triangular(temp, 9.0, 14.0, 19.0),
        "Mild": triangular(temp, 16.0, 20.5, 25.0),
        "Warm": triangular(temp, 21.0, 25.5, 30.0),
        "Hot": triangular(temp, 27.0, 32.0, 37.0),
        "ScorchingHot": shoulder_right(temp, 33.0, 38.0),
    }

def get_humidity_memberships(humidity: float) -> Dict[str, float]:
    """
    Evaluates relative humidity against 3 linguistic sets:
    Dry (< 40%), Comfortable (35-70%), Humid (> 60%)
    """
    return {
        "Dry": shoulder_left(humidity, 28.0, 42.0),
        "Comfortable": triangular(humidity, 35.0, 52.5, 70.0),
        "Humid": shoulder_right(humidity, 60.0, 80.0),
    }

def get_rain_memberships(rain_mm: float) -> Dict[str, float]:
    """
    Evaluates 24h precipitation against 3 linguistic sets:
    None (<= 0.2mm), Light (0.4 - 7mm), Heavy (>= 4.5mm)
    """
    return {
        "None": shoulder_left(rain_mm, 0.2, 1.2),
        "Light": triangular(rain_mm, 0.4, 3.0, 7.0),
        "Heavy": shoulder_right(rain_mm, 4.5, 9.0),
    }

def get_consequent_membership(consequent: str, factor: float) -> float:
    """
    Output membership functions for adjustment factor over domain [0.0, 1.5]
    """
    if consequent == "Skip":
        return shoulder_left(factor, 0.05, 0.2)
    elif consequent == "VeryLow":
        return triangular(factor, 0.1, 0.32, 0.55)
    elif consequent == "Low":
        return triangular(factor, 0.45, 0.68, 0.88)
    elif consequent == "Normal":
        return triangular(factor, 0.8, 1.0, 1.2)
    elif consequent == "High":
        return triangular(factor, 1.05, 1.22, 1.38)
    elif consequent == "VeryHigh":
        return shoulder_right(factor, 1.22, 1.45)
    return 0.0
