from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes.analytics import router as analytics_router
from src.api.routes.ingest import router as ingest_router
from src.api.routes.ws import router as ws_router
from src.storage.clickhouse_client import init_db
from src.storage.redis_client import close_redis_client, ensure_consumer_group


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup initialization
    try:
        init_db()
    except Exception as e:
        print(f"ClickHouse init deferred or pending: {e}")

    try:
        await ensure_consumer_group()
    except Exception as e:
        print(f"Redis stream init deferred or pending: {e}")

    yield

    # Graceful shutdown
    await close_redis_client()


app = FastAPI(
    title="HyperLOG Engine API",
    version="1.0.0",
    description="High-Throughput Log Ingestion and Analytics Pipeline API",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingest_router)
app.include_router(analytics_router)
app.include_router(ws_router)


@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "ok", "service": "HyperLOG Ingestion & Analytics"}
