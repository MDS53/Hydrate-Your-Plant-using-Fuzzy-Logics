import pytest
try:
    from fuzzy.membership import triangular, shoulder_left, shoulder_right
    from fuzzy.defuzzifier import centroid_defuzzify
    from fuzzy.engine import evaluate_fuzzy_watering
except ImportError:
    from backend.fuzzy.membership import triangular, shoulder_left, shoulder_right
    from backend.fuzzy.defuzzifier import centroid_defuzzify
    from backend.fuzzy.engine import evaluate_fuzzy_watering

def test_membership_functions():
    assert triangular(10, 5, 10, 15) == 1.0
    assert triangular(5, 5, 10, 15) == 0.0
    assert triangular(7.5, 5, 10, 15) == pytest.approx(0.5, 0.01)

    assert shoulder_left(1, 2, 5) == 1.0
    assert shoulder_left(2, 2, 5) == 1.0
    assert shoulder_left(3.5, 2, 5) == pytest.approx(0.5, 0.01)
    assert shoulder_left(6, 2, 5) == 0.0

    assert shoulder_right(30, 33, 38) == 0.0
    assert shoulder_right(35.5, 33, 38) == pytest.approx(0.5, 0.01)
    assert shoulder_right(40, 33, 38) == 1.0

def test_centroid_defuzzifier():
    # Empty
    factor, _ = centroid_defuzzify({})
    assert factor == 1.0

    # Normal only
    factor_normal, _ = centroid_defuzzify({"Normal": 1.0})
    assert 0.90 < factor_normal < 1.10

    # VeryHigh
    factor_hot, _ = centroid_defuzzify({"VeryHigh": 1.0})
    assert factor_hot > 1.25

def test_freezing_weather():
    res = evaluate_fuzzy_watering(
        temp=0.0,
        humidity=60.0,
        rain_mm=0.0,
        environment="outdoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    assert res["finalFuzzyFactor"] < 0.50
    assert res["suggestedWaterMl"] < 150
    assert res["shouldSkipOrMinimal"] is True
    assert "Freezing" in res["reason"] or "frost" in res["reason"].lower()
    assert res["badge"]["emoji"] == "❄️"

def test_mild_comfortable_weather():
    res = evaluate_fuzzy_watering(
        temp=20.0,
        humidity=50.0,
        rain_mm=0.0,
        environment="indoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    assert 0.90 <= res["finalFuzzyFactor"] <= 1.10
    assert 280 <= res["suggestedWaterMl"] <= 320
    assert res["shouldSkipOrMinimal"] is False

def test_hot_dry_weather():
    res = evaluate_fuzzy_watering(
        temp=34.0,
        humidity=25.0,
        rain_mm=0.0,
        environment="outdoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    assert res["finalFuzzyFactor"] > 1.15
    assert res["suggestedWaterMl"] > 300

def test_heavy_rain_outdoor():
    res = evaluate_fuzzy_watering(
        temp=18.0,
        humidity=85.0,
        rain_mm=12.0,
        environment="outdoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    assert res["finalFuzzyFactor"] < 0.50
    assert res["shouldSkipOrMinimal"] is True

def test_indoor_damping():
    outdoor = evaluate_fuzzy_watering(
        temp=35.0,
        humidity=20.0,
        rain_mm=0.0,
        environment="outdoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    indoor = evaluate_fuzzy_watering(
        temp=35.0,
        humidity=20.0,
        rain_mm=0.0,
        environment="indoor",
        drought_tolerance="medium",
        base_water_ml=300
    )
    assert indoor["finalFuzzyFactor"] < outdoor["finalFuzzyFactor"]
    assert indoor["suggestedWaterMl"] < outdoor["suggestedWaterMl"]

def test_succulent_dampens_heat():
    regular = evaluate_fuzzy_watering(
        temp=33.0,
        humidity=30.0,
        rain_mm=0.0,
        environment="balcony",
        drought_tolerance="medium",
        base_water_ml=300
    )
    succulent = evaluate_fuzzy_watering(
        temp=33.0,
        humidity=30.0,
        rain_mm=0.0,
        environment="balcony",
        drought_tolerance="high",
        base_water_ml=300
    )
    assert succulent["finalFuzzyFactor"] < regular["finalFuzzyFactor"]

def test_practical_rounding():
    res = evaluate_fuzzy_watering(
        temp=23.0,
        humidity=45.0,
        rain_mm=0.0,
        environment="indoor",
        drought_tolerance="medium",
        base_water_ml=255
    )
    assert res["suggestedWaterMl"] % 10 == 0
