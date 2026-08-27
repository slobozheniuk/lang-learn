from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    PROJECT_NAME: str = "Language Learning App"
    API_V1_STR: str = "/api/v1"
    SECRET_KEY: str = "development-secret-key-change-in-production-1234567890"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    DATABASE_URL: str = "sqlite:///./lang_learn.db"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
