from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from domain.resume import Resume, ResumeEducation, ResumeExperience, ResumeProject
from infrastructure.db.models import (
    ResumeEducationModel,
    ResumeExperienceModel,
    ResumeModel,
    ResumeProjectModel,
)
from infrastructure.db.session import get_session_factory
from infrastructure.repositories.base import ResumeRepositoryInterface


class PostgresResumeRepository(ResumeRepositoryInterface):
    def __init__(self):
        self._get_session_factory = get_session_factory

    async def create(self, resume: Resume) -> Resume:
        async with self._get_session_factory()() as session:
            async with session.begin():
                db_resume = ResumeModel(
                    id=resume.id,
                    user_id=resume.user_id,
                    title=resume.title,
                    personal_info=__import__("json").dumps(resume.personal_info),
                    skills=resume.skills,
                    template=resume.template,
                    section_order=__import__("json").dumps(resume.section_order),
                )
                session.add(db_resume)

                for i, edu in enumerate(resume.education):
                    session.add(
                        ResumeEducationModel(
                            id=edu.id,
                            resume_id=resume.id,
                            sort_order=i,
                            college=edu.college,
                            degree=edu.degree,
                            cgpa=edu.cgpa,
                            start_year=edu.start_year,
                            end_year=edu.end_year,
                        )
                    )

                for i, exp in enumerate(resume.experience):
                    session.add(
                        ResumeExperienceModel(
                            id=exp.id,
                            resume_id=resume.id,
                            sort_order=i,
                            company=exp.company,
                            role=exp.role,
                            description=exp.description,
                        )
                    )

                for i, proj in enumerate(resume.projects):
                    session.add(
                        ResumeProjectModel(
                            id=proj.id,
                            resume_id=resume.id,
                            sort_order=i,
                            name=proj.name,
                            technologies=proj.technologies,
                            description=proj.description,
                        )
                    )

        return resume

    async def get(self, resume_id: UUID, user_id: UUID) -> Resume | None:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(ResumeModel)
                .where(ResumeModel.id == resume_id, ResumeModel.user_id == user_id)
                .options(
                    selectinload(ResumeModel.education),
                    selectinload(ResumeModel.experience),
                    selectinload(ResumeModel.projects),
                )
            )
            db_resume = result.scalar_one_or_none()
            if not db_resume:
                return None
            return self._to_domain(db_resume)

    async def list_by_user(self, user_id: UUID) -> list[dict]:
        async with self._get_session_factory()() as session:
            result = await session.execute(
                select(ResumeModel)
                .where(ResumeModel.user_id == user_id)
                .order_by(ResumeModel.updated_at.desc())
            )
            db_resumes = result.scalars().all()
            return [
                {
                    "id": str(r.id),
                    "title": r.title,
                    "updated_at": r.updated_at.isoformat() if r.updated_at else None,
                }
                for r in db_resumes
            ]

    async def update(self, resume: Resume) -> Resume | None:
        async with self._get_session_factory()() as session:
            async with session.begin():
                result = await session.execute(
                    select(ResumeModel)
                    .where(ResumeModel.id == resume.id, ResumeModel.user_id == resume.user_id)
                    .options(
                        selectinload(ResumeModel.education),
                        selectinload(ResumeModel.experience),
                        selectinload(ResumeModel.projects),
                    )
                )
                db_resume = result.scalar_one_or_none()
                if not db_resume:
                    return None

                import json
                db_resume.title = resume.title
                db_resume.personal_info = json.dumps(resume.personal_info)
                db_resume.skills = resume.skills
                db_resume.template = resume.template
                db_resume.section_order = json.dumps(resume.section_order)

                # Replace education
                for old in db_resume.education:
                    await session.delete(old)
                for i, edu in enumerate(resume.education):
                    session.add(
                        ResumeEducationModel(
                            id=edu.id,
                            resume_id=resume.id,
                            sort_order=i,
                            college=edu.college,
                            degree=edu.degree,
                            cgpa=edu.cgpa,
                            start_year=edu.start_year,
                            end_year=edu.end_year,
                        )
                    )

                # Replace experience
                for old in db_resume.experience:
                    await session.delete(old)
                for i, exp in enumerate(resume.experience):
                    session.add(
                        ResumeExperienceModel(
                            id=exp.id,
                            resume_id=resume.id,
                            sort_order=i,
                            company=exp.company,
                            role=exp.role,
                            description=exp.description,
                        )
                    )

                # Replace projects
                for old in db_resume.projects:
                    await session.delete(old)
                for i, proj in enumerate(resume.projects):
                    session.add(
                        ResumeProjectModel(
                            id=proj.id,
                            resume_id=resume.id,
                            sort_order=i,
                            name=proj.name,
                            technologies=proj.technologies,
                            description=proj.description,
                        )
                    )

        return resume

    async def delete(self, resume_id: UUID, user_id: UUID) -> bool:
        async with self._get_session_factory()() as session:
            async with session.begin():
                result = await session.execute(
                    select(ResumeModel).where(
                        ResumeModel.id == resume_id,
                        ResumeModel.user_id == user_id,
                    )
                )
                db_resume = result.scalar_one_or_none()
                if not db_resume:
                    return False
                await session.delete(db_resume)
                return True

    def _to_domain(self, db_resume: ResumeModel) -> Resume:
        import json
        return Resume(
            id=db_resume.id,
            user_id=db_resume.user_id,
            title=db_resume.title,
            personal_info=json.loads(db_resume.personal_info) if db_resume.personal_info else {},
            skills=db_resume.skills or "",
            template=db_resume.template or "classic",
            section_order=json.loads(db_resume.section_order) if db_resume.section_order else [],
            education=[
                ResumeEducation(
                    id=e.id,
                    resume_id=e.resume_id,
                    sort_order=e.sort_order,
                    college=e.college,
                    degree=e.degree,
                    cgpa=e.cgpa,
                    start_year=e.start_year,
                    end_year=e.end_year,
                )
                for e in db_resume.education
            ],
            experience=[
                ResumeExperience(
                    id=e.id,
                    resume_id=e.resume_id,
                    sort_order=e.sort_order,
                    company=e.company,
                    role=e.role,
                    description=e.description,
                )
                for e in db_resume.experience
            ],
            projects=[
                ResumeProject(
                    id=p.id,
                    resume_id=p.resume_id,
                    sort_order=p.sort_order,
                    name=p.name,
                    technologies=p.technologies,
                    description=p.description,
                )
                for p in db_resume.projects
            ],
            created_at=db_resume.created_at,
            updated_at=db_resume.updated_at,
        )
