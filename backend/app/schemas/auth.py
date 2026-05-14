from typing import Optional
from datetime import datetime
from pydantic import BaseModel, EmailStr, model_validator


class UserRegister(BaseModel):
    email: EmailStr
    username: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


class UserOut(BaseModel):
    id: int
    email: str
    username: str
    role: str
    is_admin: bool = False
    is_banned: bool = False
    credits: int = 10
    plan: str = "free"
    avatar_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}

    @model_validator(mode="after")
    def set_is_admin(self):
        self.is_admin = self.role == "admin"
        return self


class UserAdminUpdate(BaseModel):
    is_banned: Optional[bool] = None
    plan: Optional[str] = None
    credits: Optional[int] = None
    role: Optional[str] = None
