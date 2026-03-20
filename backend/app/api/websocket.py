from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import json

from app.services.audio_pipeline import process_audio_chunk, flush_session

router = APIRouter()


@router.websocket("/ws/audio")
async def audio_ws(websocket: WebSocket):
    await websocket.accept()

    session_id = "default"
    sample_rate = 16000
    model_key = "base.en"
    wake_mode = "wake"

    try:
        while True:
            message = await websocket.receive()

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

                    await websocket.send_json({
                        "type": "config_ack",
                        "session_id": session_id,
                        "sample_rate": sample_rate,
                        "model_key": model_key,
                        "wake_mode": wake_mode,
                    })
                    continue

                if msg_type == "flush":
                    result = flush_session(
                        session_id=session_id,
                        sample_rate=sample_rate,
                        model_key=model_key,
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
                )

                await websocket.send_json(result)
                continue

    except WebSocketDisconnect:
        print(f"[WS] Client disconnected: {session_id}")
    except Exception as e:
        print("[WS] Error:", e)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
            })
        except Exception:
            pass