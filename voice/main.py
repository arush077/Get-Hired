from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

app = FastAPI(title="Voice Interview Prototype")

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

QUESTIONS = [
    "Tell me about yourself and your background.",
    "Describe a challenging project you worked on recently. What made it difficult?",
    "Where do you see yourself professionally in the next three years?",
]

answers: dict[int, dict] = {}


class AnswerIn(BaseModel):
    index: int
    answer: str


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.post("/api/interview/start")
async def start_interview():
    answers.clear()
    return {"total": len(QUESTIONS)}


@app.get("/api/questions")
async def get_questions():
    return {"questions": QUESTIONS}


@app.post("/api/answer")
async def submit_answer(payload: AnswerIn):
    if not 0 <= payload.index < len(QUESTIONS):
        raise HTTPException(status_code=400, detail="Invalid question index")
    answers[payload.index] = {
        "index": payload.index,
        "question": QUESTIONS[payload.index],
        "answer": payload.answer.strip(),
    }
    return {"saved": payload.index, "count": len(answers)}


@app.get("/api/results")
async def get_results():
    results = [answers[i] for i in sorted(answers)]
    return {"results": results}
