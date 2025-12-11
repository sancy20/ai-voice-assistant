from fastapi import FastAPI, Request, Header
from fastapi.responses import JSONResponse
import os, uuid, subprocess, time, threading, wave
import numpy as np
from starlette.requests import ClientDisconnect

app = FastAPI()

SESSIONS_DIR = "./sessions"
os.makedirs(SESSIONS_DIR, exist_ok=True)
WHISPER_BIN = "./whisper.cpp/whisper_bin/whisper-cli.exe"
WHISPER_MODEL = "/models/ggml-tiny.en.bin"

session_text = {}
last_run_samples = {}
rolling_buffers = {}

def run_whisper_on_file(session_wav_path):
    cmd = [WHISPER_BIN, "-m", WHISPER_MODEL, "-f", session_wav_path]
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
                    part = s.rsplit(' - ', 1)[1]
                    if part.strip():
                        out_parts.append(part.strip())
                    continue
                except Exception:
                    pass
            if '[' not in s and ']' not in s:
                out_parts.append(s)
        return ' '.join(out_parts).strip()

    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=20)
        raw = out.decode(errors='ignore')
        text = extract_transcript(raw)
        return text
    except Exception as e:
        print("whisper call error", e)
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
    pcm_path = os.path.join(session_dir, "stream.raw")
    with open(pcm_path, "ab") as f:
        f.write(body)

    try:
        chunk_i16 = np.frombuffer(body, dtype=np.int16)
        if chunk_i16.size > 0:
            rms = float(np.sqrt(np.mean((chunk_i16.astype(np.float32) / 32768.0) ** 2)))
            peak = int(np.max(np.abs(chunk_i16)))
        else:
            rms, peak = 0.0, 0
    except Exception:
        rms, peak = -1.0, -1

    try:
        sample_rate = int(x_sample_rate) if x_sample_rate else 48000
    except Exception:
        sample_rate = 48000

    window_sec = 2.0
    max_bytes = int(sample_rate * window_sec) * 2
    rb = rolling_buffers.get(session_id, b"")
    rb = (rb + body)[-max_bytes:]
    rolling_buffers[session_id] = rb

    wav_path = os.path.join(session_dir, "stream.wav")
    try:
        raw_bytes = rb
        if raw_bytes:
            with wave.open(wav_path, 'wb') as wf:
                wf.setnchannels(1)
                wf.setsampwidth(2)
                wf.setframerate(sample_rate)
                wf.writeframes(raw_bytes)
    except Exception as e:
        print("pcm->wav error", e)

    total_samples = 0
    try:
        total_samples = len(raw_bytes) // 2 if raw_bytes else 0
    except Exception:
        total_samples = 0
    sr_for_guard = sample_rate or 48000
    if total_samples < max(1, sr_for_guard // 10):
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    prev_samples = last_run_samples.get(session_id, 0)
    min_delta = max(1, sr_for_guard // 2)
    has_enough_new = (total_samples - prev_samples) >= min_delta
    has_voice = rms is not None and rms > 0.005
    if not has_enough_new or not has_voice:
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})

    transcript = run_whisper_on_file(wav_path)
    last_run_samples[session_id] = total_samples
    prev = session_text.get(session_id, "")
    if transcript != prev:
        session_text[session_id] = transcript
        return JSONResponse({"final": transcript, "rms": rms, "peak": peak, "bytes": len(body)})
    else:
        return JSONResponse({"partial": "", "rms": rms, "peak": peak, "bytes": len(body)})
