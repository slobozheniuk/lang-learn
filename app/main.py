import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1.api import api_router
from app.config import settings
from app.crud.language import seed_default_languages
from app.database import SessionLocal, engine, ensure_db_schema_updated
from app.logging_config import RequestLoggingMiddleware, purge_old_log_files, setup_logging
from app.models.base import Base
from app.services.job_queue import job_queue_service
from app.services.scheduler import scheduler_service

# Initialize logging configuration immediately on app import
setup_logging()
logger = logging.getLogger("app.main")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    logger.info(f"Starting {settings.PROJECT_NAME} backend application...")
    # Initialize DB tables
    Base.metadata.create_all(bind=engine)
    ensure_db_schema_updated()
    # Seed default languages (ru, en, nl)
    with SessionLocal() as db:
        seed_default_languages(db)
    # Background log cleanup routine (retention: 7 days)
    purge_old_log_files(max_days=settings.LOG_BACKUP_DAYS)
    # Start background job worker and scheduler
    job_queue_service.start_worker()
    scheduler_service.start()
    logger.info(f"{settings.PROJECT_NAME} startup sequence completed successfully.")
    yield
    # Stop background job worker and scheduler
    logger.info("Shutting down background services...")
    await scheduler_service.stop()
    await job_queue_service.stop_worker()
    logger.info(f"{settings.PROJECT_NAME} shutdown completed.")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.PROJECT_NAME,
        version="0.1.0",
        lifespan=lifespan,
    )

    # Request and Response Logging Middleware
    app.add_middleware(RequestLoggingMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(api_router, prefix=settings.API_V1_STR)

    @app.get("/health", tags=["health"])
    def health_check() -> dict[str, str]:
        return {"status": "ok", "app": settings.PROJECT_NAME}

    # Mount frontend static files if built
    frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
    if frontend_dist.exists() and (frontend_dist / "index.html").exists():
        app.mount("/", StaticFiles(directory=str(frontend_dist), html=True), name="frontend")
    else:
        @app.get("/", tags=["root"])
        def root() -> dict[str, str]:
            return {"message": "Language Learning App Backend API", "docs": "/docs"}

    return app


app = create_app()


