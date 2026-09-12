import argparse
import asyncio
from datetime import datetime, timezone
import os
import random
import sys
import time
import uuid

sys.path.insert(0, os.path.abspath("."))

import httpx

SERVICES = ["auth-service", "payment-service", "order-engine", "inventory-db", "notification-api"]
ENVIRONMENTS = ["production", "staging"]
HTTP_METHODS = ["GET", "POST", "PUT", "DELETE"]


def generate_log_payload(target_service: str = None, error_rate: float = 0.05) -> dict:
    service = target_service if target_service else random.choice(SERVICES)
    is_error = random.random() < error_rate
    is_warn = not is_error and random.random() < 0.10

    if is_error:
        level = "ERROR"
        status_code = random.choice([500, 502, 503, 504])
        message = f"CRITICAL: Transaction aborted due to database connection pool exhaustion on {service}"
    elif is_warn:
        level = "WARN"
        status_code = random.choice([400, 429])
        message = f"High thread saturation detected above 85% threshold on {service}"
    else:
        level = "INFO"
        status_code = 200
        message = f"HTTP request processed and dispatched successfully for {service}"

    return {
        "trace_id": str(uuid.uuid4()),
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "service_name": service,
        "host": f"ip-10-0-{random.randint(1, 20)}-{random.randint(1, 50)}",
        "environment": random.choice(ENVIRONMENTS),
        "log_level": level,
        "http_method": random.choice(HTTP_METHODS),
        "http_status": status_code,
        "response_time_ms": round(random.uniform(5.0, 450.0), 2),
        "message": message,
        "metadata": {"req_id": random.randint(10000, 99999), "worker_thread": random.randint(1, 16)},
    }


async def worker_task(
    client: httpx.AsyncClient,
    url: str,
    stop_event: asyncio.Event,
    stats: dict,
    batch_size: int = 25,
    target_service: str = None,
    error_rate: float = 0.05,
):
    while not stop_event.is_set():
        if batch_size > 1:
            batch = [generate_log_payload(target_service, error_rate) for _ in range(batch_size)]
            try:
                start = time.perf_counter()
                resp = await client.post(f"{url}/batch", json={"logs": batch})
                duration = (time.perf_counter() - start) * 1000
                if resp.status_code == 202:
                    stats["success"] += batch_size
                    stats["latencies"].append(duration / batch_size)
                else:
                    stats["errors"] += batch_size
            except Exception:
                stats["errors"] += batch_size
        else:
            payload = generate_log_payload(target_service, error_rate)
            try:
                start = time.perf_counter()
                resp = await client.post(url, json=payload)
                duration = (time.perf_counter() - start) * 1000
                if resp.status_code == 202:
                    stats["success"] += 1
                    stats["latencies"].append(duration)
                else:
                    stats["errors"] += 1
            except Exception:
                stats["errors"] += 1


async def run_stress_test(
    url: str = "http://localhost:8000/api/v1/logs",
    duration_secs: int = 10,
    concurrency: int = 20,
    batch_size: int = 25,
    target_service: str = None,
    error_rate: float = 0.05,
):
    stats = {"success": 0, "errors": 0, "latencies": []}
    stop_event = asyncio.Event()

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits, timeout=5.0) as client:
        tasks = [
            asyncio.create_task(
                worker_task(client, url, stop_event, stats, batch_size, target_service, error_rate)
            )
            for _ in range(concurrency)
        ]

        svc_desc = f"Target Service: {target_service}" if target_service else "Services: All (Distributed)"
        err_desc = f"Error Rate: {int(error_rate * 100)}%"
        print(f"[*] Starting Traffic Blast | {svc_desc} | {err_desc} | Concurrency: {concurrency} | Duration: {duration_secs}s")
        start_time = time.perf_counter()
        await asyncio.sleep(duration_secs)
        stop_event.set()
        await asyncio.gather(*tasks, return_exceptions=True)
        total_time = time.perf_counter() - start_time

    total_logs = stats["success"]
    rate = total_logs / total_time if total_time > 0 else 0
    lats = sorted(stats["latencies"])
    p50 = lats[int(len(lats) * 0.5)] if lats else 0
    p95 = lats[int(len(lats) * 0.95)] if lats else 0
    p99 = lats[int(len(lats) * 0.99)] if lats else 0

    print("\n" + "=" * 50)
    print("         HYPERLOG BENCHMARK MEASUREMENTS")
    print("=" * 50)
    print(f" Total Logs Ingested:   {total_logs:,}")
    print(f" Failed Requests:       {stats['errors']:,}")
    print(f" Elapsed Time:          {total_time:.2f} seconds")
    print(f" Sustained Throughput:  {rate:,.0f} logs/sec")
    print(f" API P50 Latency:       {p50:.2f} ms")
    print(f" API P95 Latency:       {p95:.2f} ms")
    print(f" API P99 Latency:       {p99:.2f} ms (Target SLA < 5ms)")
    print("=" * 50 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HyperLOG High-Throughput Traffic Blaster")
    parser.add_argument("--url", default="http://localhost:8000/api/v1/logs", help="Ingestion URL")
    parser.add_argument("--duration", type=int, default=10, help="Test duration in seconds")
    parser.add_argument("--concurrency", type=int, default=20, help="Concurrent async workers")
    parser.add_argument("--batch-size", type=int, default=25, help="Batch size per request")
    parser.add_argument("--service", type=str, default=None, help="Target specific service (e.g. auth-service)")
    parser.add_argument("--error-rate", type=float, default=0.05, help="Error rate (0.0 to 1.0)")
    args = parser.parse_args()

    asyncio.run(run_stress_test(
        url=args.url,
        duration_secs=args.duration,
        concurrency=args.concurrency,
        batch_size=args.batch_size,
        target_service=args.service,
        error_rate=args.error_rate,
    ))
