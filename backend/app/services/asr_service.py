from app.services.asr_faster_whisper import FasterWhisperASR
from app.config import *

asr_service = FasterWhisperASR(
    model_size=ASR_MODEL_SIZE,
    device=ASR_DEVICE,
    compute_type=ASR_COMPUTE_TYPE,
    language=ASR_LANGUAGE,
)