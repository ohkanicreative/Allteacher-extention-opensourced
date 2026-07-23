"""
Teacher Endpoint & Evaluation API Server
Run: uvicorn teacher_backend:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uuid
import re
import numpy as np

app = FastAPI(title="Teacher Monitoring & Evaluation API")

# Enable Cross-Origin Resource Sharing for extension and dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory database stores for active sessions and evaluated submissions
submission_database: Dict[str, Dict[str, Any]] = {}
active_heartbeats: Dict[str, float] = {}

# Pydantic Schemas
class PasteDetail(BaseModel):
    timestamp: float
    charCount: int
    snippet: str

class ResponseData(BaseModel):
    fieldId: str
    fieldName: str
    text: str
    textLength: int
    durationSeconds: float
    totalKeystrokes: int
    keystrokeIntervals: List[float]
    pasteEvents: List[PasteDetail]
    blurCount: int

class StudentSubmissionPayload(BaseModel):
    studentId: str
    examId: str
    submissionTime: float
    responses: List[ResponseData]

class HeartbeatPayload(BaseModel):
    studentId: str
    examId: str
    timestamp: float

# Analytical Helper Functions
def compute_burstiness(text: str) -> float:
    """Calculates variation in sentence length. Low variation indicates synthetic text."""
    sentences = [s.strip() for s in re.split(r'[.!?]+', text) if len(s.strip()) > 0]
    if len(sentences) <= 1:
        return 1.0
    lengths = [len(s.split()) for s in sentences]
    mean = np.mean(lengths)
    if mean == 0:
        return 0.0
    return float(np.std(lengths) / mean)

def evaluate_response_risk(resp: ResponseData) -> Dict[str, Any]:
    """Applies heuristic rules to evaluate individual field responses."""
    flags = []
    risk_score = 0.0

    # Calculate Characters Per Minute (CPM)
    cpm = (resp.textLength / (resp.durationSeconds / 60.0)) if resp.durationSeconds > 0 else 0

    # 1. Unusually fast typing velocity without paste recorded
    if cpm > 400 and len(resp.pasteEvents) == 0:
        risk_score += 45.0
        flags.append(f"Abnormally high typing speed ({int(cpm)} CPM) without clipboard events.")

    # 2. Paste event presence
    if len(resp.pasteEvents) > 0:
        total_pasted_chars = sum(p.charCount for p in resp.pasteEvents)
        risk_score += min(40.0, len(resp.pasteEvents) * 20.0)
        flags.append(f"Direct paste detected ({len(resp.pasteEvents)} event(s), {total_pasted_chars} chars).")

    # 3. Excessive tab switching / blur events
    if resp.blurCount > 2:
        risk_score += min(25.0, resp.blurCount * 5.0)
        flags.append(f"Window lost focus {resp.blurCount} times during composition.")

    # 4. Burstiness analysis (synthetic AI text check)
    burstiness = compute_burstiness(resp.text)
    if resp.textLength > 150 and burstiness < 0.18:
        risk_score += 25.0
        flags.append("Low sentence length variance (Signature AI structural uniform distribution).")

    return {
        "fieldId": resp.fieldId,
        "riskScore": min(100.0, risk_score),
        "cpm": round(cpm, 2),
        "burstiness": round(burstiness, 3),
        "flags": flags
    }

# API Endpoints
@app.post("/api/v1/student/heartbeat")
async def register_heartbeat(data: HeartbeatPayload):
    """Registers periodic connection check from active student session."""
    active_heartbeats[data.studentId] = data.timestamp
    return {"status": "ACK"}

@app.post("/api/v1/student/submit")
async def process_submission(payload: StudentSubmissionPayload):
    """Processes, evaluates, and stores student responses."""
    submission_id = f"SUB-{uuid.uuid4().hex[:8].upper()}"
    evaluated_responses = []
    total_risk = 0.0

    for resp in payload.responses:
        eval_result = evaluate_response_risk(resp)
        evaluated_responses.append({
            "fieldId": resp.fieldId,
            "text": resp.text,
            "metrics": eval_result
        })
        total_risk += eval_result["riskScore"]

    average_risk = total_risk / len(payload.responses) if payload.responses else 0.0

    record = {
        "submissionId": submission_id,
        "studentId": payload.studentId,
        "examId": payload.examId,
        "submissionTime": payload.submissionTime,
        "overallRiskScore": round(average_risk, 2),
        "status": "FLAGGED" if average_risk >= 35.0 else "CLEAR",
        "evaluatedResponses": evaluated_responses
    }

    submission_database[submission_id] = record
    return {"status": "SUCCESS", "submissionId": submission_id}

@app.get("/api/v1/teacher/submissions")
async def get_all_submissions():
    """Retrieves list of all evaluated student submissions for the dashboard."""
    return list(submission_database.values())

@app.get("/api/v1/teacher/submission/{submission_id}")
async def get_submission_detail(submission_id: str):
    """Retrieves full telemetry details for a single submission."""
    if submission_id not in submission_database:
        raise HTTPException(status_code=404, detail="Submission record not found")
    return submission_database[submission_id]