import json
from uuid import UUID

from domain.resume import Resume, ResumeEducation, ResumeExperience, ResumeProject
from infrastructure.repositories.base import ResumeRepositoryInterface


class ResumeService:
    def __init__(self, repository: ResumeRepositoryInterface):
        self._repo = repository

    async def create_resume(self, user_id: UUID, data: dict) -> Resume:
        resume = Resume(
            user_id=user_id,
            title=data.get("title", "Untitled Resume"),
            personal_info=data.get("personal_info", {}),
            skills=data.get("skills", ""),
            template=data.get("template", "classic"),
            section_order=data.get("section_order", ["education", "skills", "experience", "projects"]),
            education=[
                ResumeEducation(
                    college=e.get("college", ""),
                    degree=e.get("degree", ""),
                    cgpa=e.get("cgpa", ""),
                    start_year=e.get("startYear", e.get("start_year", "")),
                    end_year=e.get("endYear", e.get("end_year", "")),
                )
                for e in data.get("education", [])
            ],
            experience=[
                ResumeExperience(
                    company=e.get("company", ""),
                    role=e.get("role", ""),
                    description=e.get("description", ""),
                )
                for e in data.get("experience", [])
            ],
            projects=[
                ResumeProject(
                    name=p.get("name", ""),
                    technologies=p.get("technologies", ""),
                    description=p.get("description", ""),
                )
                for p in data.get("projects", [])
            ],
        )
        return await self._repo.create(resume)

    async def get_resume(self, resume_id: UUID, user_id: UUID) -> Resume | None:
        return await self._repo.get(resume_id, user_id)

    async def list_resumes(self, user_id: UUID) -> list[dict]:
        return await self._repo.list_by_user(user_id)

    async def update_resume(self, resume_id: UUID, user_id: UUID, data: dict) -> Resume | None:
        existing = await self._repo.get(resume_id, user_id)
        if not existing:
            return None

        existing.title = data.get("title", existing.title)
        existing.personal_info = data.get("personal_info", existing.personal_info)
        existing.skills = data.get("skills", existing.skills)
        existing.template = data.get("template", existing.template)
        existing.section_order = data.get("section_order", existing.section_order)

        if "education" in data:
            existing.education = [
                ResumeEducation(
                    id=UUID(e.get("id")) if e.get("id") else None,
                    resume_id=resume_id,
                    sort_order=i,
                    college=e.get("college", ""),
                    degree=e.get("degree", ""),
                    cgpa=e.get("cgpa", ""),
                    start_year=e.get("startYear", e.get("start_year", "")),
                    end_year=e.get("endYear", e.get("end_year", "")),
                )
                for i, e in enumerate(data["education"])
            ]

        if "experience" in data:
            existing.experience = [
                ResumeExperience(
                    id=UUID(e.get("id")) if e.get("id") else None,
                    resume_id=resume_id,
                    sort_order=i,
                    company=e.get("company", ""),
                    role=e.get("role", ""),
                    description=e.get("description", ""),
                )
                for i, e in enumerate(data["experience"])
            ]

        if "projects" in data:
            existing.projects = [
                ResumeProject(
                    id=UUID(p.get("id")) if p.get("id") else None,
                    resume_id=resume_id,
                    sort_order=i,
                    name=p.get("name", ""),
                    technologies=p.get("technologies", ""),
                    description=p.get("description", ""),
                )
                for i, p in enumerate(data["projects"])
            ]

        return await self._repo.update(existing)

    async def delete_resume(self, resume_id: UUID, user_id: UUID) -> bool:
        return await self._repo.delete(resume_id, user_id)

    def reconstruct_resume_text(self, resume: Resume) -> str:
        """Convert structured resume to plain text for RAG ingestion."""
        return resume.to_text()
