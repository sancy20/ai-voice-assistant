import re


def normalize_time(t: str) -> str:
    t = (t or "").lower().strip()
    t = re.sub(r"\ba\s*m\b", "am", t)
    t = re.sub(r"\bp\s*m\b", "pm", t)
    t = t.replace(" ", "")
    return t


def clean_task(task: str) -> str:
    task = (task or "").strip()
    task = re.sub(r"^(to\s+)", "", task).strip()
    task = re.sub(r"\b(the|a|an)$", "", task).strip()
    return task


def parse_reminder(text: str):
    text = (text or "").lower().strip()
    text = re.sub(r"[,!?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    patterns = [
        # remind me to study at 6 pm
        r"(?:remind me to|remind me|set reminder to|set reminder|set a reminder to|set a reminder)\s+(.+?)\s+at\s+(.+)",

        # remind me at 6 pm to study
        r"(?:remind me|set reminder|set a reminder)\s+at\s+(.+?)\s+to\s+(.+)",

        # reminder to study at 6 pm
        r"(?:reminder to|remember me to|remember to)\s+(.+?)\s+at\s+(.+)",
    ]

    for i, pattern in enumerate(patterns):
        match = re.search(pattern, text)
        if not match:
            continue

        if i == 1:
            time_raw = match.group(1)
            task_raw = match.group(2)
        else:
            task_raw = match.group(1)
            time_raw = match.group(2)

        task = clean_task(task_raw)
        time_clean = normalize_time(time_raw)

        if task and time_clean:
            return task, time_clean

    return None, None