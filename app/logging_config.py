import asyncio
from datetime import datetime, timezone
import glob
import logging
from logging.handlers import TimedRotatingFileHandler
import os
from pathlib import Path
import re
import time
from typing import Any, Callable

from fastapi import Request, Response
import jwt
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings

# Structured log format
LOG_FORMAT = "%(asctime)s | %(levelname)-8s | %(name)s:%(lineno)d | %(message)s"
DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

logger = logging.getLogger("app.logging")


def get_log_dir() -> Path:
    """Return the absolute path to the application's log directory."""
    if os.path.isabs(settings.LOG_DIR):
        return Path(settings.LOG_DIR)
    # Default relative to project root
    root_dir = Path(__file__).resolve().parent.parent
    return root_dir / settings.LOG_DIR


def purge_old_log_files(log_dir: Path | str | None = None, max_days: int = 7) -> list[str]:
    """
    Scan the log directory and delete log files older than max_days.
    Returns the list of deleted filenames.
    """
    if log_dir is None:
        log_path = get_log_dir()
    else:
        log_path = Path(log_dir)

    if not log_path.exists():
        return []

    deleted_files: list[str] = []
    cutoff_seconds = time.time() - (max_days * 86400)

    try:
        for entry in log_path.iterdir():
            if not entry.is_file():
                continue

            # Identify rotated log files (e.g. app.log.2026-08-20, app-2026-08-20.log, *.log.*)
            name = entry.name
            is_log_file = (
                name.endswith(".log")
                or ".log." in name
                or re.search(r"app[-._]\d{4}-\d{2}-\d{2}", name) is not None
            )

            # Never delete the currently active main log file if it's named app.log
            if name == settings.LOG_FILE_NAME:
                continue

            if is_log_file:
                try:
                    mtime = entry.stat().st_mtime
                    if mtime < cutoff_seconds:
                        entry.unlink()
                        deleted_files.append(name)
                except Exception as err:
                    logging.getLogger("app.logging").error(
                        f"Failed to delete old log file '{name}': {err}"
                    )

        if deleted_files:
            logging.getLogger("app.logging").info(
                f"Log cleanup: purged {len(deleted_files)} files older than {max_days} days: {deleted_files}"
            )
    except Exception as e:
        logging.getLogger("app.logging").error(f"Error during log purge scan: {e}")

    return deleted_files


def setup_logging(
    log_dir: Path | str | None = None,
    log_level: str | int | None = None,
    backup_days: int = 7,
) -> Path:
    """
    Configure root and application loggers:
    - Creates 'logs/' directory at project root
    - Configures TimedRotatingFileHandler (daily rotation at midnight, backupCount=7)
    - Configures Console StreamHandler
    - Intercepts uvicorn, fastapi, alembic, and app logs
    - Automatically purges log files older than 7 days
    """
    if log_dir is None:
        target_dir = get_log_dir()
    else:
        target_dir = Path(log_dir)

    target_dir.mkdir(parents=True, exist_ok=True)
    log_file_path = target_dir / settings.LOG_FILE_NAME

    if log_level is None:
        level_str = getattr(settings, "LOG_LEVEL", "INFO").upper()
        effective_level = getattr(logging, level_str, logging.INFO)
    elif isinstance(log_level, str):
        effective_level = getattr(logging, log_level.upper(), logging.INFO)
    else:
        effective_level = log_level

    # Root Logger Configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(effective_level)

    # Avoid adding duplicate handlers if setup_logging is called multiple times
    for handler in list(root_logger.handlers):
        root_logger.removeHandler(handler)

    formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)

    # 1. Console Stream Handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(effective_level)
    console_handler.setFormatter(formatter)
    root_logger.addHandler(console_handler)

    # 2. Daily Timed Rotating File Handler
    # when='midnight' rotates every midnight, interval=1 day, backupCount=7 keeps 7 days
    file_handler = TimedRotatingFileHandler(
        filename=str(log_file_path),
        when="midnight",
        interval=1,
        backupCount=backup_days,
        encoding="utf-8",
        delay=False,
    )
    file_handler.setLevel(effective_level)
    file_handler.setFormatter(formatter)
    file_handler.suffix = "%Y-%m-%d"
    root_logger.addHandler(file_handler)

    # Propagate common third-party framework loggers to root
    for logger_name in ["app", "uvicorn", "uvicorn.access", "uvicorn.error", "fastapi", "alembic"]:
        sub_logger = logging.getLogger(logger_name)
        sub_logger.setLevel(effective_level)
        sub_logger.propagate = True

    # Purge old log files at startup
    purge_old_log_files(target_dir, max_days=backup_days)

    root_logger.info(
        f"LangLearn logging initialized | Log file: {log_file_path} | Level: {effective_level} | Retention: {backup_days} days"
    )
    return target_dir


def extract_user_id_from_token(auth_header: str | None) -> str | None:
    """Safely decode JWT token from Authorization header to extract user id/sub without raising."""
    if not auth_header or not auth_header.startswith("Bearer "):
        return None
    token = auth_header[7:].strip()
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
            options={"verify_exp": False, "verify_signature": False},
        )
        sub = payload.get("sub")
        return str(sub) if sub is not None else None
    except Exception:
        return None


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    FastAPI / Starlette Middleware logging internal API requests and responses:
    - HTTP Method, URL Path, Query Params
    - Client IP address
    - User ID (from JWT Authorization header / state if present)
    - Response Status Code
    - Request Duration in milliseconds
    - Detailed warning/error logging on 4xx/5xx responses and unhandled exceptions
    """

    async def dispatch(self, request: Request, call_next: Callable[[Request], Any]) -> Response:
        start_time = time.perf_counter()
        client_host = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("x-forwarded-for")
        client_ip = forwarded_for.split(",")[0].strip() if forwarded_for else client_host

        # Extract user identification
        user_id = getattr(request.state, "user_id", None)
        if not user_id:
            user_id = extract_user_id_from_token(request.headers.get("authorization"))

        user_tag = f"user_id={user_id}" if user_id else "anonymous"
        query_str = f"?{request.url.query}" if request.url.query else ""
        req_path = f"{request.url.path}{query_str}"
        method = request.method

        try:
            response: Response = await call_next(request)
            duration_ms = (time.perf_counter() - start_time) * 1000
            status_code = response.status_code

            # Attach response header for duration
            response.headers["X-Process-Time"] = f"{duration_ms:.2f}ms"

            # Log based on HTTP status code category
            if status_code >= 500:
                logger.error(
                    f"API Error 5xx: {method} {req_path} | Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms | Client: {client_ip} | {user_tag}"
                )
            elif status_code >= 400:
                logger.warning(
                    f"API Warning 4xx: {method} {req_path} | Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms | Client: {client_ip} | {user_tag}"
                )
            else:
                logger.info(
                    f"API Request: {method} {req_path} | Status: {status_code} | "
                    f"Duration: {duration_ms:.2f}ms | Client: {client_ip} | {user_tag}"
                )

            return response

        except Exception as exc:
            duration_ms = (time.perf_counter() - start_time) * 1000
            logger.error(
                f"API Unhandled Exception: {method} {req_path} | "
                f"Duration: {duration_ms:.2f}ms | Client: {client_ip} | {user_tag} | Error: {exc}",
                exc_info=True,
            )
            raise exc
