from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.user import User


ACTION_COSTS = {
    "time": 1,
    "open": 1,
    "navigate": 1,
    "scroll": 1,

    "search": 2,
    "search_next": 1,
    "search_prev": 1,
    "search_open_result": 1,

    "media_search": 2,
    "media_pause": 1,
    "media_resume": 1,
    "media_next": 1,
    "media_prev": 1,
    "media_select": 1,

    "create_note": 1,
    "note_mode_stopped": 3,

    "create_reminder": 1,
    "list_reminders": 1,

    "create_task": 1,
    "list_tasks": 1,
    "delete_task": 1,

    "create_alarm": 1,
    "list_alarms": 1,
    "delete_alarm": 1,

    "list_history": 1,
    "clear_history": 1,

    "unknown": 0,
}


def get_token_cost(intent_name: str | None) -> int:
    if not intent_name:
        return 1
    return ACTION_COSTS.get(intent_name, 1)


def charge_user_tokens(db: Session, user_id: int | None, intent_name: str | None, custom_cost: int | None = None):
    if not user_id:
        return None

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        return None

    if user.role == "admin" or user.plan == "unlimited":
        return {
            "charged": 0,
            "remaining": user.credits,
            "plan": user.plan,
        }

    cost = custom_cost if custom_cost is not None else get_token_cost(intent_name)

    if cost <= 0:
        return {
            "charged": 0,
            "remaining": user.credits,
            "plan": user.plan,
        }

    if (user.credits or 0) < cost:
        raise HTTPException(
            status_code=402,
            detail="Not enough tokens. Please upgrade your plan or buy more tokens.",
        )

    user.credits = (user.credits or 0) - cost
    db.commit()
    db.refresh(user)

    return {
        "charged": cost,
        "remaining": user.credits,
        "plan": user.plan,
    }