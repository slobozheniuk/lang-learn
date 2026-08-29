# LangLearn 🌐

> Modern, multimodal language learning web platform and Telegram Web App (TWA) with AI-powered micro-lesson generation, single-word vocabulary ingestion, interactive quiz creation, and algorithmic Spaced Repetition (SM-2).

---

## 📑 Table of Contents

- [Overview & Architecture](#-overview--architecture)
- [Key Features](#-key-features)
- [Repository Directory Structure](#-repository-directory-structure)
- [Prerequisites (macOS & Linux)](#-prerequisites-macos--linux)
- [Quickstart & Local Setup](#-quickstart--local-setup)
  - [1. Clone Repository](#1-clone-repository)
  - [2. Backend Setup](#2-backend-setup)
  - [3. Frontend Setup](#3-frontend-setup)
  - [4. Running Backend Server](#4-running-backend-server)
  - [5. Running Frontend Web App](#5-running-frontend-web-app)
- [Running Tests](#-running-tests)
- [Debugging in VS Code](#-debugging-in-vs-code)
- [Environment Configuration Reference](#-environment-configuration-reference)

---

## 🏗 Overview & Architecture

LangLearn combines an asynchronous FastAPI backend with a responsive React 19 single-page application (SPA).

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                            LangLearn Architecture                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                 ┌────────────────────┴────────────────────┐
                 ▼                                         ▼
   ┌───────────────────────────┐             ┌───────────────────────────┐
   │ React 19 / TypeScript SPA │             │    Telegram Web App       │
   │  - Vite Dev / Prod Build  │             │   - TWA CSS Theme Tokens  │
   │  - Pinned Header & Dock   │             │   - Native Haptic Engine  │
   │  - 3D Flip Flashcards     │             │   - Adaptive Theme Colors │
   └─────────────┬─────────────┘             └─────────────┬─────────────┘
                 │                                         │
                 └────────────────────┬────────────────────┘
                                      │ REST API / JWT
                                      ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                     FastAPI Backend (Port 8080)                     │
   │  ┌───────────────────────┐         ┌─────────────────────────────┐  │
   │  │  Authentication &     │         │ Spaced Repetition (SM-2)    │  │
   │  │  Multi-Profile System │         │ - EF, Intervals, Reviews    │  │
   │  └───────────────────────┘         └─────────────────────────────┘  │
   │  ┌───────────────────────┐         ┌─────────────────────────────┐  │
   │  │  Async Job Queue      │◄───────►│ LLM Integration Service     │  │
   │  │  & Worker Pipeline    │         │ - Nous Portal / Gemini 3.7  │  │
   │  └───────────────────────┘         │ - OpenAI / Compatible API   │  │
   │  ┌───────────────────────┐         └─────────────────────────────┘  │
   │  │ Static File Server    │         ┌─────────────────────────────┐  │
   │  │ (Serves frontend/dist)│         │ Nightly Lesson Scheduler    │  │
   │  └───────────────────────┘         └─────────────────────────────┘  │
   └──────────────────────────────────┬──────────────────────────────────┘
                                      │
                                      ▼
   ┌─────────────────────────────────────────────────────────────────────┐
   │                  SQLite Database (lang_learn.db)                    │
   │  - Users, Learning Profiles, Words, Lessons, Word Stats, Logs       │
   └─────────────────────────────────────────────────────────────────────┘
```

- **Backend:** FastAPI (Python 3.11+), SQLAlchemy 2.0 ORM, Pydantic v2 schemas, SQLite storage with automatic schema migrations, Alembic, and JWT Bearer authentication.
- **Spaced Repetition System (SM-2):** Algorithmic interval calculation ($I_n = I_{n-1} \times \text{EF}$), ease factor tracking, and 4-grade rating system (*Again, Hard, Good, Easy*).
- **LLM Multimodal Processing:** OpenAI-compatible API client supporting Nous Research Portal (`google/gemini-3.7-flash`), OpenAI (`gpt-4o-mini`), or local inference servers for extracting vocabulary, translations, contextual examples, and multi-choice quizzes.
- **Frontend SPA:** React 19, TypeScript, Vite, responsive 100dvh pinned flex layout with subwindow scrolling, smooth 3D flip card animations, and Telegram Web App haptic feedback integration.

---

## ✨ Key Features

- **Profile Switching with Flags:** Easily toggle between target languages (e.g. 🇷🇺 Russian, 🇬🇧 English, 🇳🇱 Dutch, 🇩🇪 German, 🇪🇸 Spanish, 🇫🇷 French) with isolated wordlists and progress tracking.
- **Single-Word Extraction:** Inputting a single word or short phrase instantly creates a flashcard with AI-generated translations, definitions, and contextual sentences without bloating lessons.
- **Bite-Sized 5-Word Lessons:** Raw vocabulary and ingested texts are structured into digestible 5-word micro-lessons.
- **Interactive Quizzes:** Dynamic AI-generated multiple-choice questions per lesson with scoring and completion tracking.
- **Deck Controls:** Restart Deck and Shuffle modes for focused review sessions.
- **Strict User & Profile Isolation:** Multi-user security ensuring user vocabulary, flashcards, and review queues remain isolated.

---

## 📁 Repository Directory Structure

```text
lang-learn/
├── .env.example              # Environment variable template with documentation
├── .gitignore                # Git ignore rules for Python, Node, and SQLite
├── .vscode/                  # VS Code debugging and interpreter configuration
│   ├── launch.json           # Pre-configured debug targets (FastAPI, Pytest, Mobile E2E)
│   └── settings.json         # Python interpreter and pytest discovery settings
├── alembic/                  # Database schema migrations
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
├── alembic.ini               # Alembic configuration
├── app/                      # Backend FastAPI application
│   ├── __init__.py
│   ├── main.py               # Application entry point, lifespan, static mounting
│   ├── config.py             # Pydantic BaseSettings configuration
│   ├── database.py           # SQLAlchemy engine, session maker, schema auto-migration
│   ├── logging_config.py     # Request/response logging and daily log rotator
│   ├── api/                  # API routers (v1 endpoints)
│   │   └── v1/
│   │       ├── api.py        # Centralized router combining sub-routes
│   │       └── endpoints/    # Auth, words, reviews, lessons, profiles, jobs, etc.
│   ├── auth/                 # JWT security, password hashing, and token dependency
│   ├── crud/                 # Database CRUD operations
│   ├── models/               # SQLAlchemy ORM models (User, Profile, Word, Lesson, etc.)
│   ├── schemas/              # Pydantic request and response schemas
│   ├── services/             # Background job worker, scheduler, LLM client
│   └── srs/                  # SM-2 Spaced Repetition algorithm implementation
├── frontend/                 # Frontend React 19 + TypeScript SPA
│   ├── index.html            # Single page HTML entry
│   ├── package.json          # Node dependencies and scripts
│   ├── tsconfig.json         # TypeScript configuration
│   ├── vite.config.ts        # Vite configuration with /api backend proxy
│   ├── dist/                 # Production build assets (served by FastAPI)
│   └── src/
│       ├── App.tsx           # Main application root with tab navigation & layout
│       ├── api.ts            # Typed Axios API client
│       ├── types.ts          # Frontend TypeScript interface definitions
│       ├── main.tsx          # React DOM render entrypoint
│       └── components/       # UI components (Flashcards, Lessons, Quiz, ProfileModal, etc.)
├── pyproject.toml            # Python build configuration and dependencies
├── requirements.txt          # Python dependencies for pip / uv installation
└── tests/                    # Comprehensive automated test suite
    ├── conftest.py           # Shared pytest fixtures, test database, and mock users
    ├── unit/                 # Unit tests (SM-2 algorithm, models, password hashing)
    ├── integration/          # API integration tests (Auth, Words, Lessons, Quizzes, Profiles)
    ├── mobile/               # Playwright mobile viewport end-to-end browser tests
    └── screenshots/          # Baseline mobile UI layout screenshots
```

---

## 💻 Prerequisites (macOS & Linux)

Ensure you have the following installed on your machine:

1. **Python 3.11+**
   - *macOS (Homebrew):*
     ```bash
     brew install python@3.11
     ```
2. **Node.js 18+ & npm**
   - *macOS (Homebrew / nvm):*
     ```bash
     brew install node
     # Or using nvm:
     nvm install 20 && nvm use 20
     ```
3. **Virtual Environment Manager (`uv` or `venv`)**
   - *Recommended (`uv`):*
     ```bash
     brew install uv
     # Or via curl:
     curl -LsSf https://astral.sh/uv/install.sh | sh
     ```

---

## 🚀 Quickstart & Local Setup

### 1. Clone Repository

```bash
git clone https://github.com/mryab/lang-learn.git
cd lang-learn
```

---

### 2. Backend Setup

You can set up the Python environment using either `uv` (recommended) or standard `python3 -m venv`.

#### Option A: Using `uv` (Fastest)

```bash
# Create virtual environment
uv venv .venv

# Activate virtual environment
source .venv/bin/activate

# Install dependencies
uv pip install -r requirements.txt
# Alternatively: uv pip install -e ".[dev]"
```

#### Option B: Using standard `venv`

```bash
# Create virtual environment
python3 -m venv .venv

# Activate virtual environment
source .venv/bin/activate

# Upgrade pip and install dependencies
pip install --upgrade pip
pip install -r requirements.txt
# Alternatively: pip install -e ".[dev]"
```

#### Configure Environment Variables

```bash
# Copy the example environment file
cp .env.example .env
```

Open `.env` in your editor and optionally configure your LLM provider key:
```env
# Example using Nous Research Portal (Gemini 3.7 Flash):
NOUS_API_KEY=your_actual_api_key_here
LLM_BASE_URL=https://inference-api.nousresearch.com/v1
LLM_MODEL=google/gemini-3.7-flash

# Default SQLite database path (created automatically in project root):
DATABASE_URL=sqlite:///./lang_learn.db
```

*(Note: SQLite database tables and seed languages are automatically initialized when the backend starts.)*

---

### 3. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

---

### 4. Running Backend Server

From the project root (with `.venv` activated):

```bash
uvicorn app.main:app --reload --port 8080
```

- **Backend API:** `http://127.0.0.1:8080`
- **Interactive Swagger Docs:** `http://127.0.0.1:8080/docs`
- **Alternative ReDoc:** `http://127.0.0.1:8080/redoc`

---

### 5. Running Frontend Web App

You can run the frontend in two ways:

#### Option A: Vite Development Server (Hot-Reloading)

```bash
cd frontend
npm run dev
```

- **Web App URL:** `http://localhost:5173`
- The Vite dev server automatically proxies `/api` requests to `http://127.0.0.1:8080` (or `http://127.0.0.1:8000`).

#### Option B: Production Build Served directly by FastAPI

```bash
# Build production bundle into frontend/dist
cd frontend
npm run build
cd ..

# Start FastAPI backend (serves frontend/dist automatically on root '/')
uvicorn app.main:app --reload --port 8080
```

- **Full Application URL:** `http://127.0.0.1:8080`

---

## 🧪 Running Tests

The test suite includes unit tests, API integration tests, and Playwright end-to-end mobile tests.

Activate your virtual environment before running tests:
```bash
source .venv/bin/activate
```

### 1. Run Full Test Suite

```bash
pytest -v
```

### 2. Run Specific Test Suites

```bash
# Run unit tests only
pytest tests/unit -v

# Run API integration tests only
pytest tests/integration -v

# Run Playwright mobile viewport E2E tests
pytest tests/mobile -v
```

*(Note: If running Playwright tests for the first time, install browser binaries with `playwright install chromium`)*

### 3. Run with Test Coverage

```bash
pytest --cov=app --cov-report=term-missing tests/
```

---

## 🔍 Debugging in VS Code

Pre-configured debug targets are included in `.vscode/launch.json`:

### Available Debug Configurations:

1. **FastAPI: Run App (Port 8080)** - Launches uvicorn with live reload and attaches the VS Code Python debugger (`debugpy`) with breakpoints enabled.
2. **FastAPI: Run App (Port 8000)** - Runs uvicorn on port 8000.
3. **Pytest: Current File** - Runs and debugs the currently active test file in VS Code.
4. **Pytest: All Tests** - Runs full pytest suite with debugger attached.
5. **Pytest: Playwright Mobile E2E** - Debugs Playwright mobile end-to-end tests.

### How to use in VS Code:
1. Open the project root folder in VS Code: `code .`
2. Press `Cmd + Shift + P` (or `Ctrl + Shift + P`), type `Python: Select Interpreter`, and choose `./.venv/bin/python`.
3. Open the **Run and Debug** view (`Cmd + Shift + D` or `Ctrl + Shift + D`).
4. Select `FastAPI: Run App (Port 8080)` and press `F5` (or the green play button).
5. Set breakpoints anywhere in `app/` or `tests/`.

---

## ⚙️ Environment Configuration Reference

| Variable | Description | Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | SQLAlchemy connection string | `sqlite:///./lang_learn.db` |
| `SECRET_KEY` | Secret key for signing JWT tokens | `development-secret-key...` |
| `ALGORITHM` | JWT signing algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration duration in minutes | `10080` (7 days) |
| `NOUS_API_KEY` | Nous Portal API key | `""` |
| `LLM_API_KEY` | Generic LLM provider API key | `""` |
| `OPENAI_API_KEY` | OpenAI API key | `""` |
| `LLM_BASE_URL` | Base URL for LLM API | `https://inference-api.nousresearch.com/v1` |
| `LLM_MODEL` | LLM model identifier | `google/gemini-3.7-flash` |
| `LOG_DIR` | Directory for application logs | `logs` |
| `LOG_LEVEL` | Application logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) | `INFO` |
| `LOG_BACKUP_DAYS` | Daily log file retention limit | `7` |
| `LOG_FILE_NAME` | Log file base name | `app.log` |
| `VITE_BACKEND_PORT` | Optional backend port override for Vite proxy | `8080` |
| `VITE_BACKEND_URL` | Optional backend URL override for Vite proxy | `http://127.0.0.1:8080` |

