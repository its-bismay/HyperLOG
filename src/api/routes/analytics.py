from typing import Optional
from fastapi import APIRouter, Query

from src.storage.clickhouse_client import (
    get_analytics_summary,
    get_recent_logs,
    get_total_logs_count,
)
from src.storage.redis_client import get_queue_depth

router = APIRouter(prefix="/api/v1/analytics", tags=["Analytics"])


@router.get("/summary")
async def summary():
    data = get_analytics_summary()
    data["queue_depth"] = await get_queue_depth()
    return data


@router.get("/recent")
async def recent_logs(
    limit: int = Query(default=50, ge=1, le=1000),
    level: Optional[str] = Query(default=None),
):
    return get_recent_logs(limit=limit, min_level=level)


@router.get("/queue")
async def queue_depth():
    depth = await get_queue_depth()
    total_in_db = get_total_logs_count()
    return {
        "queue_depth": depth,
        "database_total": total_in_db,
    }
