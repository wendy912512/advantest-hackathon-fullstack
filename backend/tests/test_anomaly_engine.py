import unittest

from app.anomaly_engine import AnomalyEngine
from app.models import AnomalyType, Measurement


def measurement(value: float, *, site: int = 1, index: int = 0, soft_bin: int = 1) -> Measurement:
    return Measurement(
        tester_id="testerA",
        lot_id="LOT-1",
        wafer_id="W01",
        site=site,
        test_name="sensor",
        value=value,
        low_limit=0.0,
        high_limit=10.0,
        touchdown_index=index,
        soft_bin=soft_bin,
    )


class AnomalyEngineTests(unittest.TestCase):
    def test_out_of_spec_is_immediate(self):
        result = AnomalyEngine().evaluate_measurement(measurement(11.0))
        self.assertEqual(result.alerts[0].anomaly_type, AnomalyType.OUT_OF_SPEC)

    def test_out_of_spec_message_contains_measurement_context(self):
        result = AnomalyEngine().evaluate_measurement(measurement(11.0))
        self.assertIn("sensor", result.alerts[0].message)
        self.assertIn("limit", result.alerts[0].message)

    def test_low_yield_uses_configured_bad_bin(self):
        values = [measurement(float(i), soft_bin=6 if i < 5 else 1) for i in range(20)]
        result = AnomalyEngine().evaluate_wafer(values)
        self.assertIn(AnomalyType.LOW_YIELD, {alert.anomaly_type for alert in result.alerts})

    def test_mean_trend_up(self):
        values = [measurement(1.0 + i * 0.1, index=i) for i in range(80)]
        result = AnomalyEngine().evaluate_wafer(values)
        self.assertIn(AnomalyType.MEAN_TREND_UP, {alert.anomaly_type for alert in result.alerts})

    def test_segment_stdev_down_requires_consecutive_changes(self):
        values = [
            Measurement(
                tester_id="testerA",
                lot_id="LOT-1",
                wafer_id="W25",
                site=0,
                test_name="Main.subflow1",
                value=value,
                touchdown_index=index,
                metadata={"profile_group": "Main.subflow1", "aggregate_series": "segment_stdev"},
            )
            for index, value in enumerate((1.0, 0.75, 0.55, 0.60))
        ]
        result = AnomalyEngine().evaluate_wafer(values)
        self.assertIn(AnomalyType.STDEV_TREND_DOWN, {alert.anomaly_type for alert in result.alerts})


if __name__ == "__main__":
    unittest.main()
