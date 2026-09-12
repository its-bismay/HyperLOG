import asyncio
from datetime import datetime, timezone
import json
import logging
import time
from typing import Any, List, Tuple
import uuid

import redis.asyncio as aioredis

from src.core.config import settings
from src.storage.clickhouse_client import insert_logs_batch
from src.storage.redis_client import ensure_consumer_group, get_redis_client

logger = logging.getLogger("hyperlog.worker")


def parse_stream_entry(entry_id: str, fields: dict) -> Tuple[List[Any], str]:
    trace_id_str = fields.get("trace_id") or str(uuid.uuid4())
    try:
        trace_id = uuid.UUID(trace_id_str)
    except ValueError:
        trace_id = uuid.uuid4()

    raw_ts = fields.get("timestamp")
    if raw_ts:
        try:
            ts = datetime.fromisoformat(raw_ts)
        except Exception:
            ts = datetime.now(timezone.utc)
    else:
        ts = datetime.now(timezone.utc)

    row = [
        trace_id,
        ts,
        fields.get("service_name", "unknown-service"),
        fields.get("host", "default-host"),
        fields.get("environment", "production"),
        fields.get("log_level", "INFO"),
        fields.get("http_method", "GET"),
        int(fields.get("http_status", 200)),
        float(fields.get("response_time_ms", 0.0)),
        fields.get("message", ""),
        fields.get("metadata", "{}"),
    ]
    return row, entry_id


class BatchConsumer:
    def __init__(self, consumer_name: str = "worker-1"):
        self.consumer_name = consumer_name
        self.batch_size = settings.BATCH_SIZE
        self.flush_interval = settings.FLUSH_INTERVAL_SECONDS
        self.buffer_rows: List[List[Any]] = []
        self.buffer_ids: List[str] = []
        self.last_flush_time = time.monotonic()
        self.is_running = False

    async def flush(self, redis_client: aioredis.Redis) -> int:
        if not self.buffer_rows:
            self.last_flush_time = time.monotonic()
            return 0

        count = len(self.buffer_rows)
        # 1. Insert into ClickHouse
        insert_logs_batch(self.buffer_rows)

        # 2. Acknowledge processed entries in Redis
        await redis_client.xack(
            settings.REDIS_STREAM_KEY,
            settings.REDIS_CONSUMER_GROUP,
            *self.buffer_ids,
        )

        self.buffer_rows.clear()
        self.buffer_ids.clear()
        self.last_flush_time = time.monotonic()
        return count

    async def process_cycle(self, redis_client: aioredis.Redis, block_ms: int = 100) -> int:
        entries = await redis_client.xreadgroup(
            groupname=settings.REDIS_CONSUMER_GROUP,
            consumername=self.consumer_name,
            streams={settings.REDIS_STREAM_KEY: ">"},
            count=self.batch_size,
            block=block_ms,
        )

        if entries:
            for stream_name, stream_entries in entries:
                for entry_id, fields in stream_entries:
                    row, e_id = parse_stream_entry(entry_id, fields)
                    self.buffer_rows.append(row)
                    self.buffer_ids.append(e_id)

        time_elapsed = time.monotonic() - self.last_flush_time
        should_flush = len(self.buffer_rows) >= self.batch_size or (
            time_elapsed >= self.flush_interval and len(self.buffer_rows) > 0
        )

        if should_flush:
            return await self.flush(redis_client)
        return 0

    async def run(self):
        self.is_running = True
        await ensure_consumer_group()
        redis_client = await get_redis_client()

        while self.is_running:
            try:
                await self.process_cycle(redis_client, block_ms=100)
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Error in consumer cycle: {e}")
                await asyncio.sleep(0.5)

        if self.buffer_rows:
            await self.flush(redis_client)


async def main():
    consumer = BatchConsumer()
    await consumer.run()


if __name__ == "__main__":
    asyncio.run(main())
