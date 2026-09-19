from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass
from typing import Iterable

from .config import RuleConfig
from .models import Alert, AnomalyType, Measurement
from .stats import (
    average,
    linear_regression,
    rolling_standard_deviations,
    standard_deviation,
    welch_like_site_p_value,
)


@dataclass(frozen=True)
class RuleResult:
    alerts: tuple[Alert, ...]


class AnomalyEngine:
    """同時支援離線整片 wafer 與即時累積資料的純規則引擎。"""

    def __init__(self, config: RuleConfig | None = None) -> None:
        self.config = config or RuleConfig()

    def evaluate_measurement(self, measurement: Measurement) -> RuleResult:
        if measurement.low_limit is None and measurement.high_limit is None:
            return RuleResult(())
        outside_low = measurement.low_limit is not None and measurement.value < measurement.low_limit
        outside_high = measurement.high_limit is not None and measurement.value > measurement.high_limit
        if not (outside_low or outside_high):
            return RuleResult(())
        limit = measurement.low_limit if outside_low else measurement.high_limit
        side = "低於 low limit" if outside_low else "高於 high limit"
        return RuleResult(
            (
                Alert(
                    anomaly_type=AnomalyType.OUT_OF_SPEC,
                    severity="critical",
                    message=f"{measurement.test_name} {side}：{measurement.value:g}（limit {limit:g}）",
                    tester_id=measurement.tester_id,
                    lot_id=measurement.lot_id,
                    wafer_id=measurement.wafer_id,
                    test_name=measurement.test_name,
                    site=measurement.site,
                    observed_value=measurement.value,
                    threshold=limit,
                    evidence={"lowLimit": measurement.low_limit, "highLimit": measurement.high_limit},
                ),
            )
        )

    def evaluate_wafer(self, measurements: Iterable[Measurement]) -> RuleResult:
        values = list(measurements)
        if not values:
            return RuleResult(())
        first = values[0]
        alerts: list[Alert] = []
        alerts.extend(self._low_yield(values))
        alerts.extend(self._site_unbalance(values))
        alerts.extend(self._trend_alerts(values))
        return RuleResult(tuple(alerts))

    def _low_yield(self, values: list[Measurement]) -> list[Alert]:
        classified = [value for value in values if value.soft_bin is not None]
        if len(classified) < self.config.yield_min_samples:
            return []
        good = sum(value.soft_bin not in self.config.bad_soft_bins for value in classified)
        pass_rate = good / len(classified)
        if pass_rate >= self.config.yield_threshold:
            return []
        first = values[0]
        return [
            Alert(
                anomaly_type=AnomalyType.LOW_YIELD,
                severity="critical",
                message=f"Wafer 良率 {pass_rate:.1%} 低於 {self.config.yield_threshold:.0%}",
                tester_id=first.tester_id,
                lot_id=first.lot_id,
                wafer_id=first.wafer_id,
                observed_value=pass_rate,
                threshold=self.config.yield_threshold,
                evidence={"tested": len(classified), "badSoftBins": sorted(self.config.bad_soft_bins)},
            ),
        ]

    def _site_unbalance(self, values: list[Measurement]) -> list[Alert]:
        yield_alert = self._site_yield_unbalance(values)
        by_test_site: dict[str, dict[int, list[float]]] = defaultdict(lambda: defaultdict(list))
        for value in values:
            if value.test_name.startswith("__ROW_"):
                continue
            by_test_site[value.test_name][value.site].append(value.value)
        alerts: list[Alert] = list(yield_alert)
        for test_name, by_site in by_test_site.items():
            eligible = {site: data for site, data in by_site.items() if len(data) >= self.config.site_min_samples}
            if len(eligible) < 2:
                continue
            groups = list(eligible.values())
            p_value = welch_like_site_p_value(groups)
            means = {site: average(data) for site, data in eligible.items()}
            pooled_std = standard_deviation([item for data in groups for item in data])
            max_pair = max(means.items(), key=lambda item: item[1])
            min_pair = min(means.items(), key=lambda item: item[1])
            difference = max_pair[1] - min_pair[1]
            if p_value >= self.config.site_p_value or difference <= self.config.site_sigma * pooled_std:
                continue
            first = values[0]
            alerts.append(
                Alert(
                    anomaly_type=AnomalyType.SITE_UNBALANCE,
                    severity="warning",
                    message=f"{test_name} 的 Site 平均值不平衡：Site {max_pair[0]} 與 Site {min_pair[0]} 相差 {difference:.4g}",
                    tester_id=first.tester_id,
                    lot_id=first.lot_id,
                    wafer_id=first.wafer_id,
                    test_name=test_name,
                    evidence={"pValue": p_value, "siteMeans": means, "pooledStd": pooled_std},
                )
            )
        return alerts

    def _site_yield_unbalance(self, values: list[Measurement]) -> list[Alert]:
        """Detect a site-level bin/yield imbalance before looking at analog values."""
        by_site: dict[int, dict[int, Measurement]] = defaultdict(dict)
        for value in values:
            if value.soft_bin is None or value.touchdown_index is None:
                continue
            # One device can produce many test measurements; retain one bin per site/device.
            by_site[value.site].setdefault(value.touchdown_index, value)
        rates = {
            site: sum(item.soft_bin not in self.config.bad_soft_bins for item in devices.values()) / len(devices)
            for site, devices in by_site.items()
            if len(devices) >= self.config.site_min_samples
        }
        ordered_rates = sorted(rates.values())
        if (
            len(rates) < 2
            or ordered_rates[0] > 0.8500000001
            or not all(rate > 0.90 for rate in ordered_rates[1:])
            or ordered_rates[-1] - ordered_rates[0] < self.config.site_yield_difference - 1e-9
        ):
            return []
        first = values[0]
        return [
            Alert(
                anomaly_type=AnomalyType.SITE_UNBALANCE,
                severity="warning",
                message=f"Site 良率不平衡：最高 {max(rates.values()):.1%}、最低 {min(rates.values()):.1%}",
                tester_id=first.tester_id,
                lot_id=first.lot_id,
                wafer_id=first.wafer_id,
                evidence={"sitePassRates": rates, "difference": max(rates.values()) - min(rates.values())},
            ),
        ]

    def _trend_alerts(self, values: list[Measurement]) -> list[Alert]:
        alerts = self._aggregate_trend_alerts(values)
        by_test: dict[str, list[Measurement]] = defaultdict(list)
        for value in values:
            if value.test_name.startswith("__ROW_") or "profile_group" in value.metadata:
                continue
            by_test[value.test_name].append(value)
        for test_name, observations in by_test.items():
            ordered = sorted(observations, key=lambda item: (item.touchdown_index is None, item.touchdown_index or 0))
            samples = [item.value for item in ordered]
            if len(samples) < self.config.trend_min_points:
                continue
            slope, r_squared = linear_regression(samples)
            mean_value = average(samples)
            scale = abs(mean_value) or 1.0
            normalized_slope = slope / scale
            if r_squared >= self.config.trend_r2 and abs(normalized_slope) >= 0.001:
                anomaly_type = AnomalyType.MEAN_TREND_UP if normalized_slope > 0 else AnomalyType.MEAN_TREND_DOWN
                first = ordered[0]
                alerts.append(
                    Alert(
                        anomaly_type=anomaly_type,
                        severity="warning",
                        message=f"{test_name} Mean Trend {'Up' if normalized_slope > 0 else 'Down'}：slope={slope:.4g}, R²={r_squared:.2f}",
                        tester_id=first.tester_id,
                        lot_id=first.lot_id,
                        wafer_id=first.wafer_id,
                        test_name=test_name,
                        evidence={"slope": slope, "normalizedSlope": normalized_slope, "r2": r_squared, "points": len(samples)},
                    )
                )
            if len(samples) < self.config.stdev_window + self.config.trend_min_points - 1:
                continue
            stdevs = rolling_standard_deviations(samples, self.config.stdev_window)
            stdev_slope, stdev_r2 = linear_regression(stdevs)
            stdev_scale = abs(average(stdevs)) or 1.0
            normalized_stdev_slope = stdev_slope / stdev_scale
            if stdev_r2 >= self.config.trend_r2 and abs(normalized_stdev_slope) >= 0.01:
                anomaly_type = AnomalyType.STDEV_TREND_UP if normalized_stdev_slope > 0 else AnomalyType.STDEV_TREND_DOWN
                first = ordered[0]
                alerts.append(
                    Alert(
                        anomaly_type=anomaly_type,
                        severity="warning",
                        message=f"{test_name} Stdev Trend {'Up' if normalized_stdev_slope > 0 else 'Down'}：slope={stdev_slope:.4g}, R²={stdev_r2:.2f}",
                        tester_id=first.tester_id,
                        lot_id=first.lot_id,
                        wafer_id=first.wafer_id,
                        test_name=test_name,
                        evidence={"slope": stdev_slope, "normalizedSlope": normalized_stdev_slope, "r2": stdev_r2, "window": self.config.stdev_window},
                    )
                )
        return alerts

    def _aggregate_trend_alerts(self, values: list[Measurement]) -> list[Alert]:
        """Detect the labeled wafer-level mean/stdev drift over device order.

        A single device contributes many test values. Aggregating those values per
        touchdown is the useful first-pass signal for the training labels; the
        production adapter can later replace ``touchdown_index`` with event time.
        """
        grouped: dict[str, dict[str, dict[int, list[float]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )
        for value in values:
            if value.touchdown_index is not None:
                group = value.metadata.get("profile_group", "__DEVICE__")
                kind = value.metadata.get("aggregate_series", "raw")
                grouped[group][kind][value.touchdown_index].append(value.value)
        first = values[0]
        alerts: list[Alert] = []
        for group, series in grouped.items():
            mean_groups = series.get("mean", {})
            if group == "__DEVICE__" and len(mean_groups) >= self.config.trend_min_points:
                means = [average(mean_groups[index]) for index in sorted(mean_groups)]
                mean_slope, mean_r2 = linear_regression(means)
                normalized_mean_slope = mean_slope / (abs(average(means)) or 1.0)
                if mean_r2 >= 0.05 and abs(normalized_mean_slope) >= self.config.aggregate_mean_normalized_slope:
                    is_up = mean_slope < 0 if self.config.mean_trend_up_when_slope_negative else mean_slope > 0
                    alerts.append(Alert(
                        anomaly_type=AnomalyType.MEAN_TREND_UP if is_up else AnomalyType.MEAN_TREND_DOWN,
                        severity="warning",
                        message=f"Wafer Mean Trend {'Up' if is_up else 'Down'}：slope={mean_slope:.4g}, R²={mean_r2:.2f}",
                        tester_id=first.tester_id, lot_id=first.lot_id, wafer_id=first.wafer_id,
                        test_name=group,
                        evidence={"slope": mean_slope, "normalizedSlope": normalized_mean_slope, "r2": mean_r2, "points": len(means)},
                    ))
            stdev_groups = series.get("stdev", {})
            if group == "__DEVICE__" or len(stdev_groups) < self.config.trend_min_points:
                continue
            stdevs = [average(stdev_groups[index]) for index in sorted(stdev_groups)]
            stdev_slope, stdev_r2 = linear_regression(stdevs)
            normalized_stdev_slope = stdev_slope / (abs(average(stdevs)) or 1.0)
            if stdev_r2 >= self.config.profile_stdev_r2 and abs(normalized_stdev_slope) >= self.config.profile_stdev_normalized_slope:
                alerts.append(Alert(
                    anomaly_type=AnomalyType.STDEV_TREND_UP if stdev_slope > 0 else AnomalyType.STDEV_TREND_DOWN,
                    severity="warning",
                    message=f"{group} Stdev Trend {'Up' if stdev_slope > 0 else 'Down'}：slope={stdev_slope:.4g}, R²={stdev_r2:.2f}",
                    tester_id=first.tester_id, lot_id=first.lot_id, wafer_id=first.wafer_id,
                    test_name=group,
                    evidence={"slope": stdev_slope, "normalizedSlope": normalized_stdev_slope, "r2": stdev_r2, "window": 1},
                ))
        return alerts
