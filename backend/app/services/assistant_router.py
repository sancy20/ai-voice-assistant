from datetime import datetime
from typing import Any
import re

from app.services.search_service import build_search_preview
from app.services.media_service import build_youtube_search_payload

NUMBER_WORDS = {
    "first": 1,
    "second": 2,
    "third": 3,
    "fourth": 4,
    "fifth": 5,
}

def normalize_intent_result(pred: Any):
    if pred is None:
        return "unknown", 0.0, {}

    if isinstance(pred, dict):
        intent_name = pred.get("intent") or pred.get("label") or "unknown"
        confidence = float(pred.get("confidence", 0.0))
        slots = pred.get("slots", {}) or {}
    else:
        intent_name = str(pred).strip().lower()
        confidence = 0.75
        slots = {}

    intent_name = (intent_name or "unknown").lower().strip()

    if intent_name in ("none", "null", "unknown", ""):
        return "unknown", 0.0, slots

    return intent_name, confidence, slots

def detect_note_mode_intent(text: str):
    text = (text or "").lower().strip()

    enter_patterns = [
        "note mode",
        "node mode",
        "not mode",
        "the mode",
        "start note mode",
        "turn on note mode",
        "turn on node mode",
        "turn on the mode",
        "enable note mode",
        "enable node mode",
        "start note",
        "take note",
        "take a note",
        "write note",
        "start dictation",
    ]

    exit_patterns = [
        "exit note mode",
        "stop note mode",
        "disable note mode",
        "stop note",
        "save note",
        "finish note",
        "end note",
        "done note",
        "finish writing",
    ]

    for p in exit_patterns:
        if p in text:
            return "exit_note_mode"

    for p in enter_patterns:
        if p in text:
            return "enter_note_mode"

    return None

def detect_builtin_command_intent(text: str):
    text = (text or "").lower().strip()

    note_mode_intent = detect_note_mode_intent(text)
    if note_mode_intent:
        return note_mode_intent, 0.99, {}

    # time
    if any(x in text for x in [
        "what time is it",
        "tell me the time",
        "current time",
        "time now",
    ]):
        return "time", 0.98, {}

    if text.startswith("open "):
        target = text.replace("open ", "", 1).strip()
        if target:
            return "open", 0.95, {"site": target}

    if text.startswith("search for "):
        query = text.replace("search for ", "", 1).strip()
        if query:
            return "search", 0.95, {"query": query}

    if text.startswith("search "):
        query = text.replace("search ", "", 1).strip()
        if query:
            return "search", 0.92, {"query": query}

    if "scroll down" in text:
        return "scroll", 0.95, {"direction": "down"}

    if "scroll up" in text:
        return "scroll", 0.95, {"direction": "up"}

    if any(x in text for x in ["go back", "navigate back", "back page"]):
        return "navigate", 0.95, {"direction": "back"}

    if any(x in text for x in ["go home", "navigate home", "home page"]):
        return "navigate", 0.95, {"direction": "home"}

    return None, 0.0, {}

def build_action_and_message(intent_name: str, transcript: str, slots: dict):
    intent_name = (intent_name or "").lower().strip()
    transcript = (transcript or "").strip()
    slots = slots or {}

    if intent_name == "enter_note_mode":
        return (
            {"kind": "enter_note_mode", "data": {}},
            {"widget": "note_mode_card"},
            "Note mode is now on. I am listening continuously."
        )

    if intent_name == "exit_note_mode":
        return (
            {"kind": "exit_note_mode", "data": {}},
            {"widget": "note_mode_card"},
            "Stopping note mode."
        )

    if intent_name == "time":
        now_str = datetime.now().strftime("%I:%M %p")
        return (
            {"kind": "show_time", "data": {"time": now_str}},
            {"widget": "time_card"},
            f"The current time is {now_str}."
        )

    if intent_name == "search":
        query = slots.get("query") or transcript
        query = str(query).strip()
        preview = build_search_preview(query)

        return (
            {
                "kind": "search_preview",
                "data": preview,
            },
            {"widget": "search_preview"},
            f"Here are the results for {query}."
        )

    if intent_name == "open":
        target = slots.get("site") or slots.get("app") or transcript
        clean_target = str(target).replace("open ", "").strip()
        return (
            {"kind": "open", "data": {"target": clean_target}},
            {"widget": "action_card"},
            f"Opening {clean_target}."
        )

    if intent_name == "scroll":
        direction = slots.get("direction", "down")
        return (
            {"kind": "scroll", "data": {"direction": direction}},
            {"widget": "action_card"},
            f"Scrolling {direction}."
        )

    if intent_name == "navigate":
        direction = slots.get("direction", "back")
        return (
            {"kind": "navigate", "data": {"direction": direction}},
            {"widget": "action_card"},
            f"Navigating {direction}."
        )
    
    if intent_name == "media_search":
        provider = slots.get("provider", "youtube")
        query = slots.get("query", "").strip()
        payload = build_youtube_search_payload(query)

        return (
            {
                "kind": "media_search",
                "data": payload,
            },
            {"widget": "media_preview"},
            f"Here are the {provider} results for {query}."
        )

    if intent_name == "media_pause":
        return (
            {"kind": "media_pause", "data": {}},
            {"widget": "media_preview"},
            "Pausing media."
        )

    if intent_name == "media_resume":
        return (
            {"kind": "media_resume", "data": {}},
            {"widget": "media_preview"},
            "Resuming media."
        )

    if intent_name == "media_next":
        return (
            {"kind": "media_next", "data": {}},
            {"widget": "media_preview"},
            "Playing the next result."
        )

    if intent_name == "media_prev":
        return (
            {"kind": "media_prev", "data": {}},
            {"widget": "media_preview"},
            "Going to the previous result."
        )

    if intent_name == "media_select":
        idx = int(slots.get("index", 1))
        return (
            {"kind": "media_select", "data": {"index": idx}},
            {"widget": "media_preview"},
            f"Playing result number {idx}."
        )

    if intent_name == "media_pause":
        return (
            {"kind": "media_pause", "data": {}},
            {"widget": "media_preview"},
            "Pausing media."
        )

    if intent_name == "media_resume":
        return (
            {"kind": "media_resume", "data": {}},
            {"widget": "media_preview"},
            "Resuming media."
        )
    
    if intent_name == "search_open_result":
        idx = int(slots.get("index", 1))
        return (
            {"kind": "search_open_result", "data": {"index": idx}},
            {"widget": "search_preview"},
            f"Opening result number {idx}."
        )

    if intent_name == "search_next":
        return (
            {"kind": "search_next", "data": {}},
            {"widget": "search_preview"},
            "Moving to the next result."
        )

    if intent_name == "search_prev":
        return (
            {"kind": "search_prev", "data": {}},
            {"widget": "search_preview"},
            "Moving to the previous result."
        )

    return None, None, None

def detect_reminder_intent(transcript: str):
    t = transcript.lower()

    if "remind me" in t or "set reminder" in t:
        return "create_reminder"

    return None

def detect_media_intent(text: str):
    text = (text or "").lower().strip()
    text = re.sub(r"[,\.\!\?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if text.startswith("search youtube "):
        query = text.replace("search youtube ", "", 1).strip()
        if query:
            return "media_search", {"provider": "youtube", "query": query}

    if text.startswith("play youtube "):
        query = text.replace("play youtube ", "", 1).strip()
        if query:
            return "media_search", {"provider": "youtube", "query": query}

    if text.startswith("play ") and "youtube" in text:
        query = text.replace("play", "", 1).replace("youtube", "", 1).strip()
        if query:
            return "media_search", {"provider": "youtube", "query": query}

    if "pause media" in text or text == "pause":
        return "media_pause", {}

    if "resume media" in text or text == "resume":
        return "media_resume", {}

    return None, {}

def detect_intent(text: str):
    text = text.lower()

    if any(x in text for x in ["play", "youtube", "music", "video"]):
        return {
            "kind": "media_search",
            "data": {
                "query": text.replace("play", "").replace("youtube", "").strip()
            }
        }

    if any(x in text for x in ["search", "find", "look for"]):
        return {
            "kind": "search_preview",
            "data": {
                "query": text.replace("search", "").strip()
            }
        }

    return None

def detect_media_control_intent(text: str):
    text = (text or "").lower().strip()

    if text in ("next", "next video", "play next", "next one"):
        return "media_next", {}

    if text in ("previous", "previous video", "play previous", "back video", "last one"):
        return "media_prev", {}

    if text in ("pause", "pause media", "pause video"):
        return "media_pause", {}

    if text in ("resume", "resume media", "resume video", "play again"):
        return "media_resume", {}

    m = re.search(r"(play|open|select)\s+(number\s+)?(\d+)", text)

    if text in ("previous", "previous one", "back"):
        return "media_prev", {}

    m = re.search(r"(play|open|select)\s+(first|second|third|fourth|fifth|\d+)", text)
    if m:
        value = m.group(2)

        if value.isdigit():
            idx = int(value)
        else:
            idx = NUMBER_WORDS.get(value, 1)

        return "media_select", {"index": idx}

    for word, value in NUMBER_WORDS.items():
        if f"play {word}" in text or f"open {word}" in text or f"select {word}" in text:
            return "media_select", {"index": value}

    if "play first video" in text or "play first one" in text:
        return "media_select", {"index": 1}
    if "play second video" in text or "play second one" in text:
        return "media_select", {"index": 2}
    if "play third video" in text or "play third one" in text:
        return "media_select", {"index": 3}

    return None, {}

def detect_search_control_intent(text: str):
    text = (text or "").lower().strip()
    text = re.sub(r"[,\.\!\?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if text in ("next result", "next search result", "next"):
        return "search_next", {}

    if text in ("previous result", "previous search result", "previous"):
        return "search_prev", {}
    
    if text in ("next", "next one"):
        return "search_next", {}
    
    m = re.search(r"(open|select)\s+(?:number\s+)?(\d+)(?:\s+result)?$", text)

    if text in ("previous", "previous one", "back"):
        return "search_prev", {}

    m = re.search(r"(open|select)\s+(second|third|first|\d+)", text)

    if m:
        idx = int(m.group(2))
        return "search_open_result", {"index": idx}

    for word, value in NUMBER_WORDS.items():
        if (
            f"open {word}" in text
            or f"open {word} result" in text
            or f"select {word}" in text
            or f"select {word} result" in text
        ):
            return "search_open_result", {"index": value}

    if "open first result" in text:
        return "search_open_result", {"index": 1}
    if "open second result" in text:
        return "search_open_result", {"index": 2}
    if "open third result" in text:
        return "search_open_result", {"index": 3}
    if "open fourth result" in text:
        return "search_open_result", {"index": 4}
    if "open fifth result" in text:
        return "search_open_result", {"index": 5}

    return None, {}

def detect_task_alarm_intent(text: str):
    text = (text or "").lower().strip()
    text = re.sub(r"[,\.\!\?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if text.startswith(("add task", "create task", "new task")):
        return "create_task"

    if re.search(r"\b(show|list)\b.*\btask(s)?\b", text):
        return "list_tasks"

    if re.match(r"^(delete|remove)\s+task\s+\d+$", text):
        return "delete_task"

    if text.startswith(("set alarm", "create alarm", "add alarm")):
        return "create_alarm"

    if re.search(r"\b(show|list)\b.*\balarm(s)?\b", text):
        return "list_alarms"

    if re.match(r"^(delete|remove)\s+alarm\s+\d+$", text):
        return "delete_alarm"

    return None

def detect_history_intent(text: str):
    text = (text or "").lower().strip()
    text = re.sub(r"[,\.\!\?]+", " ", text)
    text = re.sub(r"\s+", " ", text).strip()

    if text in ("show history", "show my history", "assistant history", "activity history"):
        return "list_history"

    if text in ("clear history", "clear my history", "delete history"):
        return "clear_history"

    return None