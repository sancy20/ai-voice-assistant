import app.services.model_service as model_service
from app.utils.text_utils import normalize_text, extract_slots


def predict_intent_ml(text: str) -> dict:
    t = normalize_text(text)
    if not t or model_service.INTENT_PIPELINE is None:
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    try:
        intent = model_service.INTENT_PIPELINE.predict([t])[0]
        confidence = 0.75
    except Exception as e:
        print("[ERROR] intent predict failed:", e)
        return {"intent": "none", "slots": {}, "confidence": 0.0}

    slots = extract_slots(intent, t)

    if intent == "open" and not slots.get("target"):
        intent, confidence = "none", 0.4
    if intent == "search" and not slots.get("query"):
        intent, confidence = "none", 0.4
    if intent == "navigate" and not slots.get("target"):
        intent, confidence = "none", 0.4
    if intent == "scroll" and not slots.get("direction"):
        intent, confidence = "none", 0.4

    return {"intent": intent, "slots": slots, "confidence": float(confidence)}


def predict_intent_rule_based(transcript: str) -> dict:
    return predict_intent_ml(transcript)


def intent_to_widget_tuple(pred: dict):
    it = pred.get("intent") or "none"
    slots = pred.get("slots") or {}

    if it == "open":
        return ("open", slots.get("target", ""))
    if it == "search":
        return ("search", slots.get("query", ""))
    if it == "scroll":
        return ("scroll", slots.get("direction", ""), int(slots.get("amount", 300)))
    if it == "navigate":
        return ("navigate", slots.get("target", ""))
    if it == "time":
        return ("time", slots.get("time", ""))

    return None