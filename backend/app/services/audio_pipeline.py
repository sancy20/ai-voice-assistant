import os
import uuid
import numpy as np
import time

from app.config import (
    TARGET_SR,
    SESSIONS_DIR,
    WAKE_DURATION_SEC,
    WAKE_PROB_THRESHOLD,
    WAKE_AWAKE_WINDOW_SEC,
    WAKE_COOLDOWN_SEC,
    WAKE_ARM_DELAY_SEC,
    WAKE_COMMAND_SILENCE_TIMEOUT_MS,
    PTT_SILENCE_TIMEOUT_MS,
)
from app.utils.audio_utils import bytes_to_i16, resample_i16_mono, write_wav_i16
from app.services.asr_service import run_whisper_on_file
from app.services.intent_service import predict_intent_rule_based, intent_to_widget_tuple
from app.services.model_service import resolve_model_path
from app.services.wakeword_service import (
    is_awake,
    set_awake,
    in_cooldown,
    set_cooldown,
    wake_featurize_from_i16,
    wake_predict_prob,
)
import app.state as state

def now_ts():
    return time.time()

def compute_audio_features(i16):
    if i16.size == 0:
        return 0.0, 0
    f = i16.astype(np.float32) / 32768.0
    rms = float(np.sqrt(np.mean(f * f) + 1e-12))
    peak = int(np.max(np.abs(i16)))
    return rms, peak


def finalize_utterance(session_id, sample_rate, model_key):
    raw = state.utterance_buffers.get(session_id, b"")

    if not raw:
        return {"type": "empty"}

    i16 = bytes_to_i16(raw)
    i16 = resample_i16_mono(i16, sample_rate, TARGET_SR)

    wav_path = os.path.join(SESSIONS_DIR, f"{session_id}_{uuid.uuid4().hex}.wav")
    write_wav_i16(wav_path, i16, TARGET_SR)

    state.utterance_buffers[session_id] = b""
    state.voice_active_flags[session_id] = False
    state.silence_ms_accum[session_id] = 0.0

    model_path = resolve_model_path(model_key)
    transcript = run_whisper_on_file(wav_path, model_path)

    if not transcript:
        return {"type": "no_speech"}

    pred = predict_intent_rule_based(transcript)
    widget = intent_to_widget_tuple(pred)

    return {
        "type": "final",
        "transcript": transcript,
        "intent": pred,
        "widget": widget
    }

def flush_session(session_id: str, sample_rate: int, model_key: str = None):
    result = finalize_utterance(session_id, sample_rate, model_key)
    state.awake_until_ts[session_id] = 0.0
    state.rolling_buffers[session_id] = b""
    state.preroll_buffers[session_id] = b""
    state.command_armed_until_ts[session_id] = 0.0
    state.command_capture_started[session_id] = False
    return result

def process_audio_chunk(
    session_id: str,
    raw_bytes: bytes,
    sample_rate: int,
    model_key: str = None,
    wake_mode: bool = False,
):
    i16 = bytes_to_i16(raw_bytes)
    if i16.size == 0:
        return {"type": "noop"}

    rms, peak = compute_audio_features(i16)

    VOICE_ON_RMS = 0.0060
    VOICE_OFF_RMS = 0.0038
    VOICE_PEAK_ON = 650
    VOICE_PEAK_OFF = 320
    SILENCE_TIMEOUT_MS = (
        WAKE_COMMAND_SILENCE_TIMEOUT_MS if wake_mode else PTT_SILENCE_TIMEOUT_MS
    )
    PREROLL_MS = 450

    if session_id not in state.utterance_buffers:
        state.utterance_buffers[session_id] = b""
        state.silence_ms_accum[session_id] = 0.0
        state.voice_active_flags[session_id] = False
        state.preroll_buffers[session_id] = b""
        state.rolling_buffers[session_id] = b""

    chunk_ms = (len(raw_bytes) / 2 / max(1, sample_rate)) * 1000.0

    # preroll buffer
    pr_max_bytes = int(sample_rate * (PREROLL_MS / 1000.0)) * 2
    pr = state.preroll_buffers.get(session_id, b"")
    pr = (pr + raw_bytes)[-pr_max_bytes:]
    state.preroll_buffers[session_id] = pr

    if not wake_mode:
        state.awake_until_ts[session_id] = 0.0
        state.rolling_buffers[session_id] = b""

    # wake-word stage
    if wake_mode and not is_awake(session_id):
        ww_max_bytes = int(sample_rate * WAKE_DURATION_SEC) * 2
        ww_rb = state.rolling_buffers.get(session_id, b"")
        ww_rb = (ww_rb + raw_bytes)[-ww_max_bytes:]
        state.rolling_buffers[session_id] = ww_rb

        if not is_awake(session_id):
            enough = len(ww_rb) >= int(sample_rate * WAKE_DURATION_SEC * 2 * 0.90)

            if enough and not in_cooldown(session_id):
                feat = wake_featurize_from_i16(bytes_to_i16(ww_rb), sample_rate)
                if feat is not None:
                    prob = wake_predict_prob(feat)

                    if prob >= WAKE_PROB_THRESHOLD:
                        set_awake(session_id, WAKE_AWAKE_WINDOW_SEC)
                        set_cooldown(session_id, WAKE_COOLDOWN_SEC)

                        # Enter armed state: wait a short moment before accepting command speech
                        state.command_armed_until_ts[session_id] = now_ts() + WAKE_ARM_DELAY_SEC
                        state.command_capture_started[session_id] = False

                        # Clear stale buffers so previous/wake audio does not leak into command
                        state.utterance_buffers[session_id] = b""
                        state.silence_ms_accum[session_id] = 0.0
                        state.voice_active_flags[session_id] = False
                        state.rolling_buffers[session_id] = b""
                        state.preroll_buffers[session_id] = b""
                        state.session_text[session_id] = ""

                        return {
                            "type": "wake_detected",
                            "wake_prob": prob,
                            "awake": True,
                            "rms": rms,
                            "peak": peak,
                        }

                    return {
                        "type": "wake_listening",
                        "wake_prob": prob,
                        "awake": False,
                        "rms": rms,
                        "peak": peak,
                    }

            return {
                "type": "wake_listening",
                "awake": False,
                "rms": rms,
                "peak": peak,
            }
        
    # Wake mode armed state: wait briefly after wake, then wait for fresh speech
    if wake_mode and is_awake(session_id):
        armed_until = float(state.command_armed_until_ts.get(session_id, 0.0) or 0.0)
        capture_started = bool(state.command_capture_started.get(session_id, False))

        # During arm delay, ignore audio and do not capture yet
        if now_ts() < armed_until:
            return {
                "type": "armed_after_wake",
                "awake": True,
                "rms": rms,
                "peak": peak,
            }

    prev_voice = state.voice_active_flags.get(session_id, False)

    if prev_voice:
        is_voice = (rms >= VOICE_OFF_RMS) or (peak >= VOICE_PEAK_OFF)
    else:
        is_voice = (rms >= VOICE_ON_RMS) or (peak >= VOICE_PEAK_ON)

    # print(
    # f"[VAD] session={session_id} awake={is_awake(session_id)} "
    # f"rms={rms:.6f} peak={peak} is_voice={is_voice} "
    # f"sil_ms={state.silence_ms_accum.get(session_id, 0.0):.1f}"
    # )

    if is_voice:
        state.voice_active_flags[session_id] = True
        state.silence_ms_accum[session_id] = 0.0

        if wake_mode and is_awake(session_id):
            if not state.command_capture_started.get(session_id, False):
                strong_voice = (rms >= 0.010) or (peak >= 900)

                if not strong_voice:
                    return {
                        "type": "armed_after_wake",
                        "awake": True,
                        "rms": rms,
                        "peak": peak,
                    }

                state.command_capture_started[session_id] = True
                state.utterance_buffers[session_id] = raw_bytes
            else:
                state.utterance_buffers[session_id] += raw_bytes
        else:
            if len(state.utterance_buffers[session_id]) == 0 and len(pr) > 0:
                state.utterance_buffers[session_id] += pr + raw_bytes
            else:
                state.utterance_buffers[session_id] += raw_bytes

        return {
            "type": "listening",
            "awake": is_awake(session_id) if wake_mode else None,
            "rms": rms,
            "peak": peak,
        }

    if state.voice_active_flags.get(session_id, False):
        state.silence_ms_accum[session_id] += chunk_ms

        # print(f"[SILENCE] session={session_id} sil_ms={state.silence_ms_accum[session_id]:.1f}")

        if state.silence_ms_accum[session_id] >= SILENCE_TIMEOUT_MS:
            result = finalize_utterance(session_id, sample_rate, model_key)

            if wake_mode:
                state.awake_until_ts[session_id] = 0.0
                state.rolling_buffers[session_id] = b""
                state.preroll_buffers[session_id] = b""
                state.command_armed_until_ts[session_id] = 0.0
                state.command_capture_started[session_id] = False

            return result

    return {
        "type": "idle" if not wake_mode else "awake_idle",
        "awake": is_awake(session_id) if wake_mode else None,
        "rms": rms,
        "peak": peak,
    }