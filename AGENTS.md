# Repository Overview & Architecture Guide (Memory)

This file serves as a persistent guide and memory map for the `lang-learn` repository. Update this file when there are updates to the file structure or functionality.

## 0. Collaboration Mode
- **Role**: Consultative / Pair-programming mentor.
- **Workflow**: Provide hints, architectural explanations, code references, schemas, and documentation. Let the user implement changes themselves unless explicitly asked to modify a file.

---

## 1. Project Summary & Tech Stack

- **Application**: Language Learning Web App with LLM-powered vocabulary generation, lessons, and Spaced Repetition System (SRS).
- **Backend**:
  - Python 3.12+ / FastAPI / SQLAlchemy / SQLite (`lang_learn.db`) / Alembic migrations.
  - LLM providers: OpenAI & Mock provider for local development/testing (`app/services/llm`).
  - Background processing: Custom in-process async `JobQueueService` and `SchedulerService`.
- **Frontend**:
  - Vite + React + TypeScript.
  - Vanilla CSS (`frontend/src/style.css`) with responsive design, glassmorphism, dark theme, and mobile dock.
  - Single-page application consuming FastAPI `/api/v1` REST endpoints.

---

## 2. Directory Structure & Key Files

```
lang-learn/
├── app/                        # Backend FastAPI application
│   ├── main.py                 # FastAPI app entry point, lifespan, CORS, middleware, static mounting
│   ├── config.py               # Pydantic BaseSettings (DB URL, OpenAI keys, auth secret, logs)
│   ├── database.py             # SQLAlchemy engine, session management, SQLite pragmatic setups
│   ├── logging_config.py       # Custom logging setup, RequestLoggingMiddleware, log rotation/cleanup
│   ├── api/                    # REST API routes
│   │   └── v1/
│   │       ├── api.py          # Merges all v1 routers
│   │       ├── auth.py         # Registration, login, JWT token issuing
│   │       ├── users.py        # User profile endpoints
│   │       ├── profiles.py     # Language learning profile management
│   │       ├── languages.py    # Supported languages endpoints
│   │       ├── lessons.py      # Lesson generation, list, detail, submissions
│   │       ├── words.py        # Words and vocabulary retrieval
│   │       ├── review.py       # SRS review sessions & submissions
│   │       └── jobs.py         # Async job status & queue polling
│   ├── auth/                   # Authentication & security
│   │   ├── security.py         # Password hashing (bcrypt) & JWT encode/decode
│   │   └── dependencies.py     # FastAPI dependencies (get_current_user)
│   ├── crud/                   # Database CRUD operations
│   │   ├── user.py             # User DB queries
│   │   ├── language.py         # Language seeding and queries
│   │   ├── lesson.py           # Lesson DB operations
│   │   ├── word.py             # Word & vocabulary operations
│   │   ├── word_association.py # Word-to-lesson associations
│   │   ├── stats.py            # User SRS statistics & word mastery
│   │   └── job.py              # Background job tracking records
│   ├── models/                 # SQLAlchemy ORM models
│   │   ├── base.py             # Declarative base & TimestampMixin
│   │   ├── user.py             # User model
│   │   ├── learning_profile.py # User learning profiles (source/target language)
│   │   ├── language.py         # Supported languages
│   │   ├── lesson.py           # Lesson records & generated content
│   │   ├── word.py             # Word & translation dictionary
│   │   ├── lesson_word.py      # Many-to-many join model for lessons and words
│   │   ├── word_association.py # Associations / mnemonics / examples
│   │   ├── user_word_stats.py  # SRS repetition data (ease factor, interval, review dates)
│   │   └── job.py              # Async job tracking model
│   ├── schemas/                # Pydantic schemas for request/response validation
│   │   ├── auth.py, user.py, profile.py, language.py, lesson.py, word.py, review.py, job.py
│   │   └── word_association.py
│   ├── services/               # Core business logic services
│   │   ├── job_queue.py        # In-process asynchronous job queue
│   │   ├── scheduler.py        # Background periodic job scheduler
│   │   ├── word_service.py     # Vocabulary extraction & translation logic
│   │   ├── review_service.py   # SRS session builder & review processing
│   │   └── llm/                # LLM integration layer
│   │       ├── base.py         # BaseLLMProvider interface
│   │       ├── factory.py      # Provider factory (OpenAI vs Mock)
│   │       ├── openai_provider.py # Real OpenAI API provider
│   │       └── mock_provider.py   # Mock provider for offline testing
│   └── srs/                    # Spaced Repetition System logic
│       ├── engine.py           # SM-2 algorithmic interval & ease factor calculation
│       └── models.py           # SRS domain models / calculation helpers
├── frontend/                   # Frontend React + TypeScript application
│   ├── index.html              # HTML shell
│   ├── vite.config.ts          # Vite build config with proxy to backend /api
│   ├── package.json            # NPM scripts & dependencies (lucide-react, react, react-dom, etc.)
│   └── src/
│       ├── main.tsx            # React DOM mounting
│       ├── App.tsx             # Main application orchestrator & view router
│       ├── api.ts              # API client for backend REST endpoints
│       ├── types.ts            # TypeScript interfaces matching backend schemas
│       ├── style.css           # Global stylesheets, responsive layout, animations, theme tokens
│       ├── components/         # React UI components
│       │   ├── Header.tsx           # Top navigation bar & user status
│       │   ├── BottomDock.tsx       # Mobile bottom navigation dock
│       │   ├── BurgerMenu.tsx       # Slide-out drawer menu
│       │   ├── AuthView.tsx         # Login / Registration views
│       │   ├── ProfileSwitcher.tsx  # Language profile selection & modal
│       │   ├── LessonsView.tsx      # Lesson generator form & lesson list
│       │   ├── LessonItem.tsx       # Individual lesson card summary
│       │   ├── LessonDetailView.tsx # Interactive lesson exercises, reading, submit logic
│       │   ├── FlashcardsView.tsx   # SRS flashcard interactive review player
│       │   ├── WordlistView.tsx     # Dictionary / word list overview
│       │   ├── WordItem.tsx         # Word item card with mastery score & associations
│       │   └── SettingsView.tsx     # App settings & preferences
│       └── utils/              # Helper utilities
├── alembic/                    # Database migration scripts
│   ├── env.py
│   └── versions/               # Version migration files
├── tests/                      # Automated test suite
│   ├── conftest.py             # Pytest fixtures and mock DB setups
│   ├── unit/                   # Unit tests (SRS engine, LLM parser, CRUD)
│   ├── integration/            # API endpoint integration tests
│   └── mobile/                 # Mobile / viewport responsiveness tests
├── logs/                       # Rotating application logs
├── lang_learn.db               # Local SQLite database file
├── alembic.ini                 # Alembic configuration
├── pyproject.toml / uv.lock    # Python dependencies & tooling config
└── README.md                   # Detailed setup, development, and architecture documentation
```

---

## 3. Key Workflows & Component Interactions

1. **Authentication & Profile Management**:
   - `AuthView.tsx` -> `/api/v1/auth/login` (JWT stored in `localStorage`).
   - `ProfileSwitcher.tsx` -> `/api/v1/profiles` (controls active target and native languages).

2. **Lesson Generation & Practice**:
   - `LessonsView.tsx` triggers lesson generation -> `/api/v1/lessons/generate`.
   - `JobQueueService` coordinates with `LLMProvider` (`OpenAIProvider` or `MockProvider`) to generate story, dialogue, and exercises.
   - `LessonDetailView.tsx` renders interactive reading, comprehension questions, and vocabulary items with instant answer validation.

3. **Spaced Repetition & Vocabulary Review**:
   - `FlashcardsView.tsx` loads due cards from `/api/v1/review/session`.
   - Card reviews submit ease ratings (1-5) -> `SRSEngine` updates `UserWordStats` (ease factor, interval, next review timestamp).
