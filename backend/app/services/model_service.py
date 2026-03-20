import os
import joblib

from app.config import MODELS_DIR, APP_MODELS_DIR

INTENT_PIPELINE = None
WAKE_MODEL = None


def resolve_model_path(model_key: str | None) -> str:
    if model_key:
        mk = str(model_key).strip()
        if mk:
            candidate = os.path.join(MODELS_DIR, f"ggml-{mk}.bin")
            if os.path.isfile(candidate):
                return candidate

    for fallback in ("ggml-base.en.bin", "ggml-base.bin", "ggml-tiny.en.bin"):
        p = os.path.join(MODELS_DIR, fallback)
        if os.path.isfile(p):
            return p
    return ""


def load_intent_pipeline():
    global INTENT_PIPELINE
    path = os.path.join(APP_MODELS_DIR, "intent_pipeline.joblib")
    if os.path.isfile(path):
        INTENT_PIPELINE = joblib.load(path)
    return INTENT_PIPELINE


def load_wake_model():
    global WAKE_MODEL

    if WAKE_MODEL is not None:
        return WAKE_MODEL
    
    candidates = [
        os.path.join(APP_MODELS_DIR, "wakeword_model.joblib"),
        os.path.join(APP_MODELS_DIR, "wakeword_pipeline.joblib"),
    ]

    for path in candidates:
        if os.path.isfile(path):
            try:
                WAKE_MODEL = joblib.load(path)
                print("[DEBUG] Loaded wake model:", path)
                return WAKE_MODEL
            except Exception as e:
                print("[ERROR] load wake model:", e)

    print("[WARN] No wake model found")
    return None