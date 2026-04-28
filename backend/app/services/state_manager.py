import time
from app.models.session_state import VoiceSessionState

# store all sessions
sessions: dict[str, VoiceSessionState] = {}

def now() -> float:
    return time.time()

def get_session(session_id: str) -> VoiceSessionState:
    if session_id not in sessions:
        sessions[session_id] = VoiceSessionState(session_id=session_id)
    return sessions[session_id]

def touch(state: VoiceSessionState):
    state.updated_at = now()

def reset_utterance(state: VoiceSessionState):
    state.is_speaking = False
    state.speech_started_at = 0.0
    state.last_voice_at = 0.0
    state.silence_ms = 0

    state.partial_text = ""
    state.final_text = ""

    state.predicted_intent = None
    state.intent_confidence = 0.0
    state.slots.clear()
    state.needs_clarification = False

    state.audio_frames.clear()
    state.utterance_id = None

    state.finalizing = False
    state.processing_lock = False

    touch(state)

def arm_session(state: VoiceSessionState, window_sec: float = 6.0):
    state.mode = "armed"
    state.is_awake = True
    state.wake_detected_at = now()
    state.command_window_until = state.wake_detected_at + window_sec
    reset_utterance(state)

def is_awake(state: VoiceSessionState) -> bool:
    return state.is_awake and now() < state.command_window_until

def set_cooldown(state: VoiceSessionState, seconds: float):
    state.cooldown_until = now() + seconds

def in_cooldown(state: VoiceSessionState) -> bool:
    return now() < state.cooldown_until

def begin_listening(state: VoiceSessionState, utterance_id: str):
    state.mode = "listening"
    state.is_speaking = True
    state.speech_started_at = now()
    state.last_voice_at = now()
    state.utterance_id = utterance_id
    reset_utterance(state)

def begin_processing(state: VoiceSessionState) -> bool:
    if state.processing_lock or state.finalizing:
        return False

    state.mode = "processing"
    state.processing_lock = True
    state.finalizing = True
    touch(state)
    return True

def finish_processing(state: VoiceSessionState):
    state.last_final_text = state.final_text
    set_cooldown(state, 1.0)

    reset_utterance(state)

    state.mode = "sleep"
    state.is_awake = False
    touch(state)

def enter_hold_mode(state: VoiceSessionState):
    state.mode = "hold"
    state.hold_active = True
    state.is_awake = True
    touch(state)

def exit_hold_mode(state: VoiceSessionState):
    state.hold_active = False
    state.mode = "sleep"
    state.is_awake = False
    reset_utterance(state)
    touch(state)

def enter_note_mode(state: VoiceSessionState):
    state.mode = "note_mode"
    state.active_feature = "note_mode"
    state.is_awake = True
    state.live_note_buffer = ""
    touch(state)

def exit_note_mode(state: VoiceSessionState):
    state.active_feature = None
    state.live_note_buffer = ""
    reset_utterance(state)
    state.mode = "sleep"
    state.is_awake = False
    touch(state)