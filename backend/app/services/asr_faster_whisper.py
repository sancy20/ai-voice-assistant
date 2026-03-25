from __future__ import annotations

import os
import tempfile
from typing import Any, Dict, List, Optional

from faster_whisper import WhisperModel


class FasterWhisperASR:
    def __init__(
        self,
        model_size: str = "base",
        device: str = "cpu",
        compute_type: str = "int8",
        language: Optional[str] = "en",
    ) -> None:
        self.model_size = model_size
        self.device = device
        self.compute_type = compute_type
        self.language = language

        self.model = WhisperModel(
            model_size,
            device=device,
            compute_type=compute_type,
        )

    def transcribe_file(
        self,
        audio_path: str,
        beam_size: int = 1,
        vad_filter: bool = False,
    ) -> Dict[str, Any]:
        segments, info = self.model.transcribe(
            audio_path,
            beam_size=beam_size,
            language=self.language,
            condition_on_previous_text=False,
            vad_filter=vad_filter,
        )

        segment_list: List[Dict[str, Any]] = []
        texts: List[str] = []

        for seg in segments:
            text = (seg.text or "").strip()
            if text:
                texts.append(text)

            segment_list.append(
                {
                    "start": float(seg.start),
                    "end": float(seg.end),
                    "text": text,
                }
            )

        full_text = " ".join(texts).strip()

        return {
            "text": full_text,
            "segments": segment_list,
            "language": getattr(info, "language", None),
            "language_probability": getattr(info, "language_probability", None),
        }

    def transcribe_bytes(
        self,
        audio_bytes: bytes,
        suffix: str = ".wav",
        beam_size: int = 1,
        vad_filter: bool = False,
    ) -> Dict[str, Any]:
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name

        try:
            return self.transcribe_file(
                tmp_path,
                beam_size=beam_size,
                vad_filter=vad_filter,
            )
        finally:
            try:
                os.remove(tmp_path)
            except OSError:
                pass