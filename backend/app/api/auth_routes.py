import secrets
from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from app.db.database import get_db
from app.models.user import User
from app.schemas.auth import UserRegister, UserLogin, Token, UserOut
from app.services.auth_service import hash_password, verify_password, create_access_token, get_current_user

router = APIRouter(prefix="/auth", tags=["Authentication"])


class ProfileUpdate(BaseModel):
    username: str
    email: EmailStr


class PasswordChange(BaseModel):
    current_password: str
    new_password: str


@router.post("/register", response_model=UserOut, status_code=201)
def register(payload: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    is_first_user = db.query(User).count() == 0
    role = "admin" if is_first_user else "user"
    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role=role,
        plan="unlimited" if role == "admin" else "free",
        credits=999999 if role == "admin" else 10,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(payload: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })
    return {"access_token": token, "token_type": "bearer"}


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/refresh", response_model=Token)
def refresh_token(user: User = Depends(get_current_user)):
    """Issue a fresh 8-hour token without requiring password."""
    token = create_access_token({
        "sub": str(user.id),
        "email": user.email,
        "role": user.role,
    })
    return {"access_token": token, "token_type": "bearer"}


@router.put("/profile", response_model=UserOut)
def update_profile(
    payload: ProfileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.email != user.email:
        if db.query(User).filter(User.email == payload.email, User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Email already in use")

    if payload.username != user.username:
        if db.query(User).filter(User.username == payload.username, User.id != user.id).first():
            raise HTTPException(status_code=400, detail="Username already taken")

    user.email = payload.email
    user.username = payload.username
    db.commit()
    db.refresh(user)
    return user


@router.put("/password")
def change_password(
    payload: PasswordChange,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    user.password_hash = hash_password(payload.new_password)
    db.commit()
    return {"message": "Password updated successfully"}


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/forgot-password")
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No account found with that email")
    token = secrets.token_urlsafe(32)
    user.reset_token         = token
    user.reset_token_expires = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()
    return {"token": token, "message": "Reset token generated (email sending not configured)"}


@router.post("/reset-password")
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(payload.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = db.query(User).filter(User.reset_token == payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token")
    expires = user.reset_token_expires
    if expires and expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if not expires or datetime.now(timezone.utc) > expires:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    user.password_hash       = hash_password(payload.new_password)
    user.reset_token         = None
    user.reset_token_expires = None
    db.commit()
    return {"message": "Password reset successfully"}


class AvatarUpdate(BaseModel):
    avatar_url: str


@router.put("/avatar", response_model=UserOut)
def update_avatar(
    payload: AvatarUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.avatar_url.startswith("data:image/"):
        raise HTTPException(status_code=400, detail="Invalid image format")
    if len(payload.avatar_url) > 5_000_000:
        raise HTTPException(status_code=413, detail="Avatar too large (max ~3.5 MB)")

    user.avatar_url = payload.avatar_url
    db.commit()
    db.refresh(user)
    return user
