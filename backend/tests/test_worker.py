import threading
import unittest

from app.worker import EventWorker


class EventWorkerTests(unittest.TestCase):
    def test_submitted_task_runs_off_callback(self):
        worker = EventWorker()
        done = threading.Event()
        worker.start()
        worker.submit(done.set)
        self.assertTrue(done.wait(timeout=1))
        worker.stop()


if __name__ == "__main__":
    unittest.main()
