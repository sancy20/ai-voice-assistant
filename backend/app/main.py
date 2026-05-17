from dotenv import load_dotenv
load_dotenv()

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import SESSIONS_DIR
from app.services.model_service import load_intent_pipeline, load_wake_model
from app.api.audio_routes import router as audio_router
from app.api.websocket import router as websocket_router
from app.api.notes import router as notes_router
from app.api.reminders import router as reminders_router
from app.api.admin_routes import router as admin_router, users_router as admin_users_router
from app.api.auth_routes import router as auth_router
from app.api.subscription_routes import router as subscription_router
from app.db.init_db import init_database

app = FastAPI(title="AI Voice Assistant")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5175",
        "http://127.0.0.1:5175",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

init_database()

os.makedirs(SESSIONS_DIR, exist_ok=True)

load_intent_pipeline()
load_wake_model()

app.include_router(auth_router, prefix="/api")
app.include_router(subscription_router, prefix="/api")
app.include_router(router)
app.include_router(audio_router)
app.include_router(websocket_router)
app.include_router(notes_router, prefix="/api")
app.include_router(reminders_router, prefix="/api")
app.include_router(admin_router)
app.include_router(admin_users_router)