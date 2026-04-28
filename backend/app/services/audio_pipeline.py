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

POST_WAKE_IGNORE_MS = 350
MIN_COMMAND_AUDIO_MS = 450
MIN_SILENCE_AFTER_SPEECH_MS = 500
WAKE_STRONG_RMS = 0.012
WAKE_STRONG_PEAK = 1200

from app.utils.audio_utils import bytes_to_i16, resample_i16_mono, write_wav_i16
from app.services.wakeword_service import (
    wake_featurize_from_i16,
    wake_predict_prob,
)
from app.services.note_service import create_note
from app.services.reminder_service import create_reminder
from app.services.asr_service import asr_service
from app.services.task_service import create_task, list_tasks, delete_task_by_index
from app.services.alarm_service import create_alarm, list_alarms, delete_alarm_by_index
from app.services.history_service import create_history_record, list_history, clear_history
from app.utils.reminder_parser import parse_reminder
from app.services.assistant_response_builder import build_reminder_created
from app.services.assistant_router import detect_reminder_intent
from app.utils.task_alarm_parser import parse_task_text, parse_alarm_time, parse_delete_index
from app.services.assistant_router import detect_task_alarm_intent
from app.services.state_manager import (
    get_session,
    begin_processing,
    finish_processing,
    arm_session,
    is_awake,
    in_cooldown,
    set_cooldown,
    reset_utterance,
)

from app.services.assistant_response_builder import (
    build_success_response,
    build_clarification_response,
    build_failure_response,
    build_note_mode_started,
    build_note_mode_update,
    build_note_mode_stopped,
    build_task_created,
    build_alarm_created,
    build_task_list,
    build_alarm_list,
    build_task_deleted,
    build_alarm_deleted,
    build_history_list,
    build_history_cleared,
)

from app.services.assistant_router import (
    normalize_intent_result,
    build_action_and_message,
    detect_note_mode_intent,
    detect_builtin_command_intent,
    detect_media_intent,
    detect_media_control_intent,
    detect_search_control_intent,
    detect_history_intent,
)

os.makedirs(SESSIONS_DIR, exist_ok=True)


def now_ts():
    return time.time()

def compute_audio_features(i16):
    if i16.size == 0:
        return 0.0, 0
    f = i16.astype(np.float32) / 32768.0
    rms = float(np.sqrt(np.mean(f * f) + 1e-12))
    peak = int(np.max(np.abs(i16)))
    return rms, peak


def maybe_make_partial(state_obj, sample_rate):
    if not state_obj.is_speaking:
        return None

    raw = b"".join(state_obj.audio_frames)
    if len(raw) < int(sample_rate * 0.4) * 2:
        return None

    last_ts = float(state_obj.context.get("last_partial_ts", 0.0))
    if now_ts() - last_ts < 0.5:
        return None

    i16 = bytes_to_i16(raw)
    i16 = resample_i16_mono(i16, sample_rate, TARGET_SR)

    wav_path = os.path.join(
        SESSIONS_DIR,
        f"partial_{state_obj.session_id}_{uuid.uuid4().hex}.wav"
    )
    write_wav_i16(wav_path, i16, TARGET_SR)

    try:
        result = asr_service.transcribe_file(
            wav_path,
            beam_size=1,
            vad_filter=True,
        )
        text = (result.get("text") or "").strip()
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass

    if not text:
        return None

    if text == state_obj.partial_text:
        state_obj.context["last_partial_ts"] = now_ts()
        return None

    state_obj.partial_text = text
    state_obj.context["last_partial_ts"] = now_ts()

    return {
        "type": "partial",
        "text": text,
    }

def log_history_from_response(state_obj, response: dict):
    if not isinstance(response, dict):
        return response

    response_type = response.get("type")
    if response_type not in (
        "assistant_response",
        "assistant_clarification",
        "reminder_created",
        "note_mode_started",
        "note_mode_stopped",
    ):
        return response

    create_history_record(
        session_id=state_obj.session_id,
        user_id=state_obj.context.get("user_id"),
        transcript=response.get("transcript", ""),
        intent=response.get("intent"),
        status=response.get("status", "unknown"),
        message=response.get("message", ""),
        action=response.get("action", {}),
        ui=response.get("ui", {}),
        confidence=response.get("confidence"),
    )
    return response

def finalize_utterance(state_obj, transcript: str):
    if not isinstance(transcript, str):
        transcript = str(transcript)

    transcript = (transcript or "").strip()
    assistant_state = state_obj.context.setdefault("assistant_state", {})
    context_type = assistant_state.get("context_type")
    last_action = assistant_state.get("last_action")

    if not transcript:
        return {
            "type": "empty",
            "status": "no_speech",
        }

    text_l = transcript.lower().strip()

    if getattr(state_obj, "mode", None) == "note_mode":
        note_intent = detect_note_mode_intent(transcript)

        if note_intent == "exit_note_mode":
            full_note = stop_note_mode(state_obj)

            if not full_note:
                return log_history_from_response(
                    state_obj,
                    build_note_mode_stopped("", saved_note=None)
                )

            saved_note = create_note(state_obj.session_id, full_note)
            print("[NOTE MODE] stopped:", full_note, flush=True)
            print(f"[NOTE SAVED] {saved_note['id']} | {saved_note['text']}", flush=True)
            return log_history_from_response(
                state_obj,
                build_note_mode_stopped(full_note, saved_note=saved_note)
            )

        append_note_text(state_obj, transcript)
        live_text = " ".join(state_obj.context.get("note_buffer", []))
        print("[NOTE MODE] update:", live_text, flush=True)
        return build_note_mode_update(live_text)

    note_intent = detect_note_mode_intent(transcript)
    if note_intent == "enter_note_mode":
        start_note_mode(state_obj)
        print("[NOTE MODE] started", flush=True)
        return log_history_from_response(
            state_obj,
            build_note_mode_started()
        )
    
    looks_like_supported_command = (
        text_l.startswith("open ")
        or text_l.startswith("search ")
        or text_l.startswith("search for ")
        or "what time is it" in text_l
        or "tell me the time" in text_l
        or "current time" in text_l
        or "time now" in text_l
        or "scroll up" in text_l
        or "scroll down" in text_l
        or "go back" in text_l
        or "navigate back" in text_l
        or "back page" in text_l
        or "go home" in text_l
        or "navigate home" in text_l
        or "home page" in text_l
        or text_l.startswith("search youtube ")
        or text_l.startswith("play youtube ")
        or "pause media" in text_l
        or "resume media" in text_l
        or text_l == "pause"
        or text_l == "resume"
        or "task" in text_l
        or "alarm" in text_l
        or "history" in text_l
    )

    reminder_intent = detect_reminder_intent(transcript)

    if reminder_intent == "create_reminder":
        task, time_text = parse_reminder(transcript)
        assistant_state["last_action"] = "reminder"
        assistant_state["context_type"] = "reminder"

        if not task or not time_text:
            return log_history_from_response(
                state_obj,
                build_clarification_response(
                    transcript=transcript,
                    intent_name="create_reminder",
                    confidence=0.5,
                    message="Please say like: remind me to study at 6pm",
                    suggestions=[
                        "Remind me to study at 6pm",
                        "Set reminder meeting at 3pm"
                    ],
                    session_mode=state_obj.mode,
                )
            )
        
        reminder = create_reminder(state_obj.session_id, task, time_text)

        return log_history_from_response(state_obj, build_reminder_created(reminder))
    
    task_alarm_intent = detect_task_alarm_intent(transcript)

    if task_alarm_intent == "create_task":
        task_text = parse_task_text(transcript)
        assistant_state["last_action"] = "task"
        assistant_state["context_type"] = "task"

        if not task_text:
            return log_history_from_response(
                state_obj,
                build_clarification_response(
                    transcript=transcript,
                    intent_name="create_task",
                    confidence=0.5,
                    message="Please say like: add task finish report",
                    suggestions=[
                        "Add task finish report",
                        "Create task buy groceries",
                    ],
                    session_mode=state_obj.mode,
                )
            )

        task = create_task(state_obj.session_id, task_text)
        return log_history_from_response(state_obj, build_task_created(task))

    if task_alarm_intent == "list_tasks":
        tasks = list_tasks(state_obj.session_id)
        return log_history_from_response(state_obj, build_task_list(tasks, transcript))

    if task_alarm_intent == "delete_task":
        index = parse_delete_index(transcript, ["delete task", "remove task"])
        deleted = delete_task_by_index(state_obj.session_id, index or 0)
        return log_history_from_response(state_obj, build_task_deleted(deleted, index or 0))

    if task_alarm_intent == "create_alarm":
        time_text = parse_alarm_time(transcript)
        assistant_state["last_action"] = "alarm"
        assistant_state["context_type"] = "alarm"
        
        if not time_text:
            return log_history_from_response(
                state_obj,
                build_clarification_response(
                    transcript=transcript,
                    intent_name="create_alarm",
                    confidence=0.5,
                    message="Please say like: set alarm 6 AM",
                    suggestions=[
                        "Set alarm 6 AM",
                        "Create alarm 7:30 tomorrow morning",
                    ],
                    session_mode=state_obj.mode,
                )
            )

        alarm = create_alarm(state_obj.session_id, time_text)
        return log_history_from_response(state_obj, build_alarm_created(alarm))

    if task_alarm_intent == "list_alarms":
        alarms = list_alarms(state_obj.session_id)
        return log_history_from_response(state_obj, build_alarm_list(alarms, transcript))

    if task_alarm_intent == "delete_alarm":
        index = parse_delete_index(transcript, ["delete alarm", "remove alarm"])
        deleted = delete_alarm_by_index(state_obj.session_id, index or 0)
        return log_history_from_response(state_obj, build_alarm_deleted(deleted, index or 0))
    
    media_intent, media_slots = detect_media_intent(transcript)

    if media_intent:
        assistant_state["last_action"] = "media"
        assistant_state["context_type"] = "media"
        action, ui, message = build_action_and_message(
            media_intent,
            transcript,
            media_slots,
        )

        return log_history_from_response(
            state_obj,
            build_success_response(
                transcript=transcript,
                intent_name=media_intent,
                confidence=0.95,
                message=message,
                action=action,
                ui=ui,
                session_mode="sleep",
            )
        )
    
    history_intent = detect_history_intent(transcript)

    if history_intent == "list_history":
        assistant_state["last_action"] = "history"
        assistant_state["context_type"] = "history"
        items = list_history(state_obj.session_id, limit=20)
        return log_history_from_response(state_obj, build_history_list(items, transcript))

    if history_intent == "clear_history":
        clear_history(state_obj.session_id)
        return log_history_from_response(state_obj, build_history_cleared())
    
    if context_type == "media":
        media_control_intent, media_control_slots = detect_media_control_intent(transcript)

        if media_control_intent:
            action, ui, message = build_action_and_message(
                media_control_intent,
                transcript,
                media_control_slots,
            )

            return log_history_from_response(
                state_obj,
                build_success_response(
                    transcript=transcript,
                    intent_name=media_control_intent,
                    confidence=0.95,
                    message=message,
                    action=action,
                    ui=ui,
                    session_mode="sleep",
                )
            )

    if context_type == "search":
        search_control_intent, search_control_slots = detect_search_control_intent(transcript)

        if search_control_intent:
            action, ui, message = build_action_and_message(
                search_control_intent,
                transcript,
                search_control_slots,
            )

            return log_history_from_response(
                state_obj,
                build_success_response(
                    transcript=transcript,
                    intent_name=search_control_intent,
                    confidence=0.95,
                    message=message,
                    action=action,
                    ui=ui,
                    session_mode="sleep",
                )
            )
        
        if "result" in text_l or "open" in text_l:
            return log_history_from_response(
                state_obj,
                build_clarification_response(
                    transcript=transcript,
                    intent_name="search_control",
                    confidence=0.4,
                    message="Say like: open first result, next result, or previous result.",
                    suggestions=[
                        "Open first result",
                        "Next result",
                        "Previous result"
                    ],
                    session_mode=state_obj.mode,
                )
        )

    if not looks_like_supported_command and len(transcript.split()) < 6:
        if len(transcript.split()) < 2:
            return log_history_from_response(
                state_obj,
                build_clarification_response(
                    transcript=transcript,
                    intent_name="unknown",
                    confidence=0.0,
                    message="Can you say that again more clearly?",
                    suggestions=["Search for cats", "Open YouTube"],
                    session_mode=state_obj.mode,
                )
            )
        return log_history_from_response(
            state_obj,
            build_clarification_response(
                transcript=transcript,
                intent_name="unknown",
                confidence=0.0,
                message="I didn’t understand that clearly. Try saying: open YouTube, search for cats, what time is it, or start note mode.",
                suggestions=[
                    "Open YouTube",
                    "Search for cats",
                    "What time is it",
                    "Start note mode",
                ],
                session_mode=state_obj.mode,
            )
        )

    intent_name, confidence, slots = detect_builtin_command_intent(transcript)

    if not intent_name:
        try:
            pred = state_obj.intent_model.predict(transcript)
        except Exception:
            pred = None

        intent_name, confidence, slots = normalize_intent_result(pred)

    state_obj.context.setdefault("assistant_state", {})

    assistant_state = state_obj.context.setdefault("assistant_state", {})
    context_type = assistant_state.get("context_type")
    prev_intent = assistant_state.get("last_intent")
    prev_slots = assistant_state.get("last_slots", {})
    prev_transcript = assistant_state.get("last_transcript")

    if intent_name == "scroll" and prev_intent == "search":
        confidence = max(confidence, 0.85)

    if intent_name == "open" and prev_intent == "search":
        confidence = max(confidence, 0.85)

    VALID_INTENTS = {"open", "search", "time", "scroll", "navigate"}

    if intent_name not in VALID_INTENTS:
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    if intent_name == "open" and not text_l.startswith("open "):
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    if intent_name == "search" and not (
        text_l.startswith("search ")
        or text_l.startswith("search for ")
    ):
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    if intent_name == "time" and not any(x in text_l for x in [
        "what time is it",
        "tell me the time",
        "current time",
        "time now",
    ]):
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    if intent_name == "scroll" and not (
        "scroll up" in text_l or "scroll down" in text_l
    ):
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    if intent_name == "navigate" and not any(x in text_l for x in [
        "go back",
        "navigate back",
        "back page",
        "go home",
        "navigate home",
        "home page",
    ]):
        intent_name = "unknown"
        confidence = 0.0
        slots = {}

    LOW_CONF = 0.60
    MID_CONF = 0.80

    if intent_name in (None, "", "unknown") or confidence < LOW_CONF:
        print("DEBUG PATH: low/unknown clarification", flush=True)
        return log_history_from_response(
            state_obj,
            build_clarification_response(
                transcript=transcript,
                intent_name=intent_name,
                confidence=confidence,
                message="I didn’t understand that clearly. Try saying: open YouTube, search for cats, what time is it, or start note mode.",
                suggestions=[
                    "Open YouTube",
                    "Search for cats",
                    "What time is it",
                    "Start note mode",
                ],
                session_mode=state_obj.mode,
            )
        )

    if confidence < MID_CONF:
        print("DEBUG PATH: mid clarification", flush=True)
        return log_history_from_response(
            state_obj,
            build_clarification_response(
                transcript=transcript,
                intent_name=intent_name,
                confidence=confidence,
                message=f"I think you meant '{intent_name}'. Please say it again if that is not correct.",
                suggestions=[
                    transcript,
                    "Open YouTube",
                    "Search for cats",
                ],
                session_mode=state_obj.mode,
            )
        )

    action, ui, message = build_action_and_message(
        intent_name, transcript, slots
    )

    if action is None:
        print("DEBUG PATH: action none clarification", flush=True)
        return log_history_from_response(
            state_obj,
            build_clarification_response(
                transcript=transcript,
                intent_name=intent_name,
                confidence=confidence,
                message=f"I heard: '{transcript}'. I’m not sure what you want. Try saying open YouTube, search for cats, or what time is it.",
                suggestions=[
                    "Open YouTube",
                    "Search for cats",
                    "What time is it",
                ],
                session_mode=state_obj.mode,
            )
        )
    
    assistant_state["last_transcript"] = transcript
    assistant_state["last_intent"] = intent_name
    assistant_state["last_confidence"] = confidence
    assistant_state["last_slots"] = slots
    if intent_name in ("search", "search_open_result", "search_next", "search_prev"):
        assistant_state["last_action"] = "search"
        assistant_state["context_type"] = "search"

    elif intent_name in ("media_search", "media_select", "media_next", "media_prev"):
        assistant_state["last_action"] = "media"
        assistant_state["context_type"] = "media"

    elif intent_name in ("create_task", "list_tasks", "delete_task"):
        assistant_state["context_type"] = "task"

    elif intent_name in ("create_alarm", "list_alarms", "delete_alarm"):
        assistant_state["context_type"] = "alarm"

    else:
        assistant_state["last_action"] = intent_name

    return log_history_from_response(
        state_obj,build_success_response(
            transcript=transcript,
            intent_name=intent_name,
            confidence=confidence,
            message=message,
            action=action,
            ui=ui,
            session_mode="sleep",
        )
    )

def transcribe_current_audio_frames(state_obj, sample_rate):
    if not state_obj.audio_frames:
        return ""

    raw = b"".join(state_obj.audio_frames)

    i16 = bytes_to_i16(raw)
    i16 = resample_i16_mono(i16, sample_rate, TARGET_SR)

    wav_path = os.path.join(
        SESSIONS_DIR,
        f"final_{state_obj.session_id}_{uuid.uuid4().hex}.wav"
    )

    write_wav_i16(wav_path, i16, TARGET_SR)

    try:
        result = asr_service.transcribe_file(
            wav_path,
            beam_size=3,
            vad_filter=True,
        )
        text = (result.get("text") or "").strip()
    finally:
        try:
            os.remove(wav_path)
        except OSError:
            pass

    return text

def flush_session(session_id: str, sample_rate: int, model_key: str = None):
    state_obj = get_session(session_id)

    result = {"type": "empty"}
    if state_obj.audio_frames:
        transcript = transcribe_current_audio_frames(state_obj, sample_rate)
        result = finalize_utterance(state_obj, transcript)

    reset_utterance(state_obj)

    if result.get("type") not in ("note_mode_started", "note_mode_update"):
        state_obj.is_awake = False
        if result.get("type") != "note_mode_stopped":
            state_obj.mode = "sleep"

    state_obj.context["rolling"] = b""
    state_obj.context["preroll"] = b""
    state_obj.context["capture_started"] = False
    state_obj.context["armed_until"] = 0.0
    state_obj.context["last_partial_ts"] = 0.0
    state_obj.context["speech_ms"] = 0.0

    return result

def force_sleep(state_obj):
    reset_utterance(state_obj)
    state_obj.is_awake = False
    state_obj.mode = "sleep"
    state_obj.command_window_until = 0.0
    state_obj.context["rolling"] = b""
    state_obj.context["preroll"] = b""
    state_obj.context["capture_started"] = False
    state_obj.context["armed_until"] = 0.0
    state_obj.context["post_wake_ignore_until"] = 0.0
    state_obj.context["wake_detected_at"] = 0.0
    state_obj.context["speech_ms"] = 0.0

def start_note_mode(state_obj):
    state_obj.mode = "note_mode"
    state_obj.active_feature = "note_mode"
    state_obj.context["note_buffer"] = []
    state_obj.context["note_last_emit"] = ""
    state_obj.audio_frames = []
    state_obj.partial_text = ""
    state_obj.silence_ms = 0.0
    state_obj.is_speaking = False
    state_obj.context["speech_ms"] = 0.0

def append_note_text(state_obj, text: str):
    text = (text or "").strip()
    if not text:
        return

    buffer = state_obj.context.setdefault("note_buffer", [])

    if not buffer or buffer[-1] != text:
        buffer.append(text)

def stop_note_mode(state_obj):
    full_note = " ".join(state_obj.context.get("note_buffer", [])).strip()
    state_obj.mode = "sleep"
    state_obj.active_feature = None
    state_obj.context["note_buffer"] = []
    state_obj.context["note_last_emit"] = ""
    return full_note

def process_audio_chunk(
    session_id: str,
    raw_bytes: bytes,
    sample_rate: int,
    model_key: str = None,
    wake_mode: bool = False,
):
    state_obj = get_session(session_id)

    i16 = bytes_to_i16(raw_bytes)
    if i16.size == 0:
        return {"type": "noop"}

    rms, peak = compute_audio_features(i16)

    VOICE_ON_RMS = 0.012
    VOICE_OFF_RMS = 0.007
    VOICE_PEAK_ON = 1200
    VOICE_PEAK_OFF = 700
    SILENCE_TIMEOUT_MS = (
        WAKE_COMMAND_SILENCE_TIMEOUT_MS if wake_mode else PTT_SILENCE_TIMEOUT_MS
    )
    PREROLL_MS = 450

    chunk_ms = (len(raw_bytes) / 2 / max(1, sample_rate)) * 1000.0

    pr_max_bytes = int(sample_rate * (PREROLL_MS / 1000.0)) * 2
    pr = state_obj.context.get("preroll", b"")
    pr = (pr + raw_bytes)[-pr_max_bytes:]
    state_obj.context["preroll"] = pr

    if state_obj.mode == "note_mode":
        prev_voice = state_obj.is_speaking

        if prev_voice:
            is_voice_now = (rms >= VOICE_OFF_RMS) or (peak >= VOICE_PEAK_OFF)
        else:
            is_voice_now = (rms >= VOICE_ON_RMS) or (peak >= VOICE_PEAK_ON)

        if is_voice_now:
            state_obj.is_speaking = True
            state_obj.silence_ms = 0.0
            state_obj.audio_frames.append(raw_bytes)

            partial = maybe_make_partial(state_obj, sample_rate)
            if partial:
                partial["rms"] = rms
                partial["peak"] = peak
                return partial

            return {
                "type": "listening",
                "awake": True,
                "rms": rms,
                "peak": peak,
            }

        if state_obj.is_speaking:
            state_obj.silence_ms += chunk_ms

            enough_speech = len(state_obj.audio_frames) > 0
            NOTE_MODE_SILENCE_MS = 300
            enough_silence = state_obj.silence_ms >= NOTE_MODE_SILENCE_MS

            if enough_silence and enough_speech:
                transcript = transcribe_current_audio_frames(state_obj, sample_rate)
                result = finalize_utterance(state_obj, transcript)

                reset_utterance(state_obj)
                state_obj.is_awake = True
                state_obj.is_speaking = False
                state_obj.silence_ms = 0.0
                state_obj.context["speech_ms"] = 0.0

                return result

        return {
            "type": "listening",
            "awake": True,
            "rms": rms,
            "peak": peak,
        }

    if not wake_mode:
        state_obj.is_awake = False
        state_obj.context["rolling"] = b""
        state_obj.context["capture_started"] = False
        state_obj.context["armed_until"] = 0.0

    if wake_mode and not is_awake(state_obj):
        ww_max_bytes = int(sample_rate * WAKE_DURATION_SEC) * 2
        ww_rb = state_obj.context.get("rolling", b"")
        ww_rb = (ww_rb + raw_bytes)[-ww_max_bytes:]
        state_obj.context["rolling"] = ww_rb

        enough = len(ww_rb) >= int(sample_rate * WAKE_DURATION_SEC * 2 * 0.90)

        if enough and not in_cooldown(state_obj):
            feat = wake_featurize_from_i16(bytes_to_i16(ww_rb), sample_rate)
            if feat is not None:
                prob = wake_predict_prob(feat)

                if prob >= WAKE_PROB_THRESHOLD:
                    arm_session(state_obj, WAKE_AWAKE_WINDOW_SEC)
                    set_cooldown(state_obj, WAKE_COOLDOWN_SEC)

                    now = now_ts()
                    state_obj.context["armed_until"] = now + WAKE_ARM_DELAY_SEC
                    state_obj.context["wake_detected_at"] = now
                    state_obj.context["post_wake_ignore_until"] = now + (POST_WAKE_IGNORE_MS / 1000.0)
                    state_obj.context["capture_started"] = False
                    state_obj.context["speech_ms"] = 0.0

                    state_obj.context["rolling"] = b""
                    state_obj.context["preroll"] = b""
                    state_obj.audio_frames = []
                    state_obj.silence_ms = 0.0
                    state_obj.is_speaking = False
                    state_obj.partial_text = ""
                    state_obj.context["last_partial_ts"] = 0.0

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

    if wake_mode and is_awake(state_obj):
        armed_until = float(state_obj.context.get("armed_until", 0.0) or 0.0)
        post_wake_ignore_until = float(state_obj.context.get("post_wake_ignore_until", 0.0) or 0.0)

        if now_ts() < armed_until or now_ts() < post_wake_ignore_until:
            return {
                "type": "armed_after_wake",
                "awake": True,
                "rms": rms,
                "peak": peak,
            }

        if (
            not state_obj.context.get("capture_started", False)
            and now_ts() >= float(state_obj.command_window_until or 0.0)
        ):
            force_sleep(state_obj)
            return {
                "type": "sleep",
                "awake": False,
                "rms": rms,
                "peak": peak,
            }

    if wake_mode and (not is_awake(state_obj)) and state_obj.mode in ("armed", "listening"):
        force_sleep(state_obj)
        return {
            "type": "sleep",
            "awake": False,
            "rms": rms,
            "peak": peak,
        }

    prev_voice = state_obj.is_speaking

    if prev_voice:
        is_voice_now = (rms >= VOICE_OFF_RMS) or (peak >= VOICE_PEAK_OFF)
    else:
        is_voice_now = (rms >= VOICE_ON_RMS) or (peak >= VOICE_PEAK_ON)

    if is_voice_now:
        state_obj.is_speaking = True
        state_obj.silence_ms = 0.0
        state_obj.context["speech_ms"] = float(state_obj.context.get("speech_ms", 0.0)) + chunk_ms

        if wake_mode and is_awake(state_obj):
            if not state_obj.context.get("capture_started", False):
                strong_voice = (rms >= WAKE_STRONG_RMS) or (peak >= WAKE_STRONG_PEAK)

                if not strong_voice:
                    return {
                        "type": "armed_after_wake",
                        "awake": True,
                        "rms": rms,
                        "peak": peak,
                    }

                state_obj.context["capture_started"] = True
                state_obj.context["speech_ms"] = chunk_ms
                state_obj.audio_frames = [raw_bytes]
            else:
                state_obj.audio_frames.append(raw_bytes)
        else:
            if len(state_obj.audio_frames) == 0 and len(pr) > 0:
                state_obj.audio_frames = [pr, raw_bytes]
            else:
                state_obj.audio_frames.append(raw_bytes)

        partial = maybe_make_partial(state_obj, sample_rate)
        if partial:
            partial["awake"] = is_awake(state_obj) if wake_mode else None
            partial["rms"] = rms
            partial["peak"] = peak
            return partial

        return {
            "type": "listening",
            "awake": is_awake(state_obj) if wake_mode else None,
            "rms": rms,
            "peak": peak,
        }

    if state_obj.is_speaking:
        state_obj.silence_ms += chunk_ms

        enough_speech = float(state_obj.context.get("speech_ms", 0.0)) >= MIN_COMMAND_AUDIO_MS
        enough_silence = state_obj.silence_ms >= max(SILENCE_TIMEOUT_MS, MIN_SILENCE_AFTER_SPEECH_MS)

        if enough_silence and enough_speech:
            if begin_processing(state_obj):
                print(f"[FINALIZE] session={session_id} finalizing utterance")

                transcript = transcribe_current_audio_frames(state_obj, sample_rate)
                result = finalize_utterance(state_obj, transcript)

                if wake_mode:
                    state_obj.context["rolling"] = b""
                    state_obj.context["preroll"] = b""
                    state_obj.context["capture_started"] = False
                    state_obj.context["armed_until"] = 0.0
                    state_obj.context["post_wake_ignore_until"] = 0.0
                    state_obj.context["speech_ms"] = 0.0

                if result.get("type") in ("note_mode_started", "note_mode_update"):
                    reset_utterance(state_obj)
                    state_obj.is_awake = True
                    state_obj.is_speaking = False
                    state_obj.silence_ms = 0.0
                    state_obj.processing_lock = False
                    state_obj.finalizing = False
                    state_obj.context["speech_ms"] = 0.0
                    return result

                if result.get("type") == "note_mode_stopped":
                    finish_processing(state_obj)
                    return result

                finish_processing(state_obj)
                return result

        if state_obj.silence_ms >= SILENCE_TIMEOUT_MS and not enough_speech:
            state_obj.audio_frames = []
            state_obj.is_speaking = False
            state_obj.silence_ms = 0.0
            state_obj.partial_text = ""
            state_obj.context["last_partial_ts"] = 0.0
            state_obj.context["speech_ms"] = 0.0

            if wake_mode and is_awake(state_obj):
                state_obj.context["capture_started"] = False
                return {
                    "type": "awake_idle",
                    "awake": True,
                    "rms": rms,
                    "peak": peak,
                }
            
    awake_flag = is_awake(state_obj) if wake_mode else None

    return {
        "type": "awake_idle" if awake_flag else "idle",
        "awake": awake_flag,
        "rms": rms,
        "peak": peak,
    }