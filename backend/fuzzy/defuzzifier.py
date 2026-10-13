from typing import Dict, Tuple
from .sets import get_consequent_membership

CONSEQUENTS = ["Skip", "VeryLow", "Low", "Normal", "High", "VeryHigh"]

def centroid_defuzzify(strengths: Dict[str, float], steps: int = 300) -> Tuple[float, float]:
    """
    Centroid defuzzification (Center of Area) over domain [0.0, 1.5]
    """
    min_x = 0.0
    max_x = 1.5
    dx = (max_x - min_x) / steps

    numerator = 0.0
    denominator = 0.0

    for i in range(steps + 1):
        x = min_x + i * dx
        aggregated_mu = 0.0

        for c in CONSEQUENTS:
            alpha = strengths.get(c, 0.0)
            if alpha > 0.0:
                set_mu = get_consequent_membership(c, x)
                clipped = min(alpha, set_mu)
                if clipped > aggregated_mu:
                    aggregated_mu = clipped

        numerator += x * aggregated_mu * dx
        denominator += aggregated_mu * dx

    if denominator == 0.0:
        return 1.0, 0.0

    factor = numerator / denominator
    return round(factor, 3), round(denominator, 3)
