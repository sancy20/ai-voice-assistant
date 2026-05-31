from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    JSON,
)
from app.db.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="user")
    created_at = Column(DateTime, default=datetime.utcnow)


class AssistantHistory(Base):
    __tablename__ = "assistant_history"

    id = Column(Integer, primary_key=True, index=True)
    history_id = Column(String(50), unique=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(Integer, nullable=True)

    transcript = Column(Text, nullable=True)
    intent = Column(String(100), nullable=True)
    confidence = Column(Float, nullable=True)
    status = Column(String(100), nullable=True)
    message = Column(Text, nullable=True)

    action_kind = Column(String(100), nullable=True)
    action = Column(JSON, nullable=True)
    ui = Column(JSON, nullable=True)

    is_failed = Column(Boolean, default=False)
    is_low_confidence = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.utcnow)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(String(50), unique=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    done = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Alarm(Base):
    __tablename__ = "alarms"

    id = Column(Integer, primary_key=True, index=True)
    alarm_id = Column(String(50), unique=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(Integer, nullable=True)
    time_text = Column(String(255), nullable=False)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(Integer, primary_key=True, index=True)
    reminder_id = Column(String(50), unique=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(Integer, nullable=True)
    task = Column(Text, nullable=False)
    time_text = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    note_id = Column(String(50), unique=True, index=True)
    session_id = Column(String(100), index=True)
    user_id = Column(Integer, nullable=True)
    text = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)