from fastapi import APIRouter, Query

from app.services.admin_analytics_service import (
    get_admin_dashboard_summary,
    get_assistant_overview,
    get_intent_statistics,
    get_action_statistics,
    get_failed_commands,
    get_low_confidence_commands,
    get_recent_logs,
)

router = APIRouter(prefix="/admin/assistant", tags=["Admin Assistant Analytics"])


@router.get("/dashboard")
def assistant_dashboard(session_id: str | None = Query(default=None)):
    return get_admin_dashboard_summary(session_id=session_id)


@router.get("/overview")
def assistant_overview(session_id: str | None = Query(default=None)):
    return get_assistant_overview(session_id=session_id)


@router.get("/intents")
def assistant_intent_stats(session_id: str | None = Query(default=None)):
    return get_intent_statistics(session_id=session_id)


@router.get("/actions")
def assistant_action_stats(session_id: str | None = Query(default=None)):
    return get_action_statistics(session_id=session_id)


@router.get("/logs")
def assistant_logs(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    status: str | None = Query(default=None),
    intent: str | None = Query(default=None),
    is_failed: bool | None = Query(default=None),
    is_low_confidence: bool | None = Query(default=None),
):
    return get_recent_logs(
        session_id=session_id,
        limit=limit,
        status=status,
        intent=intent,
        is_failed=is_failed,
        is_low_confidence=is_low_confidence,
    )


@router.get("/failed")
def assistant_failed_commands(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    return get_failed_commands(session_id=session_id, limit=limit)


@router.get("/low-confidence")
def assistant_low_confidence_commands(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
):
    return get_low_confidence_commands(session_id=session_id, limit=limit)