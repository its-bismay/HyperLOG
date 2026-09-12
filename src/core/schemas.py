from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

from pydantic import BaseModel, Field


class LogLevel(str, Enum):
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARN = "WARN"
    ERROR = "ERROR"
    FATAL = "FATAL"


class LogRecord(BaseModel):
    trace_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    service_name: str
    host: str = "default-host"
    environment: str = "production"
    log_level: LogLevel = LogLevel.INFO
    http_method: str = "GET"
    http_status: int = 200
    response_time_ms: float = 0.0
    message: str
    metadata: Dict[str, Any] = Field(default_factory=dict)


class LogBatch(BaseModel):
    logs: List[LogRecord]


class LogIngestResponse(BaseModel):
    status: str = "buffered"
    buffered_count: int
    trace_ids: List[str]
