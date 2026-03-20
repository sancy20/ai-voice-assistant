import os
import subprocess

from app.config import WHISPER_BIN


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