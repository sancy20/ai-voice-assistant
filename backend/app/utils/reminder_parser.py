import re

def normalize_time(t: str) -> str:
    t = t.lower().strip()
    t = t.replace(" a", "am").replace(" p", "pm")
    t = t.replace(" ", "")
    return t


def clean_task(task: str) -> str:
    task = task.strip()

    task = re.sub(r"\b(the|a|an)$", "", task).strip()

    return task


def parse_reminder(text: str):
    text = text.lower().strip()

    match = re.search(r"(?:remind me to|set reminder)\s+(.+?)\s+at\s+(.+)", text)

    if match:
        task = clean_task(match.group(1))
        time_raw = match.group(2)
        time_clean = normalize_time(time_raw)

        return task, time_clean

    return None, None