import json
from typing import Any, Dict, List, Optional
import redis.asyncio as aioredis
from redis.exceptions import ResponseError

from src.core.config import settings
from src.core.schemas import LogRecord

_redis_pool: Optional[aioredis.ConnectionPool] = None
_redis_client: Optional[aioredis.Redis] = None


async def get_redis_client() -> aioredis.Redis:
    global _redis_client, _redis_pool
    if _redis_client is None:
        _redis_pool = aioredis.ConnectionPool(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
        )
        _redis_client = aioredis.Redis(connection_pool=_redis_pool)
    return _redis_client


async def close_redis_client() -> None:
    global _redis_client, _redis_pool
    if _redis_client is not None:
        await _redis_client.aclose()
        _redis_client = None
    if _redis_pool is not None:
        await _redis_pool.disconnect()
        _redis_pool = None


async def ensure_consumer_group() -> None:
    client = await get_redis_client()
    try:
        await client.xgroup_create(
            name=settings.REDIS_STREAM_KEY,
            groupname=settings.REDIS_CONSUMER_GROUP,
            id="0",
            mkstream=True,
        )
    except ResponseError as e:
        if "BUSYGROUP" not in str(e):
            raise


def serialize_log_record(record: LogRecord) -> Dict[str, str]:
    return {
        "trace_id": str(record.trace_id),
        "timestamp": record.timestamp.isoformat(),
        "service_name": record.service_name,
        "host": record.host,
        "environment": record.environment,
        "log_level": record.log_level.value,
        "http_method": record.http_method,
        "http_status": str(record.http_status),
        "response_time_ms": str(record.response_time_ms),
        "message": record.message,
        "metadata": json.dumps(record.metadata),
    }


async def push_log(record: LogRecord) -> str:
    client = await get_redis_client()
    serialized = serialize_log_record(record)
    entry_id = await client.xadd(
        name=settings.REDIS_STREAM_KEY,
        fields=serialized,
        maxlen=settings.REDIS_MAX_STREAM_LEN,
        approximate=True,
    )
    return entry_id


async def push_logs_batch(records: List[LogRecord]) -> List[str]:
    client = await get_redis_client()
    pipe = client.pipeline()
    for record in records:
        serialized = serialize_log_record(record)
        pipe.xadd(
            name=settings.REDIS_STREAM_KEY,
            fields=serialized,
            maxlen=settings.REDIS_MAX_STREAM_LEN,
            approximate=True,
        )
    entry_ids = await pipe.execute()
    return entry_ids


async def get_queue_depth() -> int:
    client = await get_redis_client()
    return await client.xlen(settings.REDIS_STREAM_KEY)
