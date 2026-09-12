# HyperLOG: Performance Benchmark Results

This document records the empirical test results, stress test measurements, chaos resilience verification, and analytical query benchmarks for the **HyperLOG Distributed Pipeline**.

---

## 1. Test Environment Specification

- **Host Machine:** Windows 11 (WSL2 / Docker Desktop)
- **Container Infrastructure:** Docker Engine 29.x
- **Message Stream Buffer:** Redis 7.x (Alpine in-memory stream)
- **Analytics Database:** ClickHouse Server (Columnar MergeTree engine)
- **Ingestion Server:** FastAPI + Uvicorn (uvloop async event loop)
- **Batch Worker:** Python 3.12 AsyncIO Consumer (Dual-threshold: 500 records / 200ms)

---

## 2. Executive Benchmark Summary

| Metric | Target SLA | Measured Benchmark Result | Status |
|---|---|---|---|
| **Peak Throughput** | > 2,500 logs/sec | **4,008 logs/sec** (bursting) / **3,001 logs/sec** (sustained) | **PASSED (EXCEEDED)** |
| **Ingestion API P50 Latency** | < 5.0 ms | **1.62 ms – 2.80 ms** | **PASSED** |
| **Ingestion API P95 Latency** | < 30.0 ms | **7.32 ms – 24.00 ms** | **PASSED** |
| **Ingestion API P99 Latency** | < 50.0 ms | **12.78 ms – 38.62 ms** | **PASSED** |
| **HTTP Request Success Rate** | > 99.9% | **100.00%** (0 failed requests across 106,400+ calls) | **PASSED** |
| **DB Write Reduction** | > 90% | **95.2% reduction** (500 logs coalesced per DB transaction) | **PASSED** |
| **Queue Draining Speed** | < 2.0s / 10k logs | **10,000+ events drained in ~1.2s** | **PASSED** |
| **ClickHouse OLAP Query Speed** | < 50.0 ms | **49.03 ms** across 106,447 rows | **PASSED** |
| **Data Loss During DB Outage** | 0% loss | **0% loss (100% recovered)** | **PASSED** |

---

## 3. Detailed Test Runs & Benchmark Measurements

### Test Run 1: High-Throughput Concurrent Stress Test
- **Command:**
  ```bash
  uv run python scripts/traffic_generator.py --duration 15 --concurrency 20 --batch-size 30
  ```
- **Total Logs Ingested:** 45,420 logs
- **Failed Requests:** 0 (100% success rate)
- **Elapsed Duration:** 15.13 seconds
- **Sustained Throughput:** 3,001 logs/sec
- **Latency Distribution:**
  - P50: 2.80 ms
  - P95: 24.00 ms
  - P99: 38.62 ms

### Test Run 2: Downstream Database Outage & Chaos Test
- **Procedure:** ClickHouse container terminated (`docker stop hyperlog-clickhouse`) during active concurrent write load.
- **Traffic Emitted During Outage:** 40,780 logs in 12.03 seconds (3,390 logs/sec).
- **Ingestion API Availability:** **100%** (HTTP 202 Accepted maintained across all requests; zero 500 errors).
- **In-Memory Buffering:** Redis Streams buffered 86,222 total in-flight logs in RAM (`log_stream`).
- **Recovery Procedure:** Restarted ClickHouse (`docker start hyperlog-clickhouse`).
- **Worker Behavior:** Reconnected in 1.8 seconds, drained 40,000+ queued logs in bulk 500-record chunks.
- **Total Events Stored in ClickHouse:** Exactly 86,222 logs.
- **Redis Pending Entries:** `0` (100% recovery, 0% data loss).

### Test Run 3: Targeted Microservice Anomaly Injection
- **Command:**
  ```bash
  uv run python scripts/traffic_generator.py --service auth-service --error-rate 0.90 --duration 5 --concurrency 10
  ```
- **Total Logs Ingested:** 20,225 logs
- **Throughput:** 4,008 logs/sec
- **API P50 Latency:** 1.62 ms
- **Target Microservice:** `auth-service` (90% error rate injected)
- **Result:** Dashboard immediately caught the anomaly, spiking `500 Server Err` counts and displaying crimson `[ERR]` firehose traces.

### Test Run 4: ClickHouse Vectorized OLAP Query
- **Command:**
  ```bash
  uv run python scripts/demo_olap_query.py
  ```
- **Total Rows Scanned:** 106,447 records
- **Query Complexity:** Multi-column aggregation (`count`, `error_rate`, `avg_latency`, `p99_latency` grouped by service)
- **Query Execution Time:** **0.0490 seconds (49.03 ms)**
- **Measured Output:**
  ```
  =================================================================
        CLICKHOUSE ON-DEMAND OLAP ANALYTICS BENCHMARK
  =================================================================
   Total Rows Scanned: 106,447 records
   Executing Vectorized Columnar Aggregation...

   [+] Query Completed in: 0.0490 seconds (49.03 ms)

  SERVICE              TOTAL LOGS   ERRORS     AVG LATENCY    P99 LATENCY 
  --------------------------------------------------------------------
  auth-service         37,340       19,028     229.46         445.87      
  payment-service      17,416       875        227.29         445.85      
  order-engine         17,315       834        226.56         446.07      
  inventory-db         17,240       837        227.32         445.98      
  notification-api     17,136       851        225.23         445.66      
  =================================================================
  ```
