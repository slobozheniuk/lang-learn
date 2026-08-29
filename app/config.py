from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Language Learning App"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "development-secret-key-change-in-production-1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = "sqlite:///./lang_learn.db"

    # LLM Settings (Nous Portal / OpenAI-compatible / Gemini Flash 3.7)
    NOUS_API_KEY: str | None = None
    OPENAI_API_KEY: str | None = None
    LLM_API_KEY: str | None = None
    LLM_BASE_URL: str = "https://inference-api.nousresearch.com/v1"
    LLM_MODEL: str = "google/gemini-3.7-flash"

    # Logging Settings
    LOG_DIR: str = "logs"
    LOG_LEVEL: str = "INFO"
    LOG_BACKUP_DAYS: int = 7
    LOG_FILE_NAME: str = "app.log"

    @property
    def effective_llm_api_key(self) -> str:
        return self.NOUS_API_KEY or self.LLM_API_KEY or self.OPENAI_API_KEY or ""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
