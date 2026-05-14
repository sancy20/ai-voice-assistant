from fastapi import APIRouter, Query, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.services.admin_analytics_service import (
    get_admin_dashboard_summary,
    get_assistant_overview,
    get_intent_statistics,
    get_action_statistics,
    get_failed_commands,
    get_low_confidence_commands,
    get_recent_logs,
)
from app.services.auth_service import require_admin
from app.db.database import get_db
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.auth import UserOut, UserAdminUpdate

router = APIRouter(prefix="/admin/assistant", tags=["Admin Assistant Analytics"])
users_router = APIRouter(prefix="/admin/users", tags=["Admin User Management"])


@router.get("/dashboard")
def assistant_dashboard(
    session_id: str | None = Query(default=None),
    _=Depends(require_admin),
):
    return get_admin_dashboard_summary(session_id=session_id)


@router.get("/overview")
def assistant_overview(
    session_id: str | None = Query(default=None),
    _=Depends(require_admin),
):
    return get_assistant_overview(session_id=session_id)


@router.get("/intents")
def assistant_intent_stats(
    session_id: str | None = Query(default=None),
    _=Depends(require_admin),
):
    return get_intent_statistics(session_id=session_id)


@router.get("/actions")
def assistant_action_stats(
    session_id: str | None = Query(default=None),
    _=Depends(require_admin),
):
    return get_action_statistics(session_id=session_id)


@router.get("/logs")
def assistant_logs(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    status: str | None = Query(default=None),
    intent: str | None = Query(default=None),
    is_failed: bool | None = Query(default=None),
    is_low_confidence: bool | None = Query(default=None),
    _=Depends(require_admin),
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
    _=Depends(require_admin),
):
    return get_failed_commands(session_id=session_id, limit=limit)


@router.get("/low-confidence")
def assistant_low_confidence_commands(
    session_id: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=500),
    _=Depends(require_admin),
):
    return get_low_confidence_commands(session_id=session_id, limit=limit)


# ── User management ──────────────────────────────────────────────────────────

@users_router.get("", response_model=list[UserOut])
def list_users(
    search: Optional[str] = Query(default=None),
    plan:   Optional[str] = Query(default=None),
    role:   Optional[str] = Query(default=None),
    banned: Optional[bool] = Query(default=None),
    limit:  int = Query(default=100, ge=1, le=500),
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter((User.username.like(like)) | (User.email.like(like)))
    if plan:
        q = q.filter(User.plan == plan)
    if role:
        q = q.filter(User.role == role)
    if banned is not None:
        q = q.filter(User.is_banned == banned)
    return q.order_by(User.created_at.desc()).limit(limit).all()


def _audit(db, admin, action, target_user=None, details=None):
    db.add(AuditLog(
        admin_id=admin.id,
        admin_username=admin.username,
        action=action,
        target_user_id=target_user.id if target_user else None,
        target_username=target_user.username if target_user else None,
        details=details,
    ))


@users_router.patch("/{user_id}", response_model=UserOut)
def update_user(
    user_id: int,
    body: UserAdminUpdate,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot modify your own account here")

    changes = []
    if body.is_banned is not None:
        user.is_banned = body.is_banned
        changes.append("banned" if body.is_banned else "unbanned")
    if body.plan is not None:
        changes.append(f"plan → {body.plan}")
        user.plan = body.plan
    if body.credits is not None:
        changes.append(f"credits → {body.credits}")
        user.credits = max(0, body.credits)
    if body.role is not None:
        changes.append(f"role → {body.role}")
        user.role = body.role
        if body.role == "admin" and user.plan not in ("unlimited", "business"):
            user.plan = "unlimited"
            user.credits = 999999
            changes.append("plan → unlimited (auto)")

    _audit(db, admin, "update_user", user, "; ".join(changes) if changes else "no changes")
    db.commit()
    db.refresh(user)
    return user


@users_router.delete("/{user_id}")
def delete_user(
    user_id: int,
    admin=Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    _audit(db, admin, "delete_user", user, f"deleted account {user.email}")
    db.delete(user)
    db.commit()
    return {"ok": True}


@users_router.get("/audit-logs")
def get_audit_logs(
    limit: int = Query(default=100, ge=1, le=500),
    _=Depends(require_admin),
    db: Session = Depends(get_db),
):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(limit).all()
    return [
        {
            "id": l.id,
            "admin_username": l.admin_username,
            "action": l.action,
            "target_username": l.target_username,
            "details": l.details,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        }
        for l in logs
    ]
