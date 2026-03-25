from fastapi import APIRouter, Request, UploadFile, File, HTTPException
from fastapi.responses import JSONResponse
from app.state import asr_service

from app.config import (
    WAKE_SR,
    WAKE_DURATION_SEC,
    WAKE_PROB_THRESHOLD,
    WAKE_AWAKE_WINDOW_SEC,
    WAKE_COOLDOWN_SEC,
    WAKE_N_MFCC,
)
from app.services.intent_service import predict_intent_rule_based
from app.services.model_service import WAKE_MODEL

router = APIRouter()


@router.get("/wake/info")
async def wake_info():
    return JSONResponse({
        "wake_model_loaded": bool(WAKE_MODEL is not None),
        "wake_sr": WAKE_SR,
        "wake_duration_sec": WAKE_DURATION_SEC,
        "wake_threshold": WAKE_PROB_THRESHOLD,
        "awake_window_sec": WAKE_AWAKE_WINDOW_SEC,
        "cooldown_sec": WAKE_COOLDOWN_SEC,
        "wake_n_mfcc": WAKE_N_MFCC,
    })


@router.post("/predict/intent")
async def predict_intent_endpoint(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}

    transcript = (payload.get("transcript") or "").strip()
    pred = predict_intent_rule_based(transcript)
    return JSONResponse(pred)

@router.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    try:
        audio_bytes = await file.read()
        filename = file.filename or "audio.webm"
        suffix = "." + filename.split(".")[-1].lower()

        result = asr_service.transcribe_bytes(
            audio_bytes,
            suffix=suffix,
            beam_size=1,
            vad_filter=False,  # keep off for first test
        )

        return {
            "ok": True,
            "text": result["text"],
            "segments": result["segments"],
            "language": result["language"],
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))