import os
import uuid
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import desc

from app.db.database import SessionLocal
from app.models.db_models import AssistantHistory

load_dotenv()

USE_DB = os.getenv("USE_DB", "false").lower() == "true"


def create_history_record(
    session_id: str,
    transcript: str,
    intent: str | None,
    status: str,
    message: str,
    action: dict | None = None,
    ui: dict | None = None,
    confidence: float | None = None,
    user_id: int | None = None,
):
    action = action or {}
    ui = ui or {}

    action_kind = action.get("kind") if isinstance(action, dict) else None

    is_failed = (
        status in ("failed", "needs_clarification")
        or intent in (None, "unknown")
    )

    is_low_confidence = confidence is not None and confidence < 0.80

    db = SessionLocal()
    try:
        record = AssistantHistory(
            history_id=f"hist_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            user_id=user_id,
            transcript=transcript or "",
            intent=intent,
            confidence=confidence,
            status=status,
            message=message or "",
            action_kind=action_kind,
            action=action,
            ui=ui,
            is_failed=is_failed,
            is_low_confidence=is_low_confidence,
            created_at=datetime.utcnow(),
        )

        db.add(record)
        db.commit()
        db.refresh(record)

        return _to_dict(record)

    finally:
        db.close()


def list_history(
    session_id: str | None = None,
    limit: int = 50,
    status: str | None = None,
    intent: str | None = None,
    is_failed: bool | None = None,
    is_low_confidence: bool | None = None,
):
    db = SessionLocal()
    try:
        query = db.query(AssistantHistory)

        if session_id:
            query = query.filter(AssistantHistory.session_id == session_id)

        if status:
            query = query.filter(AssistantHistory.status == status)

        if intent:
            query = query.filter(AssistantHistory.intent == intent)

        if is_failed is not None:
            query = query.filter(AssistantHistory.is_failed == is_failed)

        if is_low_confidence is not None:
            query = query.filter(
                AssistantHistory.is_low_confidence == is_low_confidence
            )

        records = (
            query
            .order_by(desc(AssistantHistory.created_at))
            .limit(limit)
            .all()
        )

        return [_to_dict(x) for x in records]

    finally:
        db.close()


def clear_history(session_id: str | None = None):
    db = SessionLocal()
    try:
        query = db.query(AssistantHistory)

        if session_id:
            query = query.filter(AssistantHistory.session_id == session_id)

        query.delete(synchronize_session=False)
        db.commit()

    finally:
        db.close()


def _to_dict(record: AssistantHistory):
    return {
        "id": record.history_id,
        "db_id": record.id,
        "session_id": record.session_id,
        "user_id": record.user_id,
        "transcript": record.transcript,
        "intent": record.intent,
        "confidence": record.confidence,
        "status": record.status,
        "message": record.message,
        "action_kind": record.action_kind,
        "action": record.action or {},
        "ui": record.ui or {},
        "is_failed": record.is_failed,
        "is_low_confidence": record.is_low_confidence,
        "created_at": record.created_at.isoformat() if record.created_at else None,
    }