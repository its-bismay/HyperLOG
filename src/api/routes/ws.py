import asyncio
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.storage.clickhouse_client import get_analytics_summary
from src.storage.redis_client import get_queue_depth

router = APIRouter(tags=["WebSocket"])


class ConnectionManager:
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)

    async def broadcast_json(self, data: dict):
        disconnected = set()
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
            except Exception:
                disconnected.add(connection)
        for dead in disconnected:
            self.disconnect(dead)


manager = ConnectionManager()


@router.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Send live metrics pulse every second
            try:
                summary = get_analytics_summary()
                summary["queue_depth"] = await get_queue_depth()
                await websocket.send_json({"type": "telemetry", "data": summary})
            except Exception as e:
                await websocket.send_json({"type": "error", "message": str(e)})

            await asyncio.sleep(1.0)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
