import json
import logging
import re
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from api.contracts import (
    CreateResumeRequest,
    UpdateResumeRequest,
    ResumeResponse,
    ResumeListResponse,
    DeleteResponse,
    GenerateDescriptionRequest,
    GenerateDescriptionResponse,
    AnalyzeResumeRequest,
)
from application.resume_service import ResumeService
from application.llm_service import LLMService
from api.dependencies import get_resume_service, get_llm_service
from application.rate_limiter import limiter, _user_key

router = APIRouter(prefix="/api/resumes", tags=["resumes"])


def _get_user_id(request: Request) -> UUID:
    user = request.state.user
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return UUID(user["id"])


@router.get("", response_model=ResumeListResponse)
async def list_resumes(
    request: Request,
    service: ResumeService = Depends(get_resume_service),
):
    user_id = _get_user_id(request)
    resumes = await service.list_resumes(user_id)
    return {"resumes": resumes}


@router.post("", response_model=ResumeResponse, status_code=201)
async def create_resume(
    request: Request,
    payload: CreateResumeRequest,
    service: ResumeService = Depends(get_resume_service),
):
    user_id = _get_user_id(request)
    resume = await service.create_resume(user_id, payload.model_dump())
    return ResumeResponse.from_domain(resume)


@router.get("/{resume_id}", response_model=ResumeResponse)
async def get_resume(
    resume_id: str,
    request: Request,
    service: ResumeService = Depends(get_resume_service),
):
    user_id = _get_user_id(request)
    try:
        uid = UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    resume = await service.get_resume(uid, user_id)
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return ResumeResponse.from_domain(resume)


@router.put("/{resume_id}", response_model=ResumeResponse)
async def update_resume(
    resume_id: str,
    request: Request,
    payload: UpdateResumeRequest,
    service: ResumeService = Depends(get_resume_service),
):
    user_id = _get_user_id(request)
    try:
        uid = UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    resume = await service.update_resume(uid, user_id, payload.model_dump(exclude_unset=True))
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return ResumeResponse.from_domain(resume)


@router.delete("/{resume_id}", response_model=DeleteResponse)
async def delete_resume(
    resume_id: str,
    request: Request,
    service: ResumeService = Depends(get_resume_service),
):
    user_id = _get_user_id(request)
    try:
        uid = UUID(resume_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid resume ID")

    deleted = await service.delete_resume(uid, user_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Resume not found")
    return {"message": "Resume deleted"}


@router.post("/ai/generate", response_model=GenerateDescriptionResponse)
@limiter.limit("5/minute", key_func=_user_key)
async def generate_description(
    request: Request,
    payload: GenerateDescriptionRequest,
    llm: LLMService = Depends(get_llm_service),
):
    _get_user_id(request)  # require auth

    if payload.type not in ("experience", "projects"):
        raise HTTPException(status_code=400, detail="type must be 'experience' or 'projects'")

    if payload.type == "experience":
        prompt = (
            f"Write a professional resume description for the role of {payload.role or 'a team member'} "
            f"at {payload.company or 'a company'}.\n"
            "Write 3-4 bullet points focused on achievements, responsibilities, and impact.\n"
            "Use action verbs and quantify results where possible.\n"
            "Keep each bullet concise and professional.\n"
            "Return only the bullet points, one per line, starting with '-'."
        )
    else:
        prompt = (
            f"Write a professional resume description for a project called {payload.name or 'a project'} "
            f"using {payload.technologies or 'modern technologies'}.\n"
            "Write 2-3 bullet points describing the purpose, technologies used, and key outcomes.\n"
            "Keep each bullet concise and professional.\n"
            "Return only the bullet points, one per line, starting with '-'."
        )

    description = await llm.generate_content(prompt)
    return {"description": description}


@router.post("/ai/analyze")
@limiter.limit("1/minute", key_func=_user_key)
async def analyze_resume(
    request: Request,
    payload: AnalyzeResumeRequest,
    llm: LLMService = Depends(get_llm_service),
):
    _get_user_id(request)  # require auth

    resume_data = payload.model_dump()
    if not resume_data:
        raise HTTPException(status_code=400, detail="Resume data is required")

    prompt = _build_analysis_prompt(resume_data)

    logger = logging.getLogger(__name__)

    try:
        raw = await llm.generate_content(prompt, max_tokens=4096)
    except Exception as e:
        logger.error("[ANALYZE] LLM call failed: %s", e)
        raise HTTPException(status_code=500, detail=f"AI service error: {type(e).__name__}")

    if not raw or not raw.strip():
        raise HTTPException(status_code=500, detail="AI returned empty response")

    try:
        analysis = json.loads(raw)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", raw)
        if match:
            try:
                analysis = json.loads(match.group(0))
            except json.JSONDecodeError:
                logger.error("[ANALYZE] Failed to parse extracted JSON: %s", raw[:300])
                raise HTTPException(status_code=500, detail="AI returned malformed JSON")
        else:
            logger.error("[ANALYZE] No JSON found in response: %s", raw[:300])
            raise HTTPException(status_code=500, detail="AI did not return valid analysis")

    return analysis


def _build_analysis_prompt(resume: dict) -> str:
    personal_info = resume.get("personal_info", {})
    education = resume.get("education", [])
    experience = resume.get("experience", [])
    projects = resume.get("projects", [])
    skills = resume.get("skills", "")

    return f"""You are an expert resume reviewer with experience in recruiting, ATS optimization, technical hiring, and professional writing.

Analyze the provided resume as if it were being submitted to a highly competitive company. Be objective, constructive, and critical.

Review the resume in the following areas:

Spelling & Grammar: Identify spelling, grammar, punctuation, capitalization, and awkward wording issues.
Formatting & Readability: Evaluate layout, section order, consistency, spacing, bullet formatting, and overall readability.
ATS Compatibility: Check for ATS-friendly formatting, standard section headings, keyword usage, parsing issues, and any elements that could cause problems.
Content Quality: Review each section (Education, Experience, Projects, Skills, etc.) for clarity, relevance, completeness, and impact.
Bullet Points: Identify weak, vague, repetitive, or passive bullet points and suggest stronger rewrites using impactful action verbs. Do not invent achievements or metrics.
Quantification: Highlight where measurable results or metrics could strengthen the resume and suggest the type of metrics that should be added.
Technical Evaluation: Verify that technologies are used appropriately, demonstrate sufficient depth, and are not overstated.
Consistency: Check for inconsistencies in dates, tense, formatting, punctuation, capitalization, and writing style.
Keywords: Identify missing or weak role-specific keywords that could improve ATS performance.
Recruiter Perspective: Summarize the first impression, strongest aspects, weakest aspects, and whether anything would make a recruiter hesitate.

Return ONLY valid JSON with no markdown formatting or code blocks. Use this exact structure:
{{
  "spelling_issues": [
    {{ "field": "experience.0.description", "text": "the text with the error", "suggestion": "corrected text" }}
  ],
  "grammar_issues": [
    {{ "field": "experience.0.description", "text": "the text with the issue", "suggestion": "improved text" }}
  ],
  "content_improvements": [
    {{ "section": "Experience", "issue": "description of the problem", "suggestion": "how to fix it" }}
  ]
}}
If there are no issues in a category, return an empty array. Never fabricate information, achievements, responsibilities, or metrics. If information is missing, clearly state what additional details would strengthen the resume.

Resume:
Personal Info: {json.dumps(personal_info)}
Education: {json.dumps(education)}
Experience: {json.dumps(experience)}
Projects: {json.dumps(projects)}
Skills: {skills}"""
