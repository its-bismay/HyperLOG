from fastapi import APIRouter, status

from src.core.schemas import LogBatch, LogIngestResponse, LogRecord
from src.storage.redis_client import push_log, push_logs_batch

router = APIRouter(prefix="/api/v1/logs", tags=["Ingestion"])


@router.post("", status_code=status.HTTP_202_ACCEPTED, response_model=LogIngestResponse)
async def ingest_single_log(record: LogRecord):
    entry_id = await push_log(record)
    return LogIngestResponse(
        status="buffered",
        buffered_count=1,
        trace_ids=[str(record.trace_id)],
    )


@router.post("/batch", status_code=status.HTTP_202_ACCEPTED, response_model=LogIngestResponse)
async def ingest_batch_logs(batch: LogBatch):
    entry_ids = await push_logs_batch(batch.logs)
    return LogIngestResponse(
        status="buffered",
        buffered_count=len(batch.logs),
        trace_ids=[str(r.trace_id) for r in batch.logs],
    )
