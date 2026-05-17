from sqlalchemy import text

from app.db.database import Base, engine
from app.models.user import User
from app.models.audit_log import AuditLog


def create_tables():
    Base.metadata.create_all(bind=engine)


def apply_development_migrations():
    migration_sql = [
        "ALTER TABLE users ADD COLUMN credits INT DEFAULT 10",
        "ALTER TABLE users ADD COLUMN plan VARCHAR(50) DEFAULT 'free'",
        "ALTER TABLE users ADD COLUMN avatar_url LONGTEXT",
        "ALTER TABLE users ADD COLUMN is_banned TINYINT(1) DEFAULT 0",
        "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        "ALTER TABLE users ADD COLUMN reset_token VARCHAR(100) DEFAULT NULL",
        "ALTER TABLE users ADD COLUMN reset_token_expires DATETIME DEFAULT NULL",
    ]

    with engine.connect() as conn:
        for sql in migration_sql:
            try:
                conn.execute(text(sql))
                conn.commit()
            except Exception as exc:
                if "1060" not in str(exc):
                    raise

        conn.execute(
            text("UPDATE users SET plan = 'unlimited', credits = 999999 WHERE role = 'admin'")
        )
        conn.commit()


def init_database():
    create_tables()
    apply_development_migrations()