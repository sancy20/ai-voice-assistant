from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List
import time

@dataclass
class VoiceSessionState:
    session_id: str

    mode: str = "sleep"   # sleep | armed | listening | processing | hold | note_mode

    is_awake: bool = False
    wake_enabled: bool = True
    hold_active: bool = False

    wake_detected_at: float = 0.0
    command_window_until: float = 0.0
    cooldown_until: float = 0.0

    is_speaking: bool = False
    speech_started_at: float = 0.0
    last_voice_at: float = 0.0
    silence_ms: int = 0

    partial_text: str = ""
    final_text: str = ""
    last_final_text: str = ""
    live_note_buffer: str = ""

    audio_frames: List[bytes] = field(default_factory=list)
    utterance_id: Optional[str] = None

    finalizing: bool = False
    processing_lock: bool = False

    predicted_intent: Optional[str] = None
    intent_confidence: float = 0.0
    slots: Dict[str, Any] = field(default_factory=dict)
    needs_clarification: bool = False

    active_feature: Optional[str] = None
    context: Dict[str, Any] = field(default_factory=dict)

    created_at: float = field(default_factory=time.time)
    updated_at: float = field(default_factory=time.time)