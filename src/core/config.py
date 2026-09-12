from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    REDIS_HOST: str = "localhost"
    REDIS_PORT: int = 6379
    REDIS_STREAM_KEY: str = "log_stream"
    REDIS_CONSUMER_GROUP: str = "analytics_workers"
    REDIS_MAX_STREAM_LEN: int = 1_000_000

    CLICKHOUSE_HOST: str = "localhost"
    CLICKHOUSE_PORT: int = 8123
    CLICKHOUSE_DB: str = "default"
    CLICKHOUSE_USER: str = "default"
    CLICKHOUSE_PASSWORD: str = ""

    BATCH_SIZE: int = 500
    FLUSH_INTERVAL_SECONDS: float = 0.2


settings = Settings()
