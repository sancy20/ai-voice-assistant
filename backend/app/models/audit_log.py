from sqlalchemy import Column, Integer, String, DateTime, Text
from sqlalchemy.sql import func
from app.db.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id             = Column(Integer, primary_key=True, index=True)
    admin_id       = Column(Integer, nullable=False, index=True)
    admin_username = Column(String(100), nullable=False)
    action         = Column(String(100), nullable=False)
    target_user_id = Column(Integer, nullable=True)
    target_username= Column(String(100), nullable=True)
    details        = Column(Text, nullable=True)
    created_at     = Column(DateTime(timezone=True), server_default=func.now())
