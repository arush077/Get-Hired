from abc import ABC, abstractmethod


class InterviewStrategy(ABC):
    @abstractmethod
    def get_initial_planning_instructions(self) -> str:
        """Mode-specific instructions appended to the shared topic planning prompt."""

    @abstractmethod
    def get_runtime_instructions(self) -> str:
        """Mode-specific instructions appended to the shared runtime (classify+decide) prompt."""

    @abstractmethod
    def get_evaluation_instructions(self) -> str:
        """Mode-specific instructions appended to the shared analysis prompt."""
