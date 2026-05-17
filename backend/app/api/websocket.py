from fastapi import APIRouter, WebSocket, WebSocketDisconnect,HTTPException
import json

from app.services.audio_pipeline import process_audio_chunk, flush_session
from app.db.database import SessionLocal
from app.services.auth_service import get_user_from_token

router = APIRouter()


@router.websocket("/ws/audio")
async def audio_ws(websocket: WebSocket):
    await websocket.accept()

    session_id = "default"
    sample_rate = 16000
    model_key = "base"
    wake_mode = "wake"
    user_id = None

    try:
        while True:
            try:
                message = await websocket.receive()
            except WebSocketDisconnect:
                print(f"[WS] Client disconnected: {session_id}")
                break
            except RuntimeError as e:
                if "disconnect message has been received" in str(e):
                    print(f"[WS] Client already disconnected: {session_id}")
                    break
                raise

            # Text / JSON control messages
            if "text" in message and message["text"] is not None:
                try:
                    payload = json.loads(message["text"])
                except Exception:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Invalid JSON message"
                    })
                    continue

                msg_type = payload.get("type")

                if msg_type == "config":
                    session_id = payload.get("session_id") or session_id
                    sample_rate = int(payload.get("sample_rate") or sample_rate)
                    model_key = payload.get("model_key") or model_key
                    wake_mode = payload.get("wake_mode") or wake_mode

                    token = payload.get("token")
                    if token:
                        db = SessionLocal()
                        try:
                            user = get_user_from_token(token, db)
                            user_id = user.id
                        except Exception as e:
                            print("[WS AUTH] Invalid token:", e)
                            user_id = None
                        finally:
                            db.close()

                    await websocket.send_json({
                        "type": "config_ack",
                        "session_id": session_id,
                        "sample_rate": sample_rate,
                        "model_key": model_key,
                        "wake_mode": wake_mode,
                        "user_id": user_id,
                    })
                    continue

                if msg_type == "flush":
                    result = flush_session(
                        session_id=session_id,
                        sample_rate=sample_rate,
                        model_key=model_key,
                        user_id=user_id,
                    )
                    await websocket.send_json(result)
                    continue

                if msg_type == "ping":
                    await websocket.send_json({"type": "pong"})
                    continue

                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {msg_type}"
                })
                continue

            # Binary audio chunk
            if "bytes" in message and message["bytes"] is not None:
                raw_bytes = message["bytes"]

                result = process_audio_chunk(
                    session_id=session_id,
                    raw_bytes=raw_bytes,
                    sample_rate=sample_rate,
                    model_key=model_key,
                    wake_mode=(wake_mode == "wake"),
                    user_id=user_id,
                )

                msg_type = result.get("type")

                if msg_type == "wake_detected":
                    await websocket.send_json({
                        "type": "wake",
                        "awake": True,
                    })
                    continue

                if msg_type in ("sleep", "wake_timeout"):
                    await websocket.send_json({
                        "type": "sleep",
                        "awake": False,
                    })
                    continue

                await websocket.send_json(result)
                continue

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {session_id}")
    except RuntimeError as e:
        if "disconnect message has been received" in str(e):
            print(f"[WS] Client already disconnected: {session_id}")
        else:
            raise
    except Exception as e:
        print("[WS HTTP ERROR]", e.detail)
        try:
            await websocket.send_json({
                "type": "assistant_clarification",
                "status": "error",
                "intent": "billing",
                "message": e.detail,
                "suggestions": [
                    "Upgrade to Pro",
                    "Buy more tokens",
                ],
            })
        except Exception:
            pass