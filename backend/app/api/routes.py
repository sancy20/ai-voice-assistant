from fastapi import APIRouter, Request, UploadFile, File, HTTPException, Depends
from fastapi.responses import JSONResponse
from app.state import asr_service
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.token_service import charge_user_tokens

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
from app.services.assistant_router import normalize_intent_result, build_action_and_message
from app.services.assistant_response_builder import build_success_response, build_clarification_response
from app.services.audio_pipeline import finalize_utterance
from app.services.state_manager import get_session

router = APIRouter()

@router.get("/health")
async def health_check():
    return {
        "ok": True,
        "service": "ai-voice-assistant-backend",
        "asr_backend": "faster_whisper"
    }

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

@router.post("/assistant/query")
async def assistant_text_query(
    request: Request,
    user: User = Depends(get_current_user),
):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    text = (payload.get("text") or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    session_id = payload.get("session_id") or f"text_user_{user.id}"
    state_obj = get_session(session_id)
    state_obj.context["user_id"] = user.id
    
    response = finalize_utterance(state_obj, text)

    return response


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