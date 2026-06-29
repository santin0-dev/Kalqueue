import json
import os
import tempfile
from typing import Any

import requests
import uvicorn
from fastapi import FastAPI, File, Form, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from faster_whisper import WhisperModel


WHISPER_MODEL = os.getenv("WHISPER_MODEL", "tiny")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:1b")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434").rstrip("/")
WHISPER_LANGUAGE = os.getenv("WHISPER_LANGUAGE", "").strip() or None
CPU_THREADS = int(os.getenv("WHISPER_CPU_THREADS", "2"))
PORT = int(os.getenv("AI_SERVICE_PORT", "8765"))

app = FastAPI(title="KalQueue Local AI Charting")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)

whisper_model: WhisperModel | None = None


def get_whisper_model() -> WhisperModel:
    global whisper_model
    if whisper_model is None:
        whisper_model = WhisperModel(
            WHISPER_MODEL,
            device="cpu",
            compute_type="int8",
            cpu_threads=CPU_THREADS,
            num_workers=1,
        )
    return whisper_model


def extract_json(text: str) -> dict[str, Any]:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        start = text.find("{")
        end = text.rfind("}")
        if start >= 0 and end > start:
            try:
                return json.loads(text[start : end + 1])
            except json.JSONDecodeError:
                pass

    return {
        "summary": text.strip(),
        "keyPoints": [],
        "prescription": "",
        "followUpDate": "",
    }


def normalize_key_points(value: Any) -> list[str]:
    if not value:
        return []

    if isinstance(value, str):
        return [value.strip()] if value.strip() else []

    if isinstance(value, list):
        points: list[str] = []
        for item in value:
            if isinstance(item, str) and item.strip():
                points.append(item.strip())
            elif isinstance(item, dict):
                description = item.get("description") or item.get("text") or item.get("label")
                if description:
                    points.append(str(description).strip())
        return [point for point in points if point]

    return []


def build_findings(summary: str, key_points: list[str]) -> str:
    sections: list[str] = []
    if summary:
        sections.append(f"Summary:\n{summary}")

    if key_points:
        bullets = "\n".join(f"- {point}" for point in key_points)
        sections.append(f"Key points:\n{bullets}")

    return "\n\n".join(sections).strip()


def format_chart(transcript: str, context: str) -> dict[str, Any]:
    prompt = f"""
Convert this patient/doctor transcript into concise draft charting.

Rules:
- Do not invent symptoms, diagnoses, medicines, doses, dates, or test results.
- Mention uncertainty when unclear.
- Return only valid JSON with keys: summary, keyPoints, prescription, followUpDate.
- summary must be 1-3 plain English sentences.
- keyPoints must be an array of short strings, not objects.
- Leave prescription/followUpDate blank if not clearly mentioned.

Context:
{context or "No extra context provided."}

Transcript:
{transcript}
"""

    response = requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "keep_alive": "10m",
            "options": {
                "temperature": 0.1,
                "num_ctx": 1024,
                "num_predict": 220,
            },
        },
        timeout=60,
    )
    response.raise_for_status()
    raw = response.json().get("response", "")
    chart = extract_json(raw)
    summary = str(chart.get("summary") or chart.get("findings") or "").strip()
    key_points = normalize_key_points(chart.get("keyPoints") or chart.get("keywords"))
    findings = build_findings(summary, key_points)

    return {
        "findings": findings,
        "summary": summary,
        "keyPoints": key_points,
        "prescription": str(chart.get("prescription") or "").strip(),
        "followUpDate": str(chart.get("followUpDate") or "").strip(),
    }


@app.get("/health")
def health() -> dict[str, str]:
    return {
        "status": "ok",
        "whisperModel": WHISPER_MODEL,
        "ollamaModel": OLLAMA_MODEL,
    }


@app.post("/warmup")
def warmup() -> dict[str, str]:
    get_whisper_model()
    requests.post(
        f"{OLLAMA_URL}/api/generate",
        json={
            "model": OLLAMA_MODEL,
            "prompt": "Return JSON only: {\"summary\":\"ready\",\"keyPoints\":[],\"prescription\":\"\",\"followUpDate\":\"\"}",
            "stream": False,
            "format": "json",
            "keep_alive": "10m",
            "options": {
                "temperature": 0,
                "num_predict": 40,
            },
        },
        timeout=60,
    ).raise_for_status()
    return {"status": "ready"}


@app.post("/chart")
async def chart(
    audio: UploadFile = File(...),
    context: str = Form(""),
) -> dict[str, Any]:
    suffix = os.path.splitext(audio.filename or "")[1] or ".webm"
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(await audio.read())
        audio_path = tmp.name

    try:
        model = get_whisper_model()
        segments, _ = model.transcribe(
            audio_path,
            beam_size=1,
            best_of=1,
            language=WHISPER_LANGUAGE,
            condition_on_previous_text=False,
            vad_filter=True,
            vad_parameters={
                "min_silence_duration_ms": 500,
            },
        )
        transcript = " ".join(segment.text.strip() for segment in segments).strip()

        if not transcript:
            return {
                "transcript": "",
                "findings": "",
                "prescription": "",
                "followUpDate": "",
                "error": "No speech detected.",
            }

        chart_result = format_chart(transcript, context)
        return {
            "transcript": transcript,
            **chart_result,
        }
    finally:
        try:
            os.remove(audio_path)
        except OSError:
            pass


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=PORT)
