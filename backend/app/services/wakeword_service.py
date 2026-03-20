import time
import numpy as np

from app.config import (
    WAKE_SR,
    WAKE_DURATION_SEC,
    WAKE_N_MFCC,
)
from app.utils.audio_utils import resample_i16_mono
import app.state as state
from app.services.model_service import load_wake_model

try:
    import librosa
except Exception:
    librosa = None

try:
    import python_speech_features as psf
except Exception:
    psf = None


def now_ts() -> float:
    return time.time()


def is_awake(session_id: str) -> bool:
    return float(state.awake_until_ts.get(session_id, 0.0) or 0.0) > now_ts()


def set_awake(session_id: str, seconds: float):
    state.awake_until_ts[session_id] = now_ts() + float(seconds)


def in_cooldown(session_id: str) -> bool:
    return float(state.wake_cooldown_until_ts.get(session_id, 0.0) or 0.0) > now_ts()


def set_cooldown(session_id: str, seconds: float):
    state.wake_cooldown_until_ts[session_id] = now_ts() + float(seconds)


def wake_featurize_from_i16(i16: np.ndarray, src_sr: int) -> np.ndarray | None:
    model = load_wake_model()
    if model is None:
        return None
    if i16.size == 0 or src_sr <= 0:
        return None

    if src_sr != WAKE_SR:
        i16 = resample_i16_mono(i16, src_sr, WAKE_SR)

    y = (i16.astype(np.float32) / 32768.0).clip(-1.0, 1.0)

    target_len = int(WAKE_SR * WAKE_DURATION_SEC)
    if y.shape[0] < target_len:
        y = np.pad(y, (0, target_len - y.shape[0]))
    else:
        y = y[:target_len]

    try:
        if librosa is not None:
            mfcc = librosa.feature.mfcc(y=y, sr=WAKE_SR, n_mfcc=WAKE_N_MFCC)
            feat = np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)], axis=0).astype(np.float32)
            return feat

        if psf is not None:
            mfcc2 = psf.mfcc(
                signal=y,
                samplerate=WAKE_SR,
                winlen=0.025,
                winstep=0.010,
                numcep=WAKE_N_MFCC,
                nfilt=26,
                nfft=512,
                preemph=0.97,
                appendEnergy=True,
            )
            feat = np.concatenate([mfcc2.mean(axis=0), mfcc2.std(axis=0)], axis=0).astype(np.float32)
            return feat

        print("[WARN] No MFCC backend available.")
        return None
    except Exception as e:
        print("[ERROR] wake featurize failed:", e)
        return None


def wake_predict_prob(feat):
    model = load_wake_model()
    if model is None:
        return 0.0

    try:
        if hasattr(model, "predict_proba"):
            proba = model.predict_proba([feat])[0]
            cls = getattr(model, "classes_", None)
            if cls is not None:
                try:
                    idx = list(cls).index(1)
                    return float(proba[idx])
                except Exception:
                    pass
            return float(proba[1]) if len(proba) > 1 else float(proba[0])

        pred = model.predict([feat])[0]
        return 1.0 if int(pred) == 1 else 0.0
    except Exception as e:
        print("[ERROR] wake predict failed:", e)
        return 0.0