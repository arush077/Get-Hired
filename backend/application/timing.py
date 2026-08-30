import logging
import time
from contextlib import asynccontextmanager
from typing import AsyncIterator

logger = logging.getLogger(__name__)


class Timer:
    """Simple named timer for instrumenting async operations."""

    def __init__(self, label: str):
        self.label = label
        self.start: float = 0
        self.elapsed: float = 0

    def __enter__(self):
        self.start = time.perf_counter()
        return self

    def __exit__(self, *_):
        self.elapsed = time.perf_counter() - self.start

    @asynccontextmanager
    async def measure(self) -> AsyncIterator["Timer"]:
        self.start = time.perf_counter()
        try:
            yield self
        finally:
            self.elapsed = time.perf_counter() - self.start


class StepTimer:
    """Collects named timing steps and logs a summary."""

    def __init__(self, operation: str):
        self.operation = operation
        self.steps: list[tuple[str, float]] = []
        self._start = time.perf_counter()

    def step(self, label: str, elapsed: float):
        self.steps.append((label, elapsed))

    def log_summary(self):
        total = time.perf_counter() - self._start
        parts = [f"[{self.operation}] total: {total:.2f}s"]
        for label, elapsed in self.steps:
            parts.append(f"  {label}: {elapsed:.2f}s")
        logger.info("\n".join(parts))
