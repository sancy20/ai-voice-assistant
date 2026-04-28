import uuid
from datetime import datetime

from sqlalchemy import asc

from app.db.database import SessionLocal
from app.models.db_models import Alarm


def create_alarm(session_id: str, time_text: str, user_id: int | None = None):
    db = SessionLocal()
    try:
        alarm = Alarm(
            alarm_id=f"alarm_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            user_id=user_id,
            time_text=time_text.strip(),
            enabled=True,
            created_at=datetime.utcnow(),
        )

        db.add(alarm)
        db.commit()
        db.refresh(alarm)

        return _to_dict(alarm)
    finally:
        db.close()


def list_alarms(session_id: str | None = None, user_id: int | None = None):
    db = SessionLocal()
    try:
        query = db.query(Alarm)

        if user_id:
            query = query.filter(Alarm.user_id == user_id)
        elif session_id:
            query = query.filter(Alarm.session_id == session_id)

        alarms = query.order_by(asc(Alarm.created_at)).all()
        return [_to_dict(a) for a in alarms]
    finally:
        db.close()


def delete_alarm_by_index(session_id: str, index: int, user_id: int | None = None):
    alarms = list_alarms(session_id=session_id, user_id=user_id)

    if index < 1 or index > len(alarms):
        return None

    target = alarms[index - 1]

    db = SessionLocal()
    try:
        alarm = db.query(Alarm).filter(Alarm.alarm_id == target["id"]).first()
        if not alarm:
            return None

        result = _to_dict(alarm)
        db.delete(alarm)
        db.commit()
        return result
    finally:
        db.close()


def _to_dict(alarm: Alarm):
    return {
        "id": alarm.alarm_id,
        "db_id": alarm.id,
        "session_id": alarm.session_id,
        "user_id": alarm.user_id,
        "time": alarm.time_text,
        "enabled": alarm.enabled,
        "created_at": alarm.created_at.isoformat() if alarm.created_at else None,
    }