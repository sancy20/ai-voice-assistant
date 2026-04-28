import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import desc

from app.db.database import SessionLocal
from app.models.db_models import Note


def create_note(
    session_id: str,
    text: str,
    user_id: int | None = None,
) -> Optional[dict]:
    text = (text or "").strip()
    if not text:
        return None

    db = SessionLocal()
    try:
        note = Note(
            note_id=f"note_{uuid.uuid4().hex[:12]}",
            session_id=session_id,
            user_id=user_id,
            text=text,
            created_at=datetime.utcnow(),
        )

        db.add(note)
        db.commit()
        db.refresh(note)

        return _to_dict(note)
    finally:
        db.close()


def list_notes(
    session_id: Optional[str] = None,
    user_id: int | None = None,
) -> list[dict]:
    db = SessionLocal()
    try:
        query = db.query(Note)

        if user_id:
            query = query.filter(Note.user_id == user_id)
        elif session_id:
            query = query.filter(Note.session_id == session_id)

        notes = query.order_by(desc(Note.created_at)).all()
        return [_to_dict(n) for n in notes]
    finally:
        db.close()


def get_note(note_id: str) -> Optional[dict]:
    db = SessionLocal()
    try:
        note = db.query(Note).filter(Note.note_id == note_id).first()
        return _to_dict(note) if note else None
    finally:
        db.close()


def _to_dict(note: Note):
    return {
        "id": note.note_id,
        "db_id": note.id,
        "session_id": note.session_id,
        "user_id": note.user_id,
        "text": note.text,
        "created_at": note.created_at.isoformat() if note.created_at else None,
    }