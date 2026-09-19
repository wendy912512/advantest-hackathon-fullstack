"""Background worker for keeping ONEAPI callbacks short."""
from __future__ import annotations

from collections.abc import Callable
from queue import Queue
from threading import Event, Thread


class EventWorker:
    """Run state updates and heavier analysis outside ``consumeData``."""

    def __init__(self) -> None:
        self._queue: Queue[Callable[[], None] | None] = Queue()
        self._stop = Event()
        self._thread: Thread | None = None

    def start(self) -> None:
        if self._thread and self._thread.is_alive():
            return
        self._stop.clear()
        self._thread = Thread(target=self._run, name="oneapi-event-worker", daemon=True)
        self._thread.start()

    def submit(self, task: Callable[[], None]) -> None:
        if self._stop.is_set():
            raise RuntimeError("EventWorker has been stopped")
        self._queue.put(task)

    def stop(self, timeout: float = 2.0) -> None:
        self._stop.set()
        self._queue.put(None)
        if self._thread:
            self._thread.join(timeout=timeout)

    def _run(self) -> None:
        while not self._stop.is_set():
            task = self._queue.get()
            if task is None:
                return
            try:
                task()
            finally:
                self._queue.task_done()
