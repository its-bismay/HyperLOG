import asyncio
import os
import sys

sys.path.insert(0, os.path.abspath("."))

import clickhouse_connect
import redis.asyncio as aioredis
from src.core.config import settings


async def reset_all():
    # 1. Truncate ClickHouse table
    try:
        ch = clickhouse_connect.get_client(
            host=settings.CLICKHOUSE_HOST,
            port=settings.CLICKHOUSE_PORT,
            database=settings.CLICKHOUSE_DB,
            username=settings.CLICKHOUSE_USER,
            password=settings.CLICKHOUSE_PASSWORD,
        )
        ch.command("TRUNCATE TABLE logs")
        print("[*] ClickHouse 'logs' table truncated to 0 rows.")
    except Exception as e:
        print(f"[!] ClickHouse truncate error: {e}")

    # 2. Reset Redis stream
    try:
        r = aioredis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            decode_responses=True,
        )
        await r.delete(settings.REDIS_STREAM_KEY)
        try:
            await r.xgroup_create(
                name=settings.REDIS_STREAM_KEY,
                groupname=settings.REDIS_CONSUMER_GROUP,
                id="0",
                mkstream=True,
            )
        except Exception:
            pass
        await r.aclose()
        print("[*] Redis 'log_stream' deleted and consumer group initialized to 0.")
    except Exception as e:
        print(f"[!] Redis reset error: {e}")

    print("\n[+] Clean slate ready! Both ClickHouse and Redis are at 0 events.")


if __name__ == "__main__":
    asyncio.run(reset_all())
