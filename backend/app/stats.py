from __future__ import annotations

import math
from statistics import mean, median, pstdev
from typing import Sequence


def average(values: Sequence[float]) -> float:
    return mean(values) if values else math.nan


def standard_deviation(values: Sequence[float]) -> float:
    return pstdev(values) if len(values) > 1 else 0.0


def linear_regression(values: Sequence[float]) -> tuple[float, float]:
    """Return (slope, r_squared) for equally-spaced observations."""
    n = len(values)
    if n < 2:
        return 0.0, 0.0
    x_mean = (n - 1) / 2
    y_mean = average(values)
    denominator = sum((x - x_mean) ** 2 for x in range(n))
    if denominator == 0:
        return 0.0, 0.0
    slope = sum((x - x_mean) * (y - y_mean) for x, y in enumerate(values)) / denominator
    total = sum((y - y_mean) ** 2 for y in values)
    r_squared = (slope * slope * denominator / total) if total else 0.0
    return slope, r_squared


def theil_sen_regression(values: Sequence[float]) -> tuple[float, float]:
    """Return a robust (slope, fit score) for equally-spaced observations.

    Theil-Sen uses the median of all pairwise slopes, so one unusually large
    measurement cannot determine the trend direction by itself.  The second
    value is a robust R²-like score computed from the median-intercept line.
    """
    n = len(values)
    if n < 2:
        return 0.0, 0.0
    slopes = [
        (values[j] - values[i]) / (j - i)
        for i in range(n - 1)
        for j in range(i + 1, n)
    ]
    slope = median(slopes)
    intercept = median(value - slope * index for index, value in enumerate(values))
    fitted = [intercept + slope * index for index in range(n)]
    total = sum((value - mean(values)) ** 2 for value in values)
    score = 1.0 - sum((value - estimate) ** 2 for value, estimate in zip(values, fitted)) / total if total else 0.0
    return slope, score


def rolling_standard_deviations(values: Sequence[float], window: int) -> list[float]:
    if window < 2 or len(values) < window:
        return []
    return [standard_deviation(values[i : i + window]) for i in range(len(values) - window + 1)]


def normal_cdf(value: float) -> float:
    return 0.5 * (1.0 + math.erf(value / math.sqrt(2.0)))


def welch_like_site_p_value(groups: Sequence[Sequence[float]]) -> float:
    """Small dependency-free screening test for site imbalance.

    This is intentionally conservative and documented as a screening p-value, not a
    replacement for scipy.stats in a production validation environment.
    """
    groups = [list(group) for group in groups if group]
    if len(groups) < 2:
        return 1.0
    grand = average([value for group in groups for value in group])
    between = sum(len(group) * (average(group) - grand) ** 2 for group in groups)
    within = sum(sum((value - average(group)) ** 2 for value in group) for group in groups)
    df_between = len(groups) - 1
    df_within = max(sum(len(group) for group in groups) - len(groups), 1)
    if within == 0:
        return 0.0 if between > 0 else 1.0
    f_stat = (between / df_between) / (within / df_within)
    # For the four-site case, use the conservative normal-tail approximation.
    z = math.sqrt(max(f_stat * df_between, 0.0))
    return min(1.0, max(0.0, 2.0 * (1.0 - normal_cdf(z))))
