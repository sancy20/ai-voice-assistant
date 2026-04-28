from datetime import datetime

def build_success_response(
    transcript: str,
    intent_name: str,
    confidence: float,
    message: str,
    action: dict | None = None,
    ui: dict | None = None,
    session_mode: str = "sleep",
    extra: dict | None = None,
):
    payload = {
        "type": "assistant_response",
        "status": "success",
        "transcript": transcript,
        "intent": intent_name,
        "confidence": confidence,
        "message": message,
        "action": action or {},
        "ui": ui or {},
        "needs_followup": False,
        "session_mode": session_mode,
        "timestamp": datetime.utcnow().isoformat(),
    }
    if extra:
        payload.update(extra)
    return payload

def build_clarification_response(
    transcript: str,
    intent_name: str | None,
    confidence: float,
    message: str,
    suggestions: list[str] | None = None,
    session_mode: str = "sleep",
):
    return {
        "type": "assistant_clarification",
        "status": "needs_clarification",
        "transcript": transcript,
        "intent": intent_name,
        "confidence": confidence,
        "message": message,
        "suggestions": suggestions or [],
        "needs_followup": True,
        "session_mode": session_mode,
        "timestamp": datetime.utcnow().isoformat(),
    }

def build_failure_response(
    transcript: str,
    message: str,
    session_mode: str = "sleep",
):
    return {
        "type": "assistant_response",
        "status": "failed",
        "transcript": transcript,
        "intent": None,
        "confidence": 0.0,
        "message": message,
        "action": {},
        "ui": {},
        "needs_followup": False,
        "session_mode": session_mode,
        "timestamp": datetime.utcnow().isoformat(),
    }

def build_note_mode_started():
    return {
        "type": "note_mode_started",
        "status": "success",
        "message": "Note mode is now on. I am listening continuously.",
    }

def build_note_mode_update(text: str):
    return {
        "type": "note_mode_update",
        "status": "success",
        "text": text,
    }

def build_note_mode_stopped(note_text: str, saved_note: dict | None = None):
    payload = {
        "type": "note_mode_stopped",
        "status": "success",
        "message": "Note saved.",
        "note_text": note_text,
    }

    if saved_note is not None:
        payload["saved_note"] = saved_note

    return payload

def build_reminder_created(reminder: dict):
    return {
        "type": "reminder_created",
        "status": "success",
        "message": f"Reminder set: {reminder.get('task')} at {reminder.get('time')}",
        "reminder": reminder,
    }

def build_task_created(task: dict):
    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": task.get("text", ""),
        "intent": "create_task",
        "confidence": 0.95,
        "message": f"Task added: {task.get('text')}",
        "action": {
            "kind": "task_created",
            "data": {"task": task},
        },
        "ui": {"widget": "task_card"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_alarm_created(alarm: dict):
    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": alarm.get("time", ""),
        "intent": "create_alarm",
        "confidence": 0.95,
        "message": f"Alarm set for {alarm.get('time')}",
        "action": {
            "kind": "alarm_created",
            "data": {"alarm": alarm},
        },
        "ui": {"widget": "alarm_card"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_task_list(tasks: list[dict], transcript: str = ""):
    if not tasks:
        message = "You have no tasks."
    else:
        items = [f"{idx+1}. {t.get('text')}" for idx, t in enumerate(tasks)]
        message = "Your tasks are: " + " | ".join(items)

    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": transcript,
        "intent": "list_tasks",
        "confidence": 0.95,
        "message": message,
        "action": {
            "kind": "task_list",
            "data": {"tasks": tasks},
        },
        "ui": {"widget": "task_list"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_alarm_list(alarms: list[dict], transcript: str = ""):
    if not alarms:
        message = "You have no alarms."
    else:
        items = [f"{idx+1}. {a.get('time')}" for idx, a in enumerate(alarms)]
        message = "Your alarms are: " + " | ".join(items)

    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": transcript,
        "intent": "list_alarms",
        "confidence": 0.95,
        "message": message,
        "action": {
            "kind": "alarm_list",
            "data": {"alarms": alarms},
        },
        "ui": {"widget": "alarm_list"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_task_deleted(task: dict | None, index: int):
    message = (
        f"Deleted task number {index}: {task.get('text')}"
        if task else
        f"I could not find task number {index}."
    )

    return {
        "type": "assistant_response",
        "status": "success" if task else "failed",
        "transcript": "",
        "intent": "delete_task",
        "confidence": 0.95 if task else 0.0,
        "message": message,
        "action": {
            "kind": "task_deleted",
            "data": {"task": task, "index": index},
        },
        "ui": {"widget": "task_card"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_alarm_deleted(alarm: dict | None, index: int):
    message = (
        f"Deleted alarm number {index}: {alarm.get('time')}"
        if alarm else
        f"I could not find alarm number {index}."
    )

    return {
        "type": "assistant_response",
        "status": "success" if alarm else "failed",
        "transcript": "",
        "intent": "delete_alarm",
        "confidence": 0.95 if alarm else 0.0,
        "message": message,
        "action": {
            "kind": "alarm_deleted",
            "data": {"alarm": alarm, "index": index},
        },
        "ui": {"widget": "alarm_card"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }

def build_history_list(items: list[dict], transcript: str = ""):
    if not items:
        message = "Your history is empty."
    else:
        rows = []
        for idx, item in enumerate(items, start=1):
            transcript = item.get("transcript") or "(no transcript)"
            intent = item.get("intent") or "unknown"
            rows.append(f"{idx}. {intent} - {transcript}")
        message = "Recent history: " + " | ".join(rows[:10])

    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": transcript,
        "intent": "list_history",
        "confidence": 0.95,
        "message": message,
        "action": {
            "kind": "history_list",
            "data": {"items": items},
        },
        "ui": {"widget": "history_list"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }


def build_history_cleared():
    return {
        "type": "assistant_response",
        "status": "success",
        "transcript": "",
        "intent": "clear_history",
        "confidence": 0.95,
        "message": "History cleared.",
        "action": {
            "kind": "history_cleared",
            "data": {},
        },
        "ui": {"widget": "history_card"},
        "needs_followup": False,
        "session_mode": "sleep",
        "timestamp": datetime.utcnow().isoformat(),
    }