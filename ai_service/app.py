from fastapi import FastAPI, Request, Header
from fastapi.responses import JSONResponse
from starlette.requests import ClientDisconnect

import os
import uuid
import subprocess
import wave
import re
import numpy as np
from datetime import datetime
import joblib

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

def get_local_tz():
    if ZoneInfo is not None:
        try:
            return ZoneInfo("Asia/Phnom_Penh")
        except Exception:
            pass
    from datetime import timezone, timedelta
    return timezone(timedelta(hours=7))

LOCAL_TZ = get_local_tz()

app = FastAPI()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SESSIONS_DIR = os.path.join(BASE_DIR, "sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)

WHISPER_BIN = os.path.normpath(
    os.path.join(BASE_DIR, "whisper.cpp", "whisper_bin", "whisper-cli.exe")
)

MODELS_DIR = os.path.normpath(os.path.join(BASE_DIR, "..", "models"))


def resolve_model_path(model_key: str | None) -> str:
    # Primary: use header selection
    if model_key:
        mk = str(model_key).strip()
        if mk:
            candidate = os.path.join(MODELS_DIR, f"ggml-{mk}.bin")
            if os.path.isfile(candidate):
                return candidate

    # Fallbacks
    for fallback in ("ggml-base.en.bin", "ggml-base.bin", "ggml-tiny.en.bin"):
        p = os.path.join(MODELS_DIR, fallback)
        if os.path.isfile(p):
            return p

    return ""


# intent model trained by you
INTENT_MODEL_PATH = os.path.join(BASE_DIR, "intent_pipeline.joblib")
INTENT_PIPELINE = None

TARGET_SR = int(os.getenv("TARGET_SR", "16000"))

print("[DEBUG] CWD:", os.getcwd())
print("[DEBUG] WHISPER_BIN:", WHISPER_BIN, "exists =", os.path.isfile(WHISPER_BIN))
print("[DEBUG] MODELS_DIR:", MODELS_DIR, "exists =", os.path.isdir(MODELS_DIR))
print("[DEBUG] INTENT_MODEL_PATH:", INTENT_MODEL_PATH, "exists =", os.path.isfile(INTENT_MODEL_PATH))

if os.path.isfile(INTENT_MODEL_PATH):
    try:
        INTENT_PIPELINE = joblib.load(INTENT_MODEL_PATH)
        print("[DEBUG] Loaded trained intent model:", INTENT_MODEL_PATH)
    except Exception as e:
        print("[ERROR] Failed to load intent model:", e)


# backend safety: only allow these “open” targets
SAFE_OPEN_TARGETS = {
    "chatgpt": ["chatgpt", "chat gpt", "chat g p t"],
    "openai": ["openai", "open ai"],
    "google": ["google"],
    "youtube": ["youtube", "you tube"],
    "github": ["github", "git hub"],
    "gmail": ["gmail", "g mail"],
    "facebook": ["facebook", "face book"],
    "wikipedia": ["wikipedia", "wiki pedia", "wiki"],
    "maps": ["google maps", "maps", "map"],
}

# Session buffers/state
session_text = {}
last_run_samples = {}
rolling_buffers = {}
utterance_buffers = {}
voice_active_flags = {}
silence_ms_accum = {}
preroll_buffers = {}
session_sample_rate = {}


def _bytes_to_i16(raw: bytes) -> np.ndarray:
    return np.frombuffer(raw or b"", dtype=np.int16)


def resample_i16_mono(x: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    """Simple linear resampler for mono int16."""
    if x.size == 0 or src_sr <= 0 or dst_sr <= 0 or src_sr == dst_sr:
        return x
    ratio = float(dst_sr) / float(src_sr)
    new_len = int(max(1, round(x.size * ratio)))
    xp = np.linspace(0.0, 1.0, num=x.size, endpoint=False, dtype=np.float64)
    xq = np.linspace(0.0, 1.0, num=new_len, endpoint=False, dtype=np.float64)
    y = np.interp(xq, xp, x.astype(np.float32)).astype(np.float32)
    return np.clip(y, -32768, 32767).astype(np.int16)


def write_wav_i16(path: str, i16: np.ndarray, sr: int) -> None:
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(int(sr))
        wf.writeframes(i16.tobytes())


def run_whisper_on_file(wav_path: str, model_path: str) -> str:
    """Runs whisper.cpp CLI and returns clean transcript."""
    if not os.path.isfile(WHISPER_BIN):
        print("[ERROR] whisper binary missing:", WHISPER_BIN)
        return ""
    if not model_path or not os.path.isfile(model_path):
        print("[ERROR] whisper model missing:", model_path)
        return ""

    cmd = [
        WHISPER_BIN,
        "-m", model_path,
        "-f", wav_path,
        "-l", "en",
        "-nt",
    ]

    def extract_transcript(raw: str) -> str:
        lines = raw.splitlines()
        out = []
        for ln in lines:
            s = ln.strip()
            if not s:
                continue
            # drop common logs
            if s.startswith((
                "whisper",
                "main:",
                "system_info",
                "threads",
                "processors",
                "beam",
                "lang =",
                "task =",
            )):
                continue
            # drop timestamped lines if present
            if "[" in s and "]" in s and "-->" in s:
                try:
                    s = s.split("] ", 1)[1].strip()
                except Exception:
                    continue
            if any(c.isalpha() for c in s):
                out.append(s)
        return " ".join(out).strip()

    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=45)
        raw = out.decode(errors="ignore")
        return extract_transcript(raw)
    except Exception as e:
        print("[ERROR] whisper call failed:", e)
        return ""


def normalize_text(text: str) -> str:
    t = (text or "").lower().strip()
    t = re.sub(r"[\.,!?;:\(\)\[\]\{\}\"']", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def match_open_target(t: str) -> str:
    for key, variants in SAFE_OPEN_TARGETS.items():
        for v in variants:
            if v in t:
                return key
    return ""


def extract_slots(intent: str, t: str) -> dict:
    """Slots are extracted rule-based (fast + reliable)."""
    if intent == "time":
        now = datetime.now(LOCAL_TZ).strftime("%H:%M:%S")
        return {"time": now}

    if intent == "scroll":
        if "down" in t:
            return {"direction": "down", "amount": 300}
        if "up" in t:
            return {"direction": "up", "amount": 300}
        if "top" in t:
            return {"direction": "up", "amount": 999999}
        if "bottom" in t:
            return {"direction": "down", "amount": 999999}
        return {"direction": "", "amount": 300}

    if intent == "navigate":
        if "home" in t:
            return {"target": "home"}
        if "settings" in t:
            return {"target": "settings"}
        if "back" in t:
            return {"target": "back"}
        return {"target": ""}

    if intent == "search":
        m = re.search(r"\b(search\s+for|search|find|look\s+up)\s+(.+)$", t)
        q = (m.group(2).strip() if m else "").strip()
        q = re.sub(r"\b(please|now|thanks)\b$", "", q).strip()
        return {"query": q}

    if intent == "open":
        # allowlist only
        target = match_open_target(t)
        return {"target": target} if target else {"target": ""}

    return {}


def predict_intent_ml(text: str) -> dict:
    t = normalize_text(text)
    if not t:
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    if INTENT_PIPELINE is None:
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    try:
        intent = INTENT_PIPELINE.predict([t])[0]
        confidence = 0.75
    except Exception as e:
        print("[ERROR] intent predict failed:", e)
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    slots = extract_slots(intent, t)
    if intent == "open" and not slots.get("target"):
        intent = "none"
        confidence = 0.4

    if intent == "search" and not slots.get("query"):
        intent = "none"
        confidence = 0.4

    if intent == "navigate" and not slots.get("target"):
        intent = "none"
        confidence = 0.4

    if intent == "scroll" and not slots.get("direction"):
        intent = "none"
        confidence = 0.4

    return {"intent": intent, "slots": slots, "confidence": float(confidence)}


def predict_intent_rule_based(transcript: str) -> dict:
    return predict_intent_ml(transcript)


def intent_to_widget_tuple(pred: dict):
    it = pred.get("intent") or "none"
    slots = pred.get("slots") or {}

    if it == "open":
        target = slots.get("target", "")
        return ("open", target)

    if it == "search":
        q = slots.get("query", "")
        return ("search", q)

    if it == "scroll":
        direction = slots.get("direction", "")
        amount = slots.get("amount", 300)
        return ("scroll", direction, int(amount))

    if it == "navigate":
        target = slots.get("target", "")
        return ("navigate", target)

    if it == "time":
        return ("time", slots.get("time", ""))

    return None


@app.post("/predict/intent")
async def predict_intent_endpoint(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    transcript = (payload.get("transcript") or "").strip()
    pred = predict_intent_rule_based(transcript)
    return JSONResponse(pred)


@app.post("/flush")
async def flush(
    x_session_id: str | None = Header(None),
    x_model_key: str | None = Header(None),
):
    if not x_session_id:
        return JSONResponse({"ok": False, "reason": "missing session id"})

    utt_buf = utterance_buffers.get(x_session_id, b"")
    if not utt_buf:
        return JSONResponse({
            "ok": True,
            "final": "",
            "intent": None,
            "intent_details": {"intent": "none", "slots": {}, "confidence": 0.0},
        })

    sr = int(session_sample_rate.get(x_session_id, 48000))

    session_dir = os.path.join(SESSIONS_DIR, x_session_id)
    os.makedirs(session_dir, exist_ok=True)
    utt_wav = os.path.join(session_dir, "utterance.wav")

    utt_i16 = _bytes_to_i16(utt_buf)
    utt_16k = resample_i16_mono(utt_i16, sr, TARGET_SR)
    write_wav_i16(utt_wav, utt_16k, TARGET_SR)

    model_path = resolve_model_path(x_model_key)
    transcript = run_whisper_on_file(utt_wav, model_path)

    # reset
    utterance_buffers[x_session_id] = b""
    silence_ms_accum[x_session_id] = 0.0
    voice_active_flags[x_session_id] = False

    pred = predict_intent_rule_based(transcript)
    widget_intent = intent_to_widget_tuple(pred)

    return JSONResponse({
        "ok": True,
        "final": transcript,
        "intent": widget_intent,
        "intent_details": pred,
    })


@app.post("/transcribe_chunk")
async def transcribe_chunk(
    request: Request,
    x_session_id: str | None = Header(None),
    x_sample_rate: str | None = Header(None),
    x_model_key: str | None = Header(None),
):
    try:
        body = await request.body()
    except ClientDisconnect:
        return JSONResponse({"partial": ""})
    except Exception as e:
        print("read body error", e)
        return JSONResponse({"partial": ""})

    session_id = x_session_id or str(uuid.uuid4())
    session_dir = os.path.join(SESSIONS_DIR, session_id)
    os.makedirs(session_dir, exist_ok=True)

    # Parse sample rate
    try:
        sample_rate = int(x_sample_rate) if x_sample_rate else 48000
    except Exception:
        sample_rate = 48000

    session_sample_rate[session_id] = sample_rate

    model_path = resolve_model_path(x_model_key)

    # Calculate RMS/peak
    try:
        chunk_i16 = np.frombuffer(body, dtype=np.int16)
        if chunk_i16.size > 0:
            rms = float(np.sqrt(np.mean((chunk_i16.astype(np.float32) / 32768.0) ** 2)))
            peak = int(np.max(np.abs(chunk_i16)))
        else:
            rms, peak = 0.0, 0
    except Exception:
        rms, peak = -1.0, -1

    # VAD parameters
    VOICE_ON_RMS = float(os.getenv("VOICE_ON_RMS", "0.0004"))
    VOICE_OFF_RMS = float(os.getenv("VOICE_OFF_RMS", "0.00025"))
    VOICE_PEAK_ON = int(os.getenv("VOICE_PEAK_ON", "200"))
    VOICE_PEAK_OFF = int(os.getenv("VOICE_PEAK_OFF", "120"))

    SILENCE_TIMEOUT_MS = float(os.getenv("SILENCE_TIMEOUT_MS", "1500"))
    UTTERANCE_MAX_MS = float(os.getenv("UTTERANCE_MAX_MS", "15000"))
    PREROLL_MS = float(os.getenv("PREROLL_MS", "400"))

    max_utt_bytes = int(sample_rate * (UTTERANCE_MAX_MS / 1000.0)) * 2

    chunk_samples = len(body) // 2
    chunk_ms = (chunk_samples / max(1, sample_rate)) * 1000.0

    is_voice = (rms is not None and rms >= VOICE_ON_RMS) or (peak is not None and peak >= VOICE_PEAK_ON)
    prev_voice = voice_active_flags.get(session_id, False)
    utt_buf = utterance_buffers.get(session_id, b"")
    sil_ms = float(silence_ms_accum.get(session_id, 0.0) or 0.0)

    # preroll buffer
    pr_max_bytes = int(sample_rate * (PREROLL_MS / 1000.0)) * 2
    pr = preroll_buffers.get(session_id, b"")
    pr = (pr + body)[-pr_max_bytes:]
    preroll_buffers[session_id] = pr

    # utterance accumulation
    if is_voice or (rms is not None and rms >= 0.0002 and chunk_samples > 0):
        voice_active_flags[session_id] = True
        silence_ms_accum[session_id] = 0.0

        if not prev_voice and len(utt_buf) == 0 and len(pr) > 0:
            utt_buf = (utt_buf + pr + body)[-max_utt_bytes:]
        else:
            utt_buf = (utt_buf + body)[-max_utt_bytes:]

        utterance_buffers[session_id] = utt_buf
    else:
        if prev_voice or len(utt_buf) > 0:
            sil_ms += chunk_ms
            silence_ms_accum[session_id] = sil_ms

            if sil_ms >= SILENCE_TIMEOUT_MS and len(utt_buf) > 0:
                try:
                    utt_wav = os.path.join(session_dir, "utterance.wav")
                    utt_i16 = _bytes_to_i16(utt_buf)
                    utt_16k = resample_i16_mono(utt_i16, sample_rate, TARGET_SR)
                    write_wav_i16(utt_wav, utt_16k, TARGET_SR)
                    transcript = run_whisper_on_file(utt_wav, model_path)
                except Exception as e:
                    print("utterance finalize error", e)
                    transcript = ""

                # reset
                voice_active_flags[session_id] = False
                utterance_buffers[session_id] = b""
                silence_ms_accum[session_id] = 0.0

                if transcript:
                    pred = predict_intent_rule_based(transcript)
                    widget_intent = intent_to_widget_tuple(pred)
                    return JSONResponse({
                        "final": transcript,
                        "intent": widget_intent,
                        "intent_details": pred,
                        "rms": rms,
                        "peak": peak,
                        "bytes": len(body),
                    })

    # rolling partial decoding
    window_sec = 0.8
    max_bytes = int(sample_rate * window_sec) * 2
    rb = rolling_buffers.get(session_id, b"")
    rb = (rb + body)[-max_bytes:]
    rolling_buffers[session_id] = rb

    wav_path = os.path.join(session_dir, "stream.wav")
    raw_bytes = rb

    try:
        if raw_bytes:
            i16 = _bytes_to_i16(raw_bytes)
            i16_16k = resample_i16_mono(i16, sample_rate, TARGET_SR)
            write_wav_i16(wav_path, i16_16k, TARGET_SR)
    except Exception as e:
        print("pcm->wav error", e)

    total_samples = len(raw_bytes) // 2 if raw_bytes else 0
    if total_samples < max(1, TARGET_SR // 20):
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    prev_samples = last_run_samples.get(session_id, 0)
    min_delta = max(1, TARGET_SR // 10)
    has_enough_new = (total_samples - prev_samples) >= min_delta

    has_voice = False
    try:
        if (rms is not None and rms >= VOICE_OFF_RMS) or (peak is not None and peak >= VOICE_PEAK_OFF):
            has_voice = True
    except Exception:
        has_voice = False

    if not has_enough_new or not has_voice:
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    transcript = run_whisper_on_file(wav_path, model_path)
    last_run_samples[session_id] = total_samples

    prev = session_text.get(session_id, "")
    if transcript and transcript != prev:
        session_text[session_id] = transcript

    return JSONResponse({
        "partial": transcript or "",
        "rms": rms,
        "peak": peak,
        "bytes": len(body),
    })
