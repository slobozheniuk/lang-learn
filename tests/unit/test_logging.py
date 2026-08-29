import logging
import os
from pathlib import Path
import tempfile
import time
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.config import settings
from app.logging_config import (
    LOG_FORMAT,
    RequestLoggingMiddleware,
    extract_user_id_from_token,
    purge_old_log_files,
    setup_logging,
)
from app.auth.security import create_access_token


def test_setup_logging_initialization():
    """Verify setup_logging creates the logs directory and configures handlers."""
    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir) / "test_logs"
        res_dir = setup_logging(log_dir=log_dir, log_level="DEBUG", backup_days=7)
        assert res_dir.exists()
        assert (res_dir / settings.LOG_FILE_NAME).exists()

        root = logging.getLogger()
        handler_types = [type(h).__name__ for h in root.handlers]
        assert "StreamHandler" in handler_types
        assert "TimedRotatingFileHandler" in handler_types

        # Verify writing log message
        test_msg = "Test verification log message 12345"
        logging.getLogger("app.test").info(test_msg)

        content = (res_dir / settings.LOG_FILE_NAME).read_text(encoding="utf-8")
        assert test_msg in content
        assert "app.test" in content


def test_purge_old_log_files():
    """Verify purge_old_log_files deletes files older than 7 days and keeps recent ones."""
    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)
        # Create active log file (should NOT be deleted)
        active_log = log_dir / settings.LOG_FILE_NAME
        active_log.write_text("active log content")

        # Create recent rotated log file (2 days old -> keep)
        recent_log = log_dir / "app-2026-08-26.log"
        recent_log.write_text("recent log content")
        two_days_ago = time.time() - (2 * 86400)
        os.utime(recent_log, (two_days_ago, two_days_ago))

        # Create old rotated log file (10 days old -> purge)
        old_log1 = log_dir / "app-2026-08-18.log"
        old_log1.write_text("old log content 1")
        ten_days_ago = time.time() - (10 * 86400)
        os.utime(old_log1, (ten_days_ago, ten_days_ago))

        # Create another old rotated log file (app.log.2026-08-15 -> purge)
        old_log2 = log_dir / "app.log.2026-08-15"
        old_log2.write_text("old log content 2")
        thirteen_days_ago = time.time() - (13 * 86400)
        os.utime(old_log2, (thirteen_days_ago, thirteen_days_ago))

        # Purge files older than 7 days
        deleted = purge_old_log_files(log_dir=log_dir, max_days=7)

        assert "app-2026-08-18.log" in deleted
        assert "app.log.2026-08-15" in deleted
        assert "app-2026-08-26.log" not in deleted
        assert settings.LOG_FILE_NAME not in deleted

        assert not old_log1.exists()
        assert not old_log2.exists()
        assert recent_log.exists()
        assert active_log.exists()


def test_extract_user_id_from_token():
    """Verify JWT user ID decoding from Authorization header."""
    token = create_access_token(data={"sub": "42", "username": "alex"})
    assert extract_user_id_from_token(f"Bearer {token}") == "42"
    assert extract_user_id_from_token(None) is None
    assert extract_user_id_from_token("InvalidHeader") is None
    assert extract_user_id_from_token("Bearer invalid.token.payload") is None


def test_request_logging_middleware():
    """Verify RequestLoggingMiddleware intercepts requests, calculates duration, logs status, and adds header."""
    app = FastAPI()
    app.add_middleware(RequestLoggingMiddleware)

    @app.get("/test-ok")
    def test_ok():
        return {"status": "ok"}

    @app.get("/test-warn")
    def test_warn():
        raise HTTPException(status_code=400, detail="Client warning")

    @app.get("/test-500")
    def test_500():
        raise HTTPException(status_code=500, detail="Internal Server Error")

    @app.get("/test-error")
    def test_error():
        raise RuntimeError("Server panic")

    client = TestClient(app, raise_server_exceptions=False)

    # 1. 200 OK request
    res_ok = client.get("/test-ok")
    assert res_ok.status_code == 200
    assert "X-Process-Time" in res_ok.headers

    # 2. 400 Bad Request
    res_warn = client.get("/test-warn")
    assert res_warn.status_code == 400
    assert "X-Process-Time" in res_warn.headers

    # 3. 500 Server Error via HTTPException
    res_500 = client.get("/test-500")
    assert res_500.status_code == 500
    assert "X-Process-Time" in res_500.headers

    # 4. Unhandled server exception
    res_err = client.get("/test-error")
    assert res_err.status_code == 500
