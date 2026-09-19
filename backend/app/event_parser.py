"""SDK-independent ONEAPI event dispatcher.

The ACS SampleMonitor can delegate its ``consumeData(self, tc, data)`` method
to :class:`OneApiEventParser`.  This module intentionally does not import the
ACS SDK, so the dispatch and unknown-event behavior can be checked locally.
"""
from __future__ import annotations

from collections.abc import Callable
from typing import Any

from .oneapi_bridge import on_lot_start, on_multi_parametric, on_test_end, on_wafer_start
from .state import RuntimeState, runtime_state
from .worker import EventWorker


MEASURED_PARAMETRIC = "DATA_TYP_MEASURED_PARAMETRIC"
MEASURED_MULTI_PARAM = "DATA_TYP_MEASURED_MULTI_PARAM"


def _event_type(data: Any) -> str:
    value = data.getType()
    return str(getattr(value, "name", value)).upper()


def _set_message_from_tc(tc: Any) -> Callable[[str, str], None] | None:
    """Build the ActionManager callback without assuming the SDK import path."""
    action_manager = getattr(tc, "ActionManager", None) if tc is not None else None
    setter = getattr(action_manager, "set_message", None)
    if setter is None:
        return None

    def set_message(tester_id: str, message: str) -> None:
        setter(tester_id, message)

    return set_message


class OneApiEventParser:
    def __init__(
        self,
        state: RuntimeState = runtime_state,
        to_site: Callable[[Any], int] | None = None,
        worker: EventWorker | None = None,
    ) -> None:
        self.state = state
        self.to_site = to_site or (lambda value: int(value))
        self.worker = worker

    def consume_data(self, tc: Any, data: Any) -> str:
        """Dispatch one callback and return a small processing status."""
        if self.worker is not None:
            self.worker.submit(lambda: self._consume_data(tc, data))
            return "QUEUED"
        return self._consume_data(tc, data)

    def _consume_data(self, tc: Any, data: Any) -> str:
        """Synchronous dispatch used by the worker and local tests."""
        event_type = _event_type(data)
        if event_type.endswith("LOTSTART"):
            on_lot_start(data, self.state)
            return "LOTSTART"
        if event_type.endswith("WAFERSTART"):
            on_wafer_start(data, self.state)
            return "WAFERSTART"
        if event_type.endswith(MEASURED_MULTI_PARAM):
            on_multi_parametric(data, self.to_site, _set_message_from_tc(tc), self.state)
            return MEASURED_MULTI_PARAM
        if event_type.endswith(MEASURED_PARAMETRIC):
            # Parametric events use the same normalized event shape as multi-param
            # events in the current bridge; only their SDK getter differs.
            from .oneapi_bridge import on_parametric

            on_parametric(data, self.to_site, _set_message_from_tc(tc), self.state)
            return MEASURED_PARAMETRIC
        if event_type.endswith("TESTEND"):
            on_test_end(data, self.to_site, self.state)
            return "TESTEND"
        if event_type.endswith("WAFEREND"):
            self.state.finish_wafer()
            return "WAFEREND"
        return "IGNORED"


def consumeData(self: Any, tc: Any, data: Any) -> str:
    """Drop-in function shape for a SampleMonitor implementation."""
    return OneApiEventParser().consume_data(tc, data)
