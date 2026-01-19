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
import time

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None

try:
    import librosa
except Exception:
    librosa = None

try:
    import python_speech_features as psf
except Exception:
    psf = None


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

TARGET_SR = int(os.getenv("TARGET_SR", "16000"))

def resolve_model_path(model_key: str | None) -> str:
    if model_key:
        mk = str(model_key).strip()
        if mk:
            candidate = os.path.join(MODELS_DIR, f"ggml-{mk}.bin")
            if os.path.isfile(candidate):
                return candidate

    for fallback in ("ggml-base.en.bin", "ggml-base.bin", "ggml-tiny.en.bin"):
        p = os.path.join(MODELS_DIR, fallback)
        if os.path.isfile(p):
            return p
    return ""

INTENT_MODEL_PATH = os.path.join(BASE_DIR, "intent_pipeline.joblib")
INTENT_PIPELINE = None

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

WAKE_MODEL = None

WAKE_MODEL_PATH_CANDIDATES = []
_env_wake = (os.getenv('WAKE_MODEL_PATH') or '').strip()
if _env_wake:
    WAKE_MODEL_PATH_CANDIDATES.append(_env_wake)

WAKE_MODEL_PATH_CANDIDATES += [
    os.path.join(BASE_DIR, 'wakeword_model.joblib'),
    os.path.join(BASE_DIR, 'wakeword_pipeline.joblib'),
    os.path.join(BASE_DIR, 'wakeword_data', 'wakeword_model.joblib'),
    os.path.join(BASE_DIR, 'wakeword_data', 'wakeword_pipeline.joblib'),
]

try:
    for root, dirs, files in os.walk(BASE_DIR):
        # bound search depth
        rel = os.path.relpath(root, BASE_DIR)
        if rel.count(os.sep) >= 4:
            dirs[:] = []
            continue
        for fn in files:
            if fn.lower().endswith('.joblib') and 'wake' in fn.lower():
                WAKE_MODEL_PATH_CANDIDATES.append(os.path.join(root, fn))
except Exception:
    pass

_seen = set()
for p in WAKE_MODEL_PATH_CANDIDATES:
    if not p:
        continue
    p = os.path.normpath(p)
    if p in _seen:
        continue
    _seen.add(p)
    if os.path.isfile(p):
        try:
            WAKE_MODEL = joblib.load(p)
            print('[DEBUG] Loaded wakeword model:', p)
            break
        except Exception as e:
            print('[ERROR] Failed to load wakeword model:', p, e)

if WAKE_MODEL is None:
    print('[WARN] Wakeword model not loaded. Wake mode will be disabled.')

WAKE_SR = 16000
WAKE_DURATION_SEC = float(os.getenv("WAKE_DURATION_SEC", "1.0"))
WAKE_N_MFCC = int(os.getenv("WAKE_N_MFCC", "20"))
WAKE_PROB_THRESHOLD = float(os.getenv("WAKE_PROB_THRESHOLD", "0.72"))
WAKE_AWAKE_WINDOW_SEC = float(os.getenv("WAKE_AWAKE_WINDOW_SEC", "9.0"))
WAKE_COOLDOWN_SEC = float(os.getenv("WAKE_COOLDOWN_SEC", "1.2"))

def _bytes_to_i16(raw: bytes) -> np.ndarray:
    return np.frombuffer(raw or b"", dtype=np.int16)

def resample_i16_mono(x: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
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
    if not os.path.isfile(WHISPER_BIN):
        print("[ERROR] whisper binary missing:", WHISPER_BIN)
        return ""
    if not model_path or not os.path.isfile(model_path):
        print("[ERROR] whisper model missing:", model_path)
        return ""

    cmd = [WHISPER_BIN, "-m", model_path, "-f", wav_path, "-l", "en", "-nt"]

    def extract_transcript(raw: str) -> str:
        lines = raw.splitlines()
        out = []
        for ln in lines:
            s = ln.strip()
            if not s:
                continue
            if s.startswith(("whisper", "main:", "system_info", "threads", "processors", "beam", "lang =", "task =")):
                continue
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


def match_open_target(t: str) -> str:
    for key, variants in SAFE_OPEN_TARGETS.items():
        for v in variants:
            if v in t:
                return key
    return ""

def extract_slots(intent: str, t: str) -> dict:
    if intent == "time":
        now = datetime.now(LOCAL_TZ).strftime("%H:%M:%S")
        return {"time": now}
    if intent == "search":
        m = re.search(r"\b(search\s+for|search|find|look\s+up)\s+(.+)$", t)
        q = (m.group(2).strip() if m else "").strip()
        q = re.sub(r"\b(please|now|thanks)\b$", "", q).strip()
        return {"query": q}
    if intent == "open":
        target = match_open_target(t)
        return {"target": target} if target else {"target": ""}
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
    return {}

def predict_intent_ml(text: str) -> dict:
    t = normalize_text(text)
    if not t or INTENT_PIPELINE is None:
        return {"intent": "none", "slots": {}, "confidence": 0.0}
    try:
        intent = INTENT_PIPELINE.predict([t])[0]
        confidence = 0.75
    except Exception as e:
        print("[ERROR] intent predict failed:", e)
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    slots = extract_slots(intent, t)

    # basic safety for missing slots
    if intent == "open" and not slots.get("target"):
        intent, confidence = "none", 0.4
    if intent == "search" and not slots.get("query"):
        intent, confidence = "none", 0.4
    if intent == "navigate" and not slots.get("target"):
        intent, confidence = "none", 0.4
    if intent == "scroll" and not slots.get("direction"):
        intent, confidence = "none", 0.4

    return {"intent": intent, "slots": slots, "confidence": float(confidence)}


def predict_intent_rule_based(transcript: str) -> dict:
    return predict_intent_ml(transcript)


def intent_to_widget_tuple(pred: dict):
    it = pred.get("intent") or "none"
    slots = pred.get("slots") or {}
    if it == "open":
        return ("open", slots.get("target", ""))
    if it == "search":
        return ("search", slots.get("query", ""))
    if it == "scroll":
        return ("scroll", slots.get("direction", ""), int(slots.get("amount", 300)))
    if it == "navigate":
        return ("navigate", slots.get("target", ""))
    if it == "time":
        return ("time", slots.get("time", ""))
    return None

def _wake_featurize_from_i16(i16: np.ndarray, src_sr: int) -> np.ndarray | None:
    if WAKE_MODEL is None:
        return None
    if i16.size == 0 or src_sr <= 0:
        return None

    # resample to WAKE_SR
    if src_sr != WAKE_SR:
        i16 = resample_i16_mono(i16, src_sr, WAKE_SR)

    y = (i16.astype(np.float32) / 32768.0).clip(-1.0, 1.0)

    target_len = int(WAKE_SR * WAKE_DURATION_SEC)
    if y.shape[0] < target_len:
        y = np.pad(y, (0, target_len - y.shape[0]))
    else:
        y = y[:target_len]

    try:
        if librosa is not None:
            mfcc = librosa.feature.mfcc(y=y, sr=WAKE_SR, n_mfcc=WAKE_N_MFCC)
            feat = np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)], axis=0).astype(np.float32)
            return feat

        # Fallback if librosa isn't installed
        if psf is not None:
            mfcc2 = psf.mfcc(
                signal=y,
                samplerate=WAKE_SR,
                winlen=0.025,
                winstep=0.010,
                numcep=WAKE_N_MFCC,
                nfilt=26,
                nfft=512,
                preemph=0.97,
                appendEnergy=True,
            )
            # shape: (frames, numcep)
            feat = np.concatenate([mfcc2.mean(axis=0), mfcc2.std(axis=0)], axis=0).astype(np.float32)
            return feat

        print('[WARN] No MFCC backend available (install librosa or python_speech_features).')
        return None
    except Exception as e:
        print('[ERROR] wake featurize failed:', e)
        return None


def _wake_predict_prob(feat: np.ndarray) -> float:
    try:
        if hasattr(WAKE_MODEL, 'predict_proba'):
            proba = WAKE_MODEL.predict_proba([feat])[0]
            cls = getattr(WAKE_MODEL, 'classes_', None)
            if cls is not None:
                try:
                    idx = list(cls).index(1)
                    return float(proba[idx])
                except Exception:
                    pass
            return float(proba[1]) if len(proba) > 1 else float(proba[0])
        pred = WAKE_MODEL.predict([feat])[0]
        return 1.0 if int(pred) == 1 else 0.0
    except Exception as e:
        print('[ERROR] wake predict failed:', e)
        return 0.0


# Session state
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


def _now_ts() -> float:
    return time.time()


def _is_awake(session_id: str) -> bool:
    return float(awake_until_ts.get(session_id, 0.0) or 0.0) > _now_ts()


def _set_awake(session_id: str, seconds: float):
    awake_until_ts[session_id] = _now_ts() + float(seconds)


def _in_cooldown(session_id: str) -> bool:
    return float(wake_cooldown_until_ts.get(session_id, 0.0) or 0.0) > _now_ts()


def _set_cooldown(session_id: str, seconds: float):
    wake_cooldown_until_ts[session_id] = _now_ts() + float(seconds)


@app.get("/wake/info")
async def wake_info():
    return JSONResponse({
        "wake_model_loaded": bool(WAKE_MODEL is not None),
        "librosa_available": bool(librosa is not None),
        "wake_sr": WAKE_SR,
        "wake_duration_sec": WAKE_DURATION_SEC,
        "wake_threshold": WAKE_PROB_THRESHOLD,
        "awake_window_sec": WAKE_AWAKE_WINDOW_SEC,
        "cooldown_sec": WAKE_COOLDOWN_SEC,
        "wake_n_mfcc": WAKE_N_MFCC,
    })


@app.post("/predict/intent")
async def predict_intent_endpoint(request: Request):
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    transcript = (payload.get("transcript") or "").strip()
    pred = predict_intent_rule_based(transcript)
    return JSONResponse(pred)


def _finalize_utterance(session_id: str, session_dir: str, sample_rate: int, model_path: str):
    utt_buf = utterance_buffers.get(session_id, b"")
    if not utt_buf:
        return None

    min_bytes = int(sample_rate * 0.25) * 2  # ~250ms
    if len(utt_buf) < min_bytes:
        return None

    try:
        utt_wav = os.path.join(session_dir, "utterance.wav")
        utt_i16 = _bytes_to_i16(utt_buf)
        utt_16k = resample_i16_mono(utt_i16, sample_rate, TARGET_SR)
        write_wav_i16(utt_wav, utt_16k, TARGET_SR)
        transcript = run_whisper_on_file(utt_wav, model_path)
    except Exception as e:
        print("finalize error", e)
        transcript = ""

    voice_active_flags[session_id] = False
    utterance_buffers[session_id] = b""
    silence_ms_accum[session_id] = 0.0

    transcript = (transcript or "").strip()
    if not transcript:
        return {"final": "", "intent": None, "intent_details": {"intent": "none", "slots": {}, "confidence": 0.0}}

    pred = predict_intent_rule_based(transcript)
    widget_intent = intent_to_widget_tuple(pred)
    return {"final": transcript, "intent": widget_intent, "intent_details": pred}


@app.post("/flush")
async def flush(
    x_session_id: str | None = Header(None),
    x_model_key: str | None = Header(None),
):
    if not x_session_id:
        return JSONResponse({"ok": False, "reason": "missing session id"})

    sr = int(session_sample_rate.get(x_session_id, 48000))
    session_dir = os.path.join(SESSIONS_DIR, x_session_id)
    os.makedirs(session_dir, exist_ok=True)

    model_path = resolve_model_path(x_model_key)
    fin = _finalize_utterance(x_session_id, session_dir, sr, model_path)

    if not fin:
        return JSONResponse({"ok": True, "final": "", "intent": None, "intent_details": {"intent": "none", "slots": {}, "confidence": 0.0}})

    return JSONResponse({"ok": True, **fin})


@app.post("/transcribe_chunk")
async def transcribe_chunk(
    request: Request,
    x_session_id: str | None = Header(None),
    x_sample_rate: str | None = Header(None),
    x_model_key: str | None = Header(None),
    x_wake_mode: str | None = Header(None),  # "wake" | "ptt"
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

    try:
        sample_rate = int(x_sample_rate) if x_sample_rate else 48000
    except Exception:
        sample_rate = 48000
    session_sample_rate[session_id] = sample_rate

    model_path = resolve_model_path(x_model_key)

    try:
        chunk_i16 = np.frombuffer(body, dtype=np.int16)
        if chunk_i16.size > 0:
            f = chunk_i16.astype(np.float32) / 32768.0
            rms = float(np.sqrt(np.mean(f * f) + 1e-12))
            peak = int(np.max(np.abs(chunk_i16)))
        else:
            rms, peak = 0.0, 0
    except Exception:
        rms, peak = -1.0, -1

    VOICE_ON_RMS = float(os.getenv("VOICE_ON_RMS", "0.00025"))
    VOICE_OFF_RMS = float(os.getenv("VOICE_OFF_RMS", "0.00018"))
    VOICE_PEAK_ON = int(os.getenv("VOICE_PEAK_ON", "140"))
    VOICE_PEAK_OFF = int(os.getenv("VOICE_PEAK_OFF", "90"))

    SILENCE_TIMEOUT_MS = float(os.getenv("SILENCE_TIMEOUT_MS", "900"))
    UTTERANCE_MAX_MS = float(os.getenv("UTTERANCE_MAX_MS", "15000"))
    PREROLL_MS = float(os.getenv("PREROLL_MS", "450"))

    max_utt_bytes = int(sample_rate * (UTTERANCE_MAX_MS / 1000.0)) * 2
    chunk_samples = len(body) // 2
    chunk_ms = (chunk_samples / max(1, sample_rate)) * 1000.0

    # preroll
    pr_max_bytes = int(sample_rate * (PREROLL_MS / 1000.0)) * 2
    pr = preroll_buffers.get(session_id, b"")
    pr = (pr + body)[-pr_max_bytes:]
    preroll_buffers[session_id] = pr

    wake_mode = (x_wake_mode or "").strip().lower() == "wake"

    if wake_mode and WAKE_MODEL is not None and (librosa is not None or psf is not None):
        ww_sec = WAKE_DURATION_SEC
        ww_max_bytes = int(sample_rate * ww_sec) * 2
        ww_rb = rolling_buffers.get(session_id, b"")
        ww_rb = (ww_rb + body)[-ww_max_bytes:]
        rolling_buffers[session_id] = ww_rb

        if not _is_awake(session_id):
            enough = len(ww_rb) >= int(sample_rate * ww_sec * 2 * 0.90)

            if enough and (not _in_cooldown(session_id)):
                feat = _wake_featurize_from_i16(_bytes_to_i16(ww_rb), sample_rate)
                if feat is not None:
                    prob = _wake_predict_prob(feat)

                    if prob >= WAKE_PROB_THRESHOLD:
                        _set_awake(session_id, WAKE_AWAKE_WINDOW_SEC)
                        _set_cooldown(session_id, WAKE_COOLDOWN_SEC)
                        wake_started_ts[session_id] = _now_ts()
                        wake_voice_seen[session_id] = False
                        utterance_buffers[session_id] = pr
                        silence_ms_accum[session_id] = 0.0
                        voice_active_flags[session_id] = False
                        session_text[session_id] = ""

                        return JSONResponse({
                            "partial": "",
                            "wake": "detected",
                            "wake_prob": prob,
                            "awake_for_sec": WAKE_AWAKE_WINDOW_SEC,
                            "rms": rms,
                            "peak": peak,
                            "bytes": len(body),
                        })

                    return JSONResponse({
                        "partial": "",
                        "wake": "listening",
                        "wake_prob": prob,
                        "awake": False,
                        "rms": rms,
                        "peak": peak,
                        "bytes": len(body),
                    })

            return JSONResponse({
                "partial": "",
                "wake": "listening",
                "awake": False,
                "rms": rms,
                "peak": peak,
                "bytes": len(body),
            })

    prev_voice = bool(voice_active_flags.get(session_id, False))
    utt_buf = utterance_buffers.get(session_id, b"")
    sil_ms = float(silence_ms_accum.get(session_id, 0.0) or 0.0)

    # hysteresis
    if prev_voice:
        is_voice = (rms >= VOICE_OFF_RMS) or (peak >= VOICE_PEAK_OFF)
    else:
        is_voice = (rms >= VOICE_ON_RMS) or (peak >= VOICE_PEAK_ON)

    if is_voice:
        voice_active_flags[session_id] = True
        silence_ms_accum[session_id] = 0.0

        if wake_mode and _is_awake(session_id):
            wake_voice_seen[session_id] = True
            if float(wake_started_ts.get(session_id, 0.0) or 0.0) <= 0.0:
                wake_started_ts[session_id] = _now_ts()

        if (not prev_voice) and len(utt_buf) == 0 and len(pr) > 0:
            utt_buf = (utt_buf + pr + body)[-max_utt_bytes:]
        else:
            utt_buf = (utt_buf + body)[-max_utt_bytes:]
        utterance_buffers[session_id] = utt_buf
    else:
        if prev_voice or len(utt_buf) > 0:
            sil_ms += chunk_ms
            silence_ms_accum[session_id] = sil_ms

            if wake_mode and _is_awake(session_id):
                now = _now_ts()
                started = float(wake_started_ts.get(session_id, 0.0) or 0.0)
                if started <= 0.0:
                    started = now
                    wake_started_ts[session_id] = now

                if (now - started) >= WAKE_AWAKE_WINDOW_SEC:
                    fin = None
                    if bool(wake_voice_seen.get(session_id, False)) and len(utt_buf) > 0:
                        fin = _finalize_utterance(session_id, session_dir, sample_rate, model_path)

                    awake_until_ts[session_id] = 0.0
                    wake_started_ts[session_id] = 0.0
                    wake_voice_seen[session_id] = False
                    voice_active_flags[session_id] = False
                    utterance_buffers[session_id] = b""
                    silence_ms_accum[session_id] = 0.0

                    if fin and 'final' in fin:
                        return JSONResponse({**fin, 'awake': False, 'reason': 'wake_window_end'})
                    return JSONResponse({
                        'final': '',
                        'intent': None,
                        'intent_details': {'intent': 'none', 'slots': {}, 'confidence': 0.0},
                        'awake': False,
                        'reason': 'wake_window_end',
                        'rms': rms,
                        'peak': peak,
                        'bytes': len(body),
                    })

                if not bool(wake_voice_seen.get(session_id, False)):
                    voice_active_flags[session_id] = False
                    silence_ms_accum[session_id] = 0.0
                    return JSONResponse({'partial': '', 'awake': True, 'rms': rms, 'peak': peak, 'bytes': len(body)})

                if sil_ms >= SILENCE_TIMEOUT_MS and len(utt_buf) > 0:
                    fin = _finalize_utterance(session_id, session_dir, sample_rate, model_path)
                    awake_until_ts[session_id] = 0.0
                    wake_started_ts[session_id] = 0.0
                    wake_voice_seen[session_id] = False
                    voice_active_flags[session_id] = False
                    utterance_buffers[session_id] = b""
                    silence_ms_accum[session_id] = 0.0
                    if fin and 'final' in fin:
                        return JSONResponse({**fin, 'awake': False, 'reason': 'wake_silence_final'})
                    return JSONResponse({'final': '', 'awake': False, 'reason': 'wake_silence_empty'})

                return JSONResponse({'partial': '', 'awake': True, 'rms': rms, 'peak': peak, 'bytes': len(body)})
            if wake_mode and not _is_awake(session_id):
                voice_active_flags[session_id] = False
                utterance_buffers[session_id] = b''
                silence_ms_accum[session_id] = 0.0
                return JSONResponse({'partial': '', 'awake': False, 'rms': rms, 'peak': peak, 'bytes': len(body)})

            if sil_ms >= SILENCE_TIMEOUT_MS and len(utt_buf) > 0:
                fin = _finalize_utterance(session_id, session_dir, sample_rate, model_path)
                if fin and fin.get("final"):
                    return JSONResponse({**fin, "awake": _is_awake(session_id) if wake_mode else None, "rms": rms, "peak": peak, "bytes": len(body)})

    window_sec = 0.8
    max_bytes = int(sample_rate * window_sec) * 2
    rb = rolling_buffers.get(session_id, b"")
    rb = (rb + body)[-max_bytes:]
    rolling_buffers[session_id] = rb

    total_samples = len(rb) // 2 if rb else 0
    if total_samples < max(1, TARGET_SR // 20):
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    prev_samples = last_run_samples.get(session_id, 0)
    min_delta = max(1, TARGET_SR // 10)
    has_enough_new = (total_samples - prev_samples) >= min_delta

    has_voice_energy = (rms >= VOICE_OFF_RMS) or (peak >= VOICE_PEAK_OFF)
    if not has_enough_new or not has_voice_energy:
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    if wake_mode and not _is_awake(session_id):
        return JSONResponse({"partial": "", "awake": False, "rms": rms, "peak": peak, "bytes": len(body)})

    wav_path = os.path.join(session_dir, "stream.wav")
    try:
        i16 = _bytes_to_i16(rb)
        i16_16k = resample_i16_mono(i16, sample_rate, TARGET_SR)
        write_wav_i16(wav_path, i16_16k, TARGET_SR)
    except Exception as e:
        print("pcm->wav error", e)
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    transcript = run_whisper_on_file(wav_path, model_path)
    last_run_samples[session_id] = total_samples

    prev = session_text.get(session_id, "")
    if transcript and transcript != prev:
        session_text[session_id] = transcript

    return JSONResponse({
        "partial": transcript or "",
        "awake": _is_awake(session_id) if wake_mode else None,
        "rms": rms,
        "peak": peak,
        "bytes": len(body),
    })
