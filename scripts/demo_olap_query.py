import os
import sys
import time

sys.path.insert(0, os.path.abspath("."))

import clickhouse_connect
from src.core.config import settings


def run_demo_olap_query():
    client = clickhouse_connect.get_client(
        host=settings.CLICKHOUSE_HOST,
        port=settings.CLICKHOUSE_PORT,
        database=settings.CLICKHOUSE_DB,
        username=settings.CLICKHOUSE_USER,
        password=settings.CLICKHOUSE_PASSWORD,
    )

    total = client.query("SELECT count() FROM logs").first_row[0]

    sql = """
    SELECT 
        service_name,
        count() AS total_events,
        countIf(log_level = 'ERROR') AS error_count,
        round(avg(response_time_ms), 2) AS avg_latency_ms,
        round(quantile(0.99)(response_time_ms), 2) AS p99_latency_ms
    FROM logs
    GROUP BY service_name
    ORDER BY total_events DESC
    """

    print("\n" + "=" * 65)
    print("      CLICKHOUSE ON-DEMAND OLAP ANALYTICS BENCHMARK")
    print("=" * 65)
    print(f" Total Rows Scanned: {total:,} records")
    print(" Executing Vectorized Columnar Aggregation...")

    start = time.perf_counter()
    result = client.query(sql)
    duration = time.perf_counter() - start

    print(f"\n [+] Query Completed in: {duration:.4f} seconds ({duration * 1000:.2f} ms)\n")

    headers = ["SERVICE", "TOTAL LOGS", "ERRORS", "AVG LATENCY", "P99 LATENCY"]
    print(f"{headers[0]:<20} {headers[1]:<12} {headers[2]:<10} {headers[3]:<14} {headers[4]:<12}")
    print("-" * 68)
    for row in result.result_rows:
        print(f"{row[0]:<20} {row[1]:<12,d} {row[2]:<10,d} {row[3]:<14.2f} {row[4]:<12.2f}")
    print("=" * 65 + "\n")


if __name__ == "__main__":
    run_demo_olap_query()
