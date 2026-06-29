# KalQueue Local AI Charting Service

This service runs on the doctor's laptop. It receives recorded audio from the doctor page, uses Whisper to transcribe it, then asks Ollama to turn the transcript into clear draft charting.

## Low-RAM Demo Setup

Use small models first:

- Whisper: `tiny` or `base`
- Ollama: `llama3.2:1b` or another small local model

## Install

```bash
cd local-ai-service
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

Make sure Ollama is running, then pull a small model:

```bash
ollama pull llama3.2:1b
```

## Run

```bash
python server.py
```

The doctor dashboard will call:

```txt
http://localhost:8765/chart
```

Optional environment variables:

```txt
WHISPER_MODEL=tiny
WHISPER_LANGUAGE=
WHISPER_CPU_THREADS=2
OLLAMA_MODEL=llama3.2:1b
OLLAMA_URL=http://localhost:11434
AI_SERVICE_PORT=8765
```

Leave `WHISPER_LANGUAGE` blank for auto-detection. If everyone will speak English only, set it to `en` for slightly faster transcription.

For a faster demo, run the warmup once before opening the doctor charting modal:

```bash
curl -X POST http://localhost:8765/warmup
```

## Notes

The generated charting is a draft. The doctor should review it before saving the consultation record.
