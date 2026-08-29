import os
import socket
import subprocess
import sys
import tempfile
import time
from typing import Generator
import httpx
import pytest
from playwright.sync_api import Browser, BrowserContext, Page, expect, sync_playwright


def get_free_port(preferred_port: int = 8888) -> int:
    """Try preferred port first, otherwise find any free ephemeral port."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        try:
            s.bind(("127.0.0.1", preferred_port))
            return preferred_port
        except OSError:
            pass

    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def login_demo_user(page: Page) -> None:
    """Logs in using the Quick Demo Login button on the dedicated auth screen if unauthenticated."""
    drawer = page.locator("#burger-menu-drawer")
    if drawer.is_visible():
        close_btn = page.locator("#drawer-close-btn")
        if close_btn.is_visible():
            close_btn.click()
    demo_btn = page.locator("#quick-demo-btn")
    if demo_btn.is_visible():
        demo_btn.click()
        expect(page.locator("#lessons-view")).to_be_visible()


@pytest.fixture(scope="session")
def test_server() -> Generator[str, None, None]:
    """Start an ephemeral FastAPI server with an isolated SQLite database and static frontend."""
    temp_dir = tempfile.TemporaryDirectory()
    db_path = os.path.join(temp_dir.name, "test_mobile.db")
    port = get_free_port(8888)
    server_url = f"http://127.0.0.1:{port}"

    env = os.environ.copy()
    env["DATABASE_URL"] = f"sqlite:///{db_path}"
    env["PYTHONPATH"] = "."
    env["NOUS_API_KEY"] = ""
    env["OPENAI_API_KEY"] = ""
    env["LLM_API_KEY"] = ""

    server_log_path = os.path.join(temp_dir.name, "test_server.log")
    server_log = open(server_log_path, "w+", encoding="utf-8")

    proc = subprocess.Popen(
        [
            sys.executable,
            "-m",
            "uvicorn",
            "app.main:app",
            "--host",
            "127.0.0.1",
            "--port",
            str(port),
            "--log-level",
            "warning",
        ],
        env=env,
        stdout=server_log,
        stderr=server_log,
    )

    # Wait for server to become responsive
    started = False
    for _ in range(60):
        try:
            res = httpx.get(f"{server_url}/health", timeout=1.0)
            if res.status_code == 200:
                started = True
                break
        except Exception:
            time.sleep(0.1)

    if not started:
        proc.terminate()
        try:
            proc.wait(timeout=5)
        except Exception:
            proc.kill()
        server_log.seek(0)
        log_content = server_log.read()
        server_log.close()
        temp_dir.cleanup()
        raise RuntimeError(
            f"Test server failed to start on {server_url}. Server output: {log_content}"
        )

    yield server_url

    # Cleanup
    try:
        proc.terminate()
        proc.wait(timeout=5)
    except Exception:
        proc.kill()
    finally:
        server_log.close()
        temp_dir.cleanup()


@pytest.fixture(scope="session")
def playwright_instance():
    """Session-scoped Playwright instance."""
    with sync_playwright() as p:
        yield p


@pytest.fixture(scope="session")
def browser(playwright_instance) -> Generator[Browser, None, None]:
    """Session-scoped chromium browser."""
    b = playwright_instance.chromium.launch(
        headless=True,
        args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
    )
    yield b
    b.close()


@pytest.fixture(scope="function")
def mobile_context(browser: Browser) -> Generator[BrowserContext, None, None]:
    """Mobile browser context emulating iPhone 14/15 (390x844, touch enabled)."""
    context = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True,
        device_scale_factor=3,
    )
    yield context
    context.close()


@pytest.fixture(scope="function")
def mobile_page(mobile_context: BrowserContext, test_server: str) -> Generator[Page, None, None]:
    """A fresh page loaded with the mobile context pointing to the test server."""
    page = mobile_context.new_page()
    page.goto(test_server)
    page.wait_for_load_state("networkidle")
    # Clean up any leftover words/lessons between test runs
    try:
        page.evaluate("""async () => {
            const token = localStorage.getItem('ll_token');
            if (!token) return;
            const headers = { 'Authorization': `Bearer ${token}` };
            const existing = await fetch('/api/v1/words/?limit=100', { headers }).then(r => r.json()).catch(() => []);
            for (const w of (existing || [])) {
                await fetch(`/api/v1/words/${w.id}`, { method: 'DELETE', headers }).catch(() => {});
            }
            const existingLessons = await fetch('/api/v1/lessons/?limit=100', { headers }).then(r => r.json()).catch(() => []);
            for (const l of (existingLessons || [])) {
                await fetch(`/api/v1/lessons/${l.id}`, { method: 'DELETE', headers }).catch(() => {});
            }
        }""")
    except Exception:
        pass
    yield page
    page.close()


@pytest.fixture(scope="function")
def narrow_mobile_context(browser: Browser) -> Generator[BrowserContext, None, None]:
    """Ultra-narrow mobile browser context (320x568, e.g. iPhone SE 1st Gen)."""
    context = browser.new_context(
        viewport={"width": 320, "height": 568},
        user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
        is_mobile=True,
        has_touch=True,
        device_scale_factor=2,
    )
    yield context
    context.close()


@pytest.fixture(scope="function")
def narrow_mobile_page(narrow_mobile_context: BrowserContext, test_server: str) -> Generator[Page, None, None]:
    """A fresh page with ultra-narrow (320px) viewport."""
    page = narrow_mobile_context.new_page()
    page.goto(test_server)
    page.wait_for_load_state("networkidle")
    yield page
    page.close()
