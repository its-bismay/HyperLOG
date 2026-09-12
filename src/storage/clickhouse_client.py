from datetime import datetime
from typing import Any, Dict, List, Optional
import clickhouse_connect
from clickhouse_connect.driver.client import Client

from src.core.config import settings

_ch_client: Optional[Client] = None


def get_clickhouse_client() -> Client:
    global _ch_client
    if _ch_client is None:
        _ch_client = clickhouse_connect.get_client(
            host=settings.CLICKHOUSE_HOST,
            port=settings.CLICKHOUSE_PORT,
            database=settings.CLICKHOUSE_DB,
            username=settings.CLICKHOUSE_USER,
            password=settings.CLICKHOUSE_PASSWORD,
        )
    return _ch_client


def init_db() -> None:
    client = get_clickhouse_client()
    create_table_query = """
    CREATE TABLE IF NOT EXISTS logs (
        trace_id UUID,
        timestamp DateTime64(3, 'UTC'),
        service_name LowCardinality(String),
        host LowCardinality(String),
        environment LowCardinality(String),
        log_level LowCardinality(String),
        http_method LowCardinality(String),
        http_status UInt16,
        response_time_ms Float32,
        message String,
        metadata String
    ) ENGINE = MergeTree()
    PARTITION BY toYYYYMMDD(timestamp)
    ORDER BY (service_name, log_level, timestamp, trace_id)
    SETTINGS index_granularity = 8192;
    """
    client.command(create_table_query)


def insert_logs_batch(rows: List[List[Any]]) -> int:
    if not rows:
        return 0
    client = get_clickhouse_client()
    columns = [
        "trace_id",
        "timestamp",
        "service_name",
        "host",
        "environment",
        "log_level",
        "http_method",
        "http_status",
        "response_time_ms",
        "message",
        "metadata",
    ]
    client.insert("logs", rows, column_names=columns)
    return len(rows)


def get_total_logs_count() -> int:
    client = get_clickhouse_client()
    result = client.query("SELECT count() FROM logs")
    return int(result.first_row[0])


def get_analytics_summary() -> Dict[str, Any]:
    client = get_clickhouse_client()
    total_query = "SELECT count() FROM logs"
    total_logs = int(client.query(total_query).first_row[0])

    level_query = """
    SELECT log_level, count()
    FROM logs
    GROUP BY log_level
    """
    levels = {row[0]: row[1] for row in client.query(level_query).result_rows}

    service_query = """
    SELECT service_name, count(), avg(response_time_ms)
    FROM logs
    GROUP BY service_name
    ORDER BY count() DESC
    LIMIT 10
    """
    services = [
        {"service": row[0], "count": row[1], "avg_latency_ms": round(float(row[2]), 2)}
        for row in client.query(service_query).result_rows
    ]

    status_query = """
    SELECT http_status, count()
    FROM logs
    GROUP BY http_status
    ORDER BY count() DESC
    """
    statuses = {str(row[0]): row[1] for row in client.query(status_query).result_rows}

    return {
        "total_logs": total_logs,
        "levels": levels,
        "services": services,
        "statuses": statuses,
    }


def get_recent_logs(limit: int = 50, min_level: Optional[str] = None) -> List[Dict[str, Any]]:
    client = get_clickhouse_client()
    query = """
    SELECT 
        toString(trace_id),
        formatDateTime(timestamp, '%Y-%m-%dT%H:%i:%s.%fZ'),
        service_name,
        host,
        environment,
        log_level,
        http_method,
        http_status,
        response_time_ms,
        message,
        metadata
    FROM logs
    """
    if min_level:
        query += f" WHERE log_level = '{min_level}'"
    query += f" ORDER BY timestamp DESC LIMIT {limit}"

    result = client.query(query)
    columns = [
        "trace_id", "timestamp", "service_name", "host", "environment",
        "log_level", "http_method", "http_status", "response_time_ms",
        "message", "metadata"
    ]
    logs = []
    for row in result.result_rows:
        logs.append(dict(zip(columns, row)))
    return logs
