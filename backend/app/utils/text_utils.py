import re
from datetime import datetime, timezone, timedelta

try:
    from zoneinfo import ZoneInfo
except Exception:
    ZoneInfo = None


def get_local_tz():
    if ZoneInfo is not None:
        try:
            return ZoneInfo("Asia/Phnom_Penh")
        except Exception:
            pass
    return timezone(timedelta(hours=7))


LOCAL_TZ = get_local_tz()

SAFE_OPEN_TARGETS = {
    "chatgpt": ["chatgpt", "chat gpt", "chat g p t"],
    "openai": ["openai", "open ai"],
    "google": ["google"],
    "youtube": ["youtube", "you tube"],
    "github": ["github", "git hub"],
    "gmail": ["gmail", "g mail"],
    "facebook": ["facebook", "face book"],
    "wikipedia": ["wikipedia", "wiki pedia", "wiki"],
    "maps": ["google maps", "maps", "map"],
}


def normalize_text(text: str) -> str:
    t = (text or "").lower().strip()
    t = re.sub(r"[\.,!?;:\(\)\[\]\{\}\"']", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t


def match_open_target(t: str) -> str:
    for key, variants in SAFE_OPEN_TARGETS.items():
        for v in variants:
            if v in t:
                return key
    return ""


def extract_slots(intent: str, t: str) -> dict:
    if intent == "time":
        now = datetime.now(LOCAL_TZ).strftime("%H:%M:%S")
        return {"time": now}

    if intent == "search":
        m = re.search(r"\b(search\s+for|search|find|look\s+up)\s+(.+)$", t)
        q = (m.group(2).strip() if m else "").strip()
        q = re.sub(r"\b(please|now|thanks)\b$", "", q).strip()
        return {"query": q}

    if intent == "open":
        target = match_open_target(t)
        return {"target": target} if target else {"target": ""}

    if intent == "scroll":
        if "down" in t:
            return {"direction": "down", "amount": 300}
        if "up" in t:
            return {"direction": "up", "amount": 300}
        if "top" in t:
            return {"direction": "up", "amount": 999999}
        if "bottom" in t:
            return {"direction": "down", "amount": 999999}
        return {"direction": "", "amount": 300}

    if intent == "navigate":
        if "home" in t:
            return {"target": "home"}
        if "settings" in t:
            return {"target": "settings"}
        if "back" in t:
            return {"target": "back"}
        return {"target": ""}

    return {}