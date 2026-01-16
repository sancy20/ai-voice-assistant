import os
import pandas as pd
import joblib

from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import classification_report, accuracy_score, confusion_matrix


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATASET_PATH = os.path.join(BASE_DIR, "intent_dataset.csv")
MODEL_OUT = os.path.join(BASE_DIR, "intent_pipeline.joblib")


def main():
    if not os.path.isfile(DATASET_PATH):
        raise FileNotFoundError(f"Dataset not found: {DATASET_PATH}")

    df = pd.read_csv(DATASET_PATH)
    df["text"] = df["text"].astype(str).str.strip()
    df["intent"] = df["intent"].astype(str).str.strip()

    # Drop empty rows
    df = df[(df["text"] != "") & (df["intent"] != "")]
    if df.empty:
        raise ValueError("Dataset is empty after cleaning. Add more rows.")

    X = df["text"].values
    y = df["intent"].values

    # stratify keeps class balance in split
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=0.2,
        random_state=42,
        stratify=y
    )

    # Simple and strong baseline for intent classification
    pipe = Pipeline([
        ("tfidf", TfidfVectorizer(
            lowercase=True,
            ngram_range=(1, 2),   # unigrams + bigrams
            min_df=1
        )),
        ("clf", LogisticRegression(
            max_iter=3000,
            class_weight="balanced"
        ))
    ])

    pipe.fit(X_train, y_train)

    y_pred = pipe.predict(X_test)
    acc = accuracy_score(y_test, y_pred)

    print("\n=== Intent Model Training Result ===")
    print("Total samples:", len(df))
    print("Train samples:", len(X_train))
    print("Test samples:", len(X_test))
    print("Accuracy:", round(acc, 4))
    print("\nClassification Report:\n", classification_report(y_test, y_pred))
    print("Confusion Matrix:\n", confusion_matrix(y_test, y_pred))

    joblib.dump(pipe, MODEL_OUT)
    print("\nSaved trained pipeline to:", MODEL_OUT)


if __name__ == "__main__":
    main()
