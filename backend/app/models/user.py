from sqlalchemy import Column, Integer, String, DateTime, Text, Boolean
from sqlalchemy.sql import func
from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id            = Column(Integer, primary_key=True, index=True)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    username      = Column(String(100), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(50), default="user")
    credits       = Column(Integer, default=10)
    plan          = Column(String(50), default="free")
    avatar_url    = Column(Text, nullable=True)
    is_banned            = Column(Boolean, default=False)
    reset_token          = Column(String(100), nullable=True, index=True)
    reset_token_expires  = Column(DateTime(timezone=True), nullable=True)
    created_at           = Column(DateTime(timezone=True), server_default=func.now())

    @property
    def is_admin(self):
        return self.role == "admin"
