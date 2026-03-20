from fastapi import APIRouter, Request, Header
from app.services.audio_pipeline import process_audio_chunk, flush_session

router = APIRouter()

@router.post("/audio/chunk")
async def audio_chunk(
    request: Request,
    x_session_id: str = Header(None),
    x_sample_rate: str = Header(None),
    x_model_key: str = Header(None),
    x_wake_mode: str = Header(None),
):
    raw_bytes = await request.body()

    result = process_audio_chunk(
        session_id=x_session_id or "default",
        raw_bytes=raw_bytes,
        sample_rate=int(x_sample_rate or 16000),
        model_key=x_model_key,
        wake_mode=(x_wake_mode or "").lower() == "wake",
    )

    return result


@router.post("/flush")
async def flush(
    x_session_id: str = Header(None),
    x_sample_rate: str = Header(None),
    x_model_key: str = Header(None),
):
    result = flush_session(
        session_id=x_session_id or "default",
        sample_rate=int(x_sample_rate or 16000),
        model_key=x_model_key
    )
    return result