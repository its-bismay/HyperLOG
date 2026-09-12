import asyncio
from datetime import datetime, timezone
import pytest
from httpx import ASGITransport, AsyncClient

from src.api.main import app
from src.core.schemas import LogBatch, LogLevel, LogRecord
from src.storage.clickhouse_client import (
    get_analytics_summary,
    get_total_logs_count,
    init_db,
)
from src.storage.redis_client import ensure_consumer_group, get_queue_depth, get_redis_client
from src.worker.consumer import BatchConsumer


@pytest.mark.asyncio
async def test_end_to_end_pipeline():
    # 1. Initialize databases and groups
    init_db()
    await ensure_consumer_group()
    initial_db_count = get_total_logs_count()

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        # 2. Verify Health Check
        health_resp = await client.get("/health")
        assert health_resp.status_code == 200
        assert health_resp.json()["status"] == "ok"

        # 3. Ingest Single Log
        single_payload = {
            "service_name": "auth-service",
            "host": "node-1",
            "environment": "production",
            "log_level": "ERROR",
            "http_method": "POST",
            "http_status": 500,
            "response_time_ms": 120.5,
            "message": "User login failed: authentication token expired",
            "metadata": {"user_id": "usr_42"},
        }
        single_resp = await client.post("/api/v1/logs", json=single_payload)
        assert single_resp.status_code == 202
        single_data = single_resp.json()
        assert single_data["status"] == "buffered"
        assert single_data["buffered_count"] == 1
        assert len(single_data["trace_ids"]) == 1

        # 4. Ingest Batch of 20 logs
        batch_logs = []
        for i in range(20):
            batch_logs.append({
                "service_name": "payment-service",
                "host": f"node-{i % 3}",
                "environment": "production",
                "log_level": "INFO" if i % 4 != 0 else "WARN",
                "http_method": "POST",
                "http_status": 200 if i % 4 != 0 else 400,
                "response_time_ms": 45.2 + i,
                "message": f"Payment transaction #{i} processed successfully",
                "metadata": {"order_id": f"ord_{1000 + i}"},
            })

        batch_resp = await client.post("/api/v1/logs/batch", json={"logs": batch_logs})
        assert batch_resp.status_code == 202
        batch_data = batch_resp.json()
        assert batch_data["buffered_count"] == 20

    # 5. Check Redis queue depth
    queue_depth = await get_queue_depth()
    assert queue_depth >= 21

    # 6. Run Worker consumer cycle to flush the batch to ClickHouse
    consumer = BatchConsumer(consumer_name="test-worker")
    redis_client = await get_redis_client()
    
    # Process until buffer is empty or read all
    await consumer.process_cycle(redis_client, block_ms=200)
    await consumer.flush(redis_client)

    # 7. Verify ClickHouse received the records
    final_db_count = get_total_logs_count()
    assert final_db_count >= initial_db_count + 21

    # 8. Test Analytics summary
    summary = get_analytics_summary()
    assert summary["total_logs"] >= 21
    assert "ERROR" in summary["levels"]
    assert any(s["service"] == "auth-service" for s in summary["services"])
