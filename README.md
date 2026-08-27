# LangLearn 🌐

An extensible, multimodal language learning platform designed to generate personalized, interactive, Duolingo-style micro-lessons from arbitrary inputs (raw text, YouTube URLs, and photos/OCR) with integrated Spaced Repetition (SM-2).

---

## 🚀 Features

- **Spaced Repetition System (SM-2):** Algorithmic flashcard review engine with a 4-button response model (*Again, Hard, Good, Easy*).
- **TWA-Inspired UI:** Modern, clean frontend shell leveraging Telegram Web App CSS design tokens with full light/dark mode support.
- **Interactive Flashcards:** 3D flip card review interface with pronunciation, part-of-speech, and context clues.
- **Multilingual Support:** Seeded for Russian (`ru`), English (`en`), and Dutch (`nl`), built with an extensible $(L_{source}, L_{target})$ graph.
- **Lesson Pipeline:** Asynchronous lesson creation with visual state indication (spinning rainbow gradient).

---

## 🛠 Tech Stack

- **Backend:** Python 3.11, FastAPI, SQLAlchemy 2.0, Pydantic v2, SQLite, Pytest, Alembic
- **Frontend:** React 19, Vite, TypeScript, Zustand, Axios, Vitest, React Testing Library

---

## 📦 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+ & npm

### Backend Setup
```bash
cd lang-learn
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Run database migrations
alembic upgrade head

# Start API server
uvicorn app.main:app --reload --port 8000
```
Open API documentation at `http://localhost:8000/docs`.

### Frontend Setup
```bash
cd lang-learn/frontend
npm install
npm run dev
```
Open the web app at `http://localhost:5173`.

---

## 🧪 Testing

### Backend Tests
```bash
pytest -v
```

### Frontend Tests
```bash
cd frontend
npm test
```
