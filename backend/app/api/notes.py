from typing import Optional
from fastapi import APIRouter, Depends

from app.services.note_service import list_notes, get_note
from app.api.auth_routes import get_current_user

router = APIRouter()


@router.get("/notes")
def read_notes(
    session_id: Optional[str] = None,
    current_user = Depends(get_current_user),
):
    return {
        "status": "success",
        "notes": list_notes(
            session_id=session_id,
            user_id=current_user.id,
        ),
    }


@router.get("/notes/{note_id}")
def read_note_by_id(
    note_id: str,
    current_user = Depends(get_current_user),
):
    note = get_note(note_id)

    if note is None:
        return {
            "status": "not_found",
            "message": "Note not found",
        }

    if note.get("user_id") != current_user.id:
        return {
            "status": "not_found",
            "message": "Note not found",
        }

    return {
        "status": "success",
        "note": note,
    }