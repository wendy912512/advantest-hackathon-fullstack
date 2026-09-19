from __future__ import annotations

from collections.abc import Callable
from time import monotonic

from .models import Alert


class AlertManager:
    """告警去重、前端 sink 與 ONEAPI Action sink 的單一出口。"""

    def __init__(self, cooldown_seconds: float = 30.0) -> None:
        self.cooldown_seconds = cooldown_seconds
        self._last_sent: dict[tuple[str, str, str | None, int | None], float] = {}

    def publish(self, alert: Alert, set_message: Callable[[str, str], None] | None = None) -> bool:
        key = (alert.wafer_id, alert.anomaly_type.value, alert.test_name, alert.site)
        now = monotonic()
        if now - self._last_sent.get(key, float("-inf")) < self.cooldown_seconds:
            return False
        self._last_sent[key] = now
        if set_message is not None:
            set_message(alert.tester_id, alert.message)
        return True
