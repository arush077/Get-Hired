from enum import Enum


class InterviewMode(str, Enum):
    RESUME_DEEP_DIVE = "RESUME_DEEP_DIVE"
    TECHNICAL = "TECHNICAL"
    HR_SCREENING = "HR_SCREENING"
    MIXED = "MIXED"
