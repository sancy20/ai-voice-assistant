from typing import Optional
from fastapi import APIRouter

from app.services.note_service import list_notes, get_note

router = APIRouter()


@router.get("/notes")
def read_notes(session_id: Optional[str] = None):
    return {
        "status": "success",
        "notes": list_notes(session_id=session_id),
    }


@router.get("/notes/{note_id}")
def read_note_by_id(note_id: str):
    note = get_note(note_id)

    if note is None:
        return {
            "status": "not_found",
            "message": "Note not found",
        }

    return {
        "status": "success",
        "note": note,
    }