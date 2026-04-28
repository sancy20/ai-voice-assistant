import uuid
from datetime import datetime

from sqlalchemy import asc

from app.db.database import SessionLocal
from app.models.db_models import Task


def create_task(session_id: str, text: str, user_id: int | None = None):
    db = SessionLocal()
    try:
        task = Task(
            task_id=f"task_{uuid.uuid4().hex[:10]}",
            session_id=session_id,
            user_id=user_id,
            text=text.strip(),
            done=False,
            created_at=datetime.utcnow(),
        )

        db.add(task)
        db.commit()
        db.refresh(task)

        return _to_dict(task)
    finally:
        db.close()


def list_tasks(session_id: str | None = None, user_id: int | None = None):
    db = SessionLocal()
    try:
        query = db.query(Task)

        if user_id:
            query = query.filter(Task.user_id == user_id)
        elif session_id:
            query = query.filter(Task.session_id == session_id)

        tasks = query.order_by(asc(Task.created_at)).all()
        return [_to_dict(t) for t in tasks]
    finally:
        db.close()


def delete_task_by_index(session_id: str, index: int, user_id: int | None = None):
    tasks = list_tasks(session_id=session_id, user_id=user_id)

    if index < 1 or index > len(tasks):
        return None

    target = tasks[index - 1]

    db = SessionLocal()
    try:
        task = db.query(Task).filter(Task.task_id == target["id"]).first()
        if not task:
            return None

        result = _to_dict(task)
        db.delete(task)
        db.commit()
        return result
    finally:
        db.close()


def _to_dict(task: Task):
    return {
        "id": task.task_id,
        "db_id": task.id,
        "session_id": task.session_id,
        "user_id": task.user_id,
        "text": task.text,
        "done": task.done,
        "created_at": task.created_at.isoformat() if task.created_at else None,
    }