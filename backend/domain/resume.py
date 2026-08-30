from dataclasses import dataclass, field
from uuid import UUID, uuid4
from datetime import datetime, timezone


@dataclass
class ResumeEducation:
    id: UUID = field(default_factory=uuid4)
    resume_id: UUID = field(default_factory=uuid4)
    sort_order: int = 0
    college: str = ""
    degree: str = ""
    cgpa: str = ""
    start_year: str = ""
    end_year: str = ""


@dataclass
class ResumeExperience:
    id: UUID = field(default_factory=uuid4)
    resume_id: UUID = field(default_factory=uuid4)
    sort_order: int = 0
    company: str = ""
    role: str = ""
    description: str = ""


@dataclass
class ResumeProject:
    id: UUID = field(default_factory=uuid4)
    resume_id: UUID = field(default_factory=uuid4)
    sort_order: int = 0
    name: str = ""
    technologies: str = ""
    description: str = ""


@dataclass
class Resume:
    id: UUID = field(default_factory=uuid4)
    user_id: UUID = field(default_factory=uuid4)
    title: str = "Untitled Resume"
    personal_info: dict = field(default_factory=lambda: {
        "fullName": "",
        "email": "",
        "phone": "",
        "linkedin": "",
        "github": "",
    })
    skills: str = ""
    template: str = "classic"
    section_order: list[str] = field(default_factory=lambda: [
        "education", "skills", "experience", "projects"
    ])
    education: list[ResumeEducation] = field(default_factory=list)
    experience: list[ResumeExperience] = field(default_factory=list)
    projects: list[ResumeProject] = field(default_factory=list)
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_text(self) -> str:
        """Reconstruct plain text resume for RAG ingestion."""
        parts = []
        info = self.personal_info

        if info.get("fullName"):
            parts.append(f"Name: {info['fullName']}")
        if info.get("email"):
            parts.append(f"Email: {info['email']}")
        if info.get("phone"):
            parts.append(f"Phone: {info['phone']}")
        if info.get("linkedin"):
            parts.append(f"LinkedIn: {info['linkedin']}")
        if info.get("github"):
            parts.append(f"GitHub: {info['github']}")

        if self.education:
            parts.append("\nEducation:")
            for edu in self.education:
                line = f"- {edu.degree}"
                if edu.college:
                    line += f" at {edu.college}"
                if edu.cgpa:
                    line += f", CGPA: {edu.cgpa}"
                years = " - ".join(filter(None, [edu.start_year, edu.end_year]))
                if years:
                    line += f" ({years})"
                parts.append(line)

        if self.experience:
            parts.append("\nExperience:")
            for exp in self.experience:
                parts.append(f"- {exp.role}" + (f" at {exp.company}" if exp.company else ""))
                if exp.description:
                    parts.append(f"  {exp.description}")

        if self.projects:
            parts.append("\nProjects:")
            for proj in self.projects:
                line = f"- {proj.name}"
                if proj.technologies:
                    line += f" ({proj.technologies})"
                parts.append(line)
                if proj.description:
                    parts.append(f"  {proj.description}")

        if self.skills:
            parts.append(f"\nSkills: {self.skills}")

        return "\n".join(parts)
