from collections import Counter
from app.services.history_service import list_history


def get_assistant_overview(session_id: str | None = None):
    items = list_history(session_id=session_id, limit=10000)

    total = len(items)
    failed = len([x for x in items if x.get("is_failed")])
    low_confidence = len([x for x in items if x.get("is_low_confidence")])
    success = len([x for x in items if x.get("status") == "success"])

    success_rate = round((success / total) * 100, 2) if total else 0

    return {
        "total_commands": total,
        "success_commands": success,
        "failed_commands": failed,
        "low_confidence_commands": low_confidence,
        "success_rate": success_rate,
    }


def get_intent_statistics(session_id: str | None = None):
    items = list_history(session_id=session_id, limit=10000)

    counter = Counter()
    for item in items:
        intent = item.get("intent") or "unknown"
        counter[intent] += 1

    return [
        {"intent": intent, "count": count}
        for intent, count in counter.most_common()
    ]


def get_action_statistics(session_id: str | None = None):
    items = list_history(session_id=session_id, limit=10000)

    counter = Counter()
    for item in items:
        action_kind = item.get("action_kind") or "none"
        counter[action_kind] += 1

    return [
        {"action_kind": action_kind, "count": count}
        for action_kind, count in counter.most_common()
    ]


def get_failed_commands(session_id: str | None = None, limit: int = 50):
    items = list_history(session_id=session_id, limit=10000)

    failed_items = [
        item for item in items
        if item.get("is_failed")
    ]

    return failed_items[:limit]


def get_low_confidence_commands(session_id: str | None = None, limit: int = 50):
    items = list_history(session_id=session_id, limit=10000)

    low_items = [
        item for item in items
        if item.get("is_low_confidence")
    ]

    return low_items[:limit]


def get_recent_logs(
    session_id: str | None = None,
    limit: int = 50,
    status: str | None = None,
    intent: str | None = None,
    is_failed: bool | None = None,
    is_low_confidence: bool | None = None,
):
    return list_history(
        session_id=session_id,
        limit=limit,
        status=status,
        intent=intent,
        is_failed=is_failed,
        is_low_confidence=is_low_confidence,
    )


def get_admin_dashboard_summary(session_id: str | None = None):
    return {
        "overview": get_assistant_overview(session_id),
        "intent_statistics": get_intent_statistics(session_id),
        "action_statistics": get_action_statistics(session_id),
        "recent_logs": get_recent_logs(session_id, limit=10),
        "failed_commands": get_failed_commands(session_id, limit=10),
        "low_confidence_commands": get_low_confidence_commands(session_id, limit=10),
    }