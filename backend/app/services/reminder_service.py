import uuid
from datetime import datetime

from sqlalchemy import asc

from app.db.database import SessionLocal
from app.models.db_models import Reminder


def create_reminder(
    session_id: str,
    task: str,
    time_text: str,
    user_id: int | None = None,
):
    db = SessionLocal()
    try:
        reminder = Reminder(
            reminder_id=f"rem_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            user_id=user_id,
            task=task.strip(),
            time_text=time_text.strip(),
            created_at=datetime.utcnow(),
        )

        db.add(reminder)
        db.commit()
        db.refresh(reminder)

        return _to_dict(reminder)
    finally:
        db.close()


def list_reminders(session_id: str | None = None, user_id: int | None = None):
    db = SessionLocal()
    try:
        query = db.query(Reminder)

        if user_id:
            query = query.filter(Reminder.user_id == user_id)
        elif session_id:
            query = query.filter(Reminder.session_id == session_id)

        reminders = query.order_by(asc(Reminder.created_at)).all()
        return [_to_dict(r) for r in reminders]
    finally:
        db.close()


def delete_reminder_by_index(
    session_id: str,
    index: int,
    user_id: int | None = None,
):
    reminders = list_reminders(session_id=session_id, user_id=user_id)

    if index < 1 or index > len(reminders):
        return None

    target = reminders[index - 1]

    db = SessionLocal()
    try:
        reminder = (
            db.query(Reminder)
            .filter(Reminder.reminder_id == target["id"])
            .first()
        )

        if not reminder:
            return None

        result = _to_dict(reminder)
        db.delete(reminder)
        db.commit()
        return result
    finally:
        db.close()


def _to_dict(reminder: Reminder):
    return {
        "id": reminder.reminder_id,
        "db_id": reminder.id,
        "session_id": reminder.session_id,
        "user_id": reminder.user_id,
        "task": reminder.task,
        "time_text": reminder.time_text,
        "created_at": reminder.created_at.isoformat() if reminder.created_at else None,
    }