import os
import glob
import numpy as np
import librosa
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, confusion_matrix

SR = 16000
DURATION = 1.0
N_MFCC = 20

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)

WAKE_DIR = os.path.join(BACKEND_DIR, "wakeword_data", "wake", "nancy_train")
NOT_WAKE_DIR = os.path.join(BACKEND_DIR, "wakeword_data", "not_wake")
OUT_PATH = os.path.join(BACKEND_DIR, "app", "models", "wakeword_model.joblib")


def load_wav(path):
    y, sr = librosa.load(path, sr=SR, mono=True)
    target_len = int(SR * DURATION)
    if len(y) < target_len:
        y = np.pad(y, (0, target_len - len(y)))
    else:
        y = y[:target_len]
    return y


def featurize(y):
    mfcc = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=N_MFCC)
    feat = np.concatenate([mfcc.mean(axis=1), mfcc.std(axis=1)], axis=0)
    return feat.astype(np.float32)


def build_dataset():
    X, y = [], []

    wake_files = sorted(glob.glob(os.path.join(WAKE_DIR, "*.wav")))
    not_files = sorted(glob.glob(os.path.join(NOT_WAKE_DIR, "*.wav")))

    if len(wake_files) < 30 or len(not_files) < 30:
        raise RuntimeError("Not enough data. Aim for >= 100 wake and >= 200 not_wake.")

    for f in wake_files:
        X.append(featurize(load_wav(f)))
        y.append(1)

    for f in not_files:
        X.append(featurize(load_wav(f)))
        y.append(0)

    return np.stack(X), np.array(y, dtype=np.int64)


def main():
    X, y = build_dataset()
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = Pipeline([
        ("scaler", StandardScaler()),
        ("clf", LogisticRegression(max_iter=2000, class_weight="balanced"))
    ])

    model.fit(X_train, y_train)
    pred = model.predict(X_test)

    print("Confusion Matrix:")
    print(confusion_matrix(y_test, pred))
    print("\nClassification Report:")
    print(classification_report(y_test, pred, digits=4))

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    joblib.dump(model, OUT_PATH)
    print(f"\nSaved wakeword model to: {OUT_PATH}")


if __name__ == "__main__":
    main()