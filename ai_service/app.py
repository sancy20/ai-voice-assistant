from fastapi import FastAPI, Request, Header
from fastapi.responses import JSONResponse
import os, uuid, subprocess, time, threading, wave
import numpy as np
from starlette.requests import ClientDisconnect

# Optional: faster-whisper (keeps model in-memory for lower latency)
USE_FASTER = os.getenv("USE_FASTER_WHISPER", "0") in ("1", "true", "True")
FAST_MODEL = None
try:
    if USE_FASTER:
        from faster_whisper import WhisperModel
        fw_model_name = os.getenv("FW_MODEL", "tiny.en")
        fw_device = os.getenv("FW_DEVICE", "cpu")
        fw_compute_type = os.getenv("FW_COMPUTE", "int8")
        # Load once and reuse
        FAST_MODEL = WhisperModel(fw_model_name, device=fw_device, compute_type=fw_compute_type)
        print(f"[faster-whisper] Loaded model '{fw_model_name}' on {fw_device} ({fw_compute_type})")
except Exception as e:
    print("[faster-whisper] Disabled due to error:", e)
    FAST_MODEL = None
    USE_FASTER = False

app = FastAPI()

SESSIONS_DIR = "./sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)
WHISPER_BIN = "./whisper.cpp/whisper_bin/whisper-cli.exe"
_BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_DEFAULT_MODEL_PATH = os.path.normpath(
    os.path.join(_BASE_DIR, "..", "models", "ggml-tiny.en.bin")
)
WHISPER_MODEL = os.getenv("WHISPER_MODEL", _DEFAULT_MODEL_PATH)

session_text = {}
last_run_samples = {}
rolling_buffers = {}
utterance_buffers = {}
voice_active_flags = {}
silence_ms_accum = {}
preroll_buffers = {}

TARGET_SR = int(os.getenv("TARGET_SR", "16000"))

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

def get_intent(text: str):
    try:
        t = (text or "").lower()
        if "scroll down" in t:
            return ("scroll", "down")
        if "scroll up" in t:
            return ("scroll", "up")
        if "search for" in t:
            try:
                term = t.split("search for", 1)[1].strip()
            except Exception:
                term = ""
            return ("search", term)
        if "go home" in t:
            return ("nav", "home")
        if "open settings" in t:
            return ("nav", "settings")
    except Exception:
        pass
    return ("none", "")

def run_whisper_on_file(wav_path: str) -> str:
    if USE_FASTER and FAST_MODEL is not None:
        try:
            segments, _info = FAST_MODEL.transcribe(wav_path, beam_size=1, vad_filter=False)
            parts = []
            for seg in segments:
                s = (seg.text or "").strip()
                if s:
                    parts.append(s)
            return " ".join(parts).strip()
        except Exception as e:
            print("faster-whisper transcribe error:", e)
            return ""
        
    try:
        if not os.path.isfile(WHISPER_BIN):
            print(f"whisper binary not found at: {WHISPER_BIN}")
        if not os.path.isfile(WHISPER_MODEL):
            print(f"whisper model not found at: {WHISPER_MODEL}")
    except Exception:
        pass

    def extract_transcript(raw: str) -> str:
        lines = raw.splitlines()
        out_parts = []
        for ln in lines:
            s = ln.strip()
            if not s:
                continue
            if s.startswith('whisper_') or s.startswith('whisper ') or s.startswith('whisper:'):
                continue
            if s.startswith('system_info'):
                continue
            if '[BLANK_AUDIO]' in s:
                continue
            if ']' in s and '[' in s and '-->' in s:
                try:
                    part = s.split('] ', 1)[1]
                    if part.strip():
                        out_parts.append(part.strip())
                    continue
                except Exception:
                    pass
            if s.startswith('main:') and ' - ' in s:
                try:
                    part = s.split(' - ', 1)[1].strip()
                    if part:
                        out_parts.append(part)
                    continue
                except Exception:
                    pass
            # fallback
            out_parts.append(s)

        return " ".join(out_parts).strip()

    try:
        cmd = [
            WHISPER_BIN,
            "-m", WHISPER_MODEL,
            "-f", wav_path,
        ]
        p = subprocess.run(cmd, capture_output=True, text=True)
        raw = (p.stdout or "") + "\n" + (p.stderr or "")
        transcript = extract_transcript(raw)
        return transcript
    except Exception as e:
        print("whisper.cpp run error:", e)
        return ""

@app.post("/transcribe_chunk")
async def transcribe_chunk(
    request: Request,
    x_session_id: str | None = Header(None),
    x_sample_rate: str | None = Header(None),
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

    # body is raw int16 PCM mono
    rms = None
    peak = None
    try:
        if body and len(body) >= 2:
            chunk_i16 = np.frombuffer(body, dtype=np.int16)
            if chunk_i16.size > 0:
                f = chunk_i16.astype(np.float32) / 32768.0
                rms = float(np.sqrt(np.mean(f * f)))
                peak = int(np.max(np.abs(chunk_i16)))
            else:
                rms, peak = 0.0, 0
        else:
            rms, peak = 0.0, 0
    except Exception:
        rms, peak = -1.0, -1

    try:
        sample_rate = int(x_sample_rate) if x_sample_rate else 48000
    except Exception:
        sample_rate = 48000

    # --- Simple VAD/state for full-utterance decoding ---
    # Tune these for your microphone/environment.
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

    # Start/continue utterance when voice or low-level audio present
    # Always maintain a short preroll buffer to capture leading phonemes
    pr_max_bytes = int(sample_rate * (PREROLL_MS / 1000.0)) * 2
    pr = preroll_buffers.get(session_id, b"")
    pr = (pr + body)[-pr_max_bytes:]
    preroll_buffers[session_id] = pr

    if is_voice or (rms is not None and rms >= 0.0002 and chunk_samples > 0):
        voice_active_flags[session_id] = True
        silence_ms_accum[session_id] = 0.0
        # Accumulate utterance buffer with cap
        if not prev_voice and len(utt_buf) == 0 and len(pr) > 0:
            utt_buf = (utt_buf + pr + body)[-max_utt_bytes:]
        else:
            utt_buf = (utt_buf + body)[-max_utt_bytes:]
        utterance_buffers[session_id] = utt_buf
    else:
        if prev_voice or len(utt_buf) > 0:
            sil_ms += chunk_ms
            silence_ms_accum[session_id] = sil_ms
            # If silence exceeds timeout, finalize utterance
            if sil_ms >= SILENCE_TIMEOUT_MS and len(utt_buf) > 0:
                try:
                    utt_wav = os.path.join(session_dir, "utterance.wav")

                    # Resample to 16 kHz mono int16 for whisper.cpp.
                    utt_i16 = _bytes_to_i16(utt_buf)
                    utt_i16_16k = resample_i16_mono(utt_i16, sample_rate, TARGET_SR)
                    write_wav_i16(utt_wav, utt_i16_16k, TARGET_SR)

                    transcript = run_whisper_on_file(utt_wav)
                except Exception as e:
                    print("utterance finalize error", e)
                    transcript = ""
                # Reset utterance state regardless
                voice_active_flags[session_id] = False
                utterance_buffers[session_id] = b""
                silence_ms_accum[session_id] = 0.0

                if transcript:
                    prev = session_text.get(session_id, "")
                    if transcript != prev:
                        session_text[session_id] = transcript
                    intent = get_intent(transcript)
                    return JSONResponse({
                        "final": transcript,
                        "intent": intent,
                        "rms": rms,
                        "peak": peak,
                        "bytes": len(body),
                    })

    # --- Rolling partial decoding for responsiveness ---
    window_sec = 0.8
    max_bytes = int(sample_rate * window_sec) * 2
    rb = rolling_buffers.get(session_id, b"")
    rb = (rb + body)[-max_bytes:]
    rolling_buffers[session_id] = rb

    wav_path = os.path.join(session_dir, "stream.wav")
    try:
        raw_bytes = rb
        if raw_bytes:
            i16 = _bytes_to_i16(raw_bytes)
            i16_16k = resample_i16_mono(i16, sample_rate, TARGET_SR)
            write_wav_i16(wav_path, i16_16k, TARGET_SR)
    except Exception as e:
        print("pcm->wav error", e)

    total_samples = 0
    try:
        total_samples = len(raw_bytes) // 2 if raw_bytes else 0
    except Exception:
        total_samples = 0

    sr_for_guard = TARGET_SR

    if total_samples < max(1, sr_for_guard // 20):
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    prev_samples = last_run_samples.get(session_id, 0)

    min_delta = max(1, sr_for_guard // 10)
    has_enough_new = (total_samples - prev_samples) >= min_delta

    has_voice = False
    try:
        if (rms is not None and rms >= VOICE_OFF_RMS) or (peak is not None and peak >= VOICE_PEAK_OFF):
            has_voice = True
    except Exception:
        has_voice = False

    if not has_enough_new or not has_voice:
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    transcript = run_whisper_on_file(wav_path)
    last_run_samples[session_id] = total_samples
    prev = session_text.get(session_id, "")
    if transcript and transcript != prev:
        session_text[session_id] = transcript
        intent = get_intent(transcript)
        return JSONResponse({
            "partial": transcript,
            "rms": rms,
            "peak": peak,
            "bytes": len(body),
        })
    else:
        return JSONResponse({
            "partial": transcript or "",
            "rms": rms,
            "peak": peak,
            "bytes": len(body),
        })
