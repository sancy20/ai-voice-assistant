from fastapi import APIRouter
from typing import Optional
from app.services.reminder_service import list_reminders

router = APIRouter()

@router.get("/reminders")
def get_reminders(session_id: Optional[str] = None):
    return {
        "status": "success",
        "reminders": list_reminders(session_id=session_id)
    }