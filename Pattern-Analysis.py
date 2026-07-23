"""
FastAPI Server for Academic Integrity Analytics
Run: uvicorn server:app --reload --port 8000
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import re
import numpy as np

app = FastAPI(title="Integrity Analysis Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SubmissionPayload(BaseModel):
    fieldName: str
    submittedText: str
    textLength: int
    durationSeconds: float
    charactersPerMinute: float
    totalKeystrokes: int
    pasteCount: int
    focusLostCount: int

def calculate_burstiness(text: str) -> float:
    """
    Measures sentence length variation. Humans naturally vary sentence length 
    significantly (high variance/burstiness). LLMs tend to generate sentences 
    with uniform sentence lengths (low variance).
    """
    sentences = re.split(r'[.!?]+', text)
    sentences = [s.strip() for s in sentences if len(s.strip()) > 0]
    
    if len(sentences) <= 1:
        return 0.0
        
    lengths = [len(s.split()) for s in sentences]
    std_dev = float(np.std(lengths))
    mean_len = float(np.mean(lengths))
    
    if mean_len == 0:
        return 0.0
        
    # Variation coefficient
    return std_dev / mean_len

@app.post("/api/v1/analyze")
async def analyze_submission(data: SubmissionPayload):
    risk_factors = []
    risk_score = 0.0

    # Rule 1: Typing Speed Anomaly (CPM > 450 is highly suspicious without paste event)
    if data.charactersPerMinute > 450 and data.pasteCount == 0:
        risk_score += 40.0
        risk_factors.append("Implausible human typing speed (Automated injection suspected)")

    # Rule 2: Large Paste Execution
    if data.pasteCount > 0:
        risk_score += min(30.0, data.pasteCount * 15.0)
        risk_factors.append(f"Detected {data.pasteCount} paste operation(s)")

    # Rule 3: Excessive Window Switching
    if data.focusLostCount > 3:
        risk_score += min(20.0, data.focusLostCount * 5.0)
        risk_factors.append(f"Tab/Window focus lost {data.focusLostCount} times during response")

    # Rule 4: Low Burstiness (Uniform sentence length pattern common in synthetic text)
    burstiness = calculate_burstiness(data.submittedText)
    if len(data.submittedText) > 200 and burstiness < 0.2:
        risk_score += 25.0
        risk_factors.append("Low sentence variance (Linguistic pattern matches synthetic generation)")

    # Normalize final score
    final_score = min(100.0, risk_score)

    return {
        "fieldName": data.fieldName,
        "riskScore": final_score,
        "riskLevel": "HIGH" if final_score >= 60 else ("MEDIUM" if final_score >= 30 else "LOW"),
        "burstinessMetric": burstiness,
        "flaggedFactors": risk_factors
    }