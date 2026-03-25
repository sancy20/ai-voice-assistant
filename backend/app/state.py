import time

session_text = {}
last_run_samples = {}
rolling_buffers = {}
utterance_buffers = {}
voice_active_flags = {}
silence_ms_accum = {}
preroll_buffers = {}
session_sample_rate = {}
wake_started_ts = {}
awake_until_ts = {}
wake_cooldown_until_ts = {}
wake_voice_seen = {}
command_armed_until_ts = {}
command_capture_started = {}
last_partial_ts = {}
last_partial_text = {}

from app.services.asr_faster_whisper import FasterWhisperASR
from app.config import (
    ASR_MODEL_SIZE,
    ASR_DEVICE,
    ASR_COMPUTE_TYPE,
    ASR_LANGUAGE,
)

asr_service = FasterWhisperASR(
    model_size=ASR_MODEL_SIZE,
    device=ASR_DEVICE,
    compute_type=ASR_COMPUTE_TYPE,
    language=ASR_LANGUAGE,
)

def now_ts() -> float:
    return time.time()


def is_awake(session_id: str) -> bool:
    return float(awake_until_ts.get(session_id, 0.0) or 0.0) > now_ts()


def set_awake(session_id: str, seconds: float):
    awake_until_ts[session_id] = now_ts() + float(seconds)


def in_cooldown(session_id: str) -> bool:
    return float(wake_cooldown_until_ts.get(session_id, 0.0) or 0.0) > now_ts()


def set_cooldown(session_id: str, seconds: float):
    wake_cooldown_until_ts[session_id] = now_ts() + float(seconds)