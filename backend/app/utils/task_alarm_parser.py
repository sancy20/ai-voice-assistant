import re


def _normalize(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[,\.\!\?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_task_text(transcript: str):
    text = _normalize(transcript)

    patterns = [
        r"^add task\s+(.+)$",
        r"^create task\s+(.+)$",
        r"^new task\s+(.+)$",
    ]

    for p in patterns:
        m = re.match(p, text, flags=re.IGNORECASE)
        if m:
            value = m.group(1).strip()
            return value if value else None

    return None


def parse_delete_index(transcript: str, prefix_words: list[str]):
    text = _normalize(transcript)

    for prefix in prefix_words:
        normalized_prefix = _normalize(prefix)
        m = re.match(rf"^{re.escape(normalized_prefix)}\s+(\d+)$", text)
        if m:
            return int(m.group(1))

    return None


def parse_alarm_time(transcript: str):
    text = _normalize(transcript)

    patterns = [
        r"^set alarm\s+(.+)$",
        r"^create alarm\s+(.+)$",
        r"^add alarm\s+(.+)$",
    ]

    for p in patterns:
        m = re.match(p, text, flags=re.IGNORECASE)
        if m:
            value = m.group(1).strip()
            return value if value else None

    return None