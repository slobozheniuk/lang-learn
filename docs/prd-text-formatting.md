# PRD: Natural Text Formatting for Interactive Reading View

## Problem Statement

The **Interactive Reading** mode (`LessonDetailView.tsx`) renders a flat stream of `<span>` elements
produced by the spaCy NLP service. Although spaCy preserves newlines as whitespace-only gap chunks,
the visual result collapses multi-paragraph prose into a wall of words — no paragraph breaks,
no proper sentence spacing, no visual breathing room.

---

## Full Pipeline Reference

```
User input text (raw_input stored on Lesson)
      │
      ▼
POST /api/v1/lessons/chunk-text
      │
      ▼
SpacyNLPService._spacy_chunks()
  ├── Word/punct tokens  → LLMChunkItem(is_selectable=True/False, lemma, pos, …)
  └── Whitespace gaps    → LLMChunkItem(is_selectable=False, text=" " / "\n" / "\n\n")
      │
      ▼
LLMChunkResponse { chunks: LLMChunkItem[], raw_text }
      │
      ▼
Frontend: chunk_data stored; chunks[] rendered as flat <span> stream
```

**Root cause**: spaCy *already preserves* newline characters in non-selectable gap chunks.
The problem is purely in the **rendering layer** — whitespace chunks emit `<span>` elements
whose newline text content gets collapsed by browser inline formatting rules.

---

## Options

### Option A — CSS + `<br>` Rendering (Immediate Fix) ✅ Implemented

**Approach**: Detect whitespace-only gap chunks that contain `\n` and render them as `<br>` or
paragraph `<div>`/`<p>` separators instead of plain `<span>` elements.

**Changes**:
- `LessonDetailView.tsx`: update the `chunks.map()` renderer to:
  - Double-newline (`\n\n`) → render a `<div className="reading-paragraph-break">` spacer
  - Single-newline (`\n`) → render a `<br>` element
  - Space-only gap → keep as plain `<span>`
- `style.css`: ensure `white-space: pre-wrap` on `.reading-text-flow` (already present);
  add `.reading-paragraph-break` margin rule.

**Pros**: Zero backend changes, zero latency, works with existing spaCy output.  
**Cons**: Relies on the raw input text having meaningful newlines. Single-paragraph blobs still render flat.

---

### Option B — `break_type` Field in `LLMChunkItem`

**Approach**: Extend the `LLMChunkItem` schema with a structured `break_type` field
(`"paragraph"`, `"line"`, or `null`) populated by the spaCy service from whitespace gap analysis.

**Changes**:
- `app/services/llm/base.py`: add `break_type: str | None` to `LLMChunkItem`
- `app/services/nlp.py`: set `break_type` on gap chunks based on `\n` / `\n\n` content
- `app/schemas/lesson.py`: mirror `break_type` in `ChunkItemSchema`
- Frontend: consume `break_type` for structured `<br>` / `<p>` rendering

**Pros**: Schema-level, clean, no fragile string scanning in frontend.  
**Cons**: Schema migration; stored `chunk_data` in existing lessons won't have the field.

---

### Option C — LLM-Assisted Text Pre-formatting

**Approach**: Before chunking, send `raw_input` to the LLM with a formatting prompt asking it
to add natural paragraph breaks and punctuation — then chunk the *formatted* text.

**Trigger condition**: `'\n' not in raw_input and word_count > 80`

**Prompt sketch**:
```
Re-format the following text with natural paragraph breaks and punctuation.
Do NOT translate, change wording, or add content. Return ONLY the formatted text.

Input:
{raw_text}
```

**Integration point**: `chunk_text_endpoint` in `app/api/v1/lessons.py` or inside
`nlp_service.chunk_text()` as an optional pre-format step via `llm.complete()`.

**Pros**: Works for single-paragraph blobs; produces human-quality layout; no frontend changes.  
**Cons**: Extra LLM call (+0.5–2s latency + token cost); LLM may silently modify wording.

---

### Option D — Client-Side Sentence Segmentation Library

**Approach**: Use a JS/TS library on the frontend to detect sentence boundaries from `raw_text`
and inject `<br>` / `<p>` tags into the chunk stream accordingly.

**Candidate libraries**:

| Library | Size | Languages | Notes |
|---|---|---|---|
| `wink-nlp` | ~150kB | en only | Fast tokeniser |
| `compromise` | ~160kB | en only | Good sentence splitting |
| Custom regex | 0kB | heuristic | Handles `.!?` + `\n` patterns |

**Pros**: No backend change, instant.  
**Cons**: Multi-lingual apps (en, nl, de, fr, …) not well supported by existing JS NLP libs.
A custom regex is the only realistic cross-language option.

---

## Decision

| Option | Effort | Latency | Covers no-newline inputs | Multilingual |
|---|---|---|---|---|
| A (CSS + `<br>`) | ~15 min | none | ❌ | ✅ |
| B (break_type) | ~1–2 h | none | ❌ | ✅ |
| C (LLM reformat) | ~3 h | +1–2s | ✅ | ✅ |
| D (JS NLP) | ~1 h | none | partial | ❌ |

**Recommended order**: A → B → C (if needed for unstructured input)

Option A is implemented first (see implementation notes below).
Options B and C remain as future backlog items.

---

## Implementation Notes: Option A

### `LessonDetailView.tsx` — chunk renderer update

Replace the non-selectable branch in `chunks.map()`:

```tsx
if (!isSelectable) {
  const text = chunk.text;

  // Double newline → paragraph break (visual spacer)
  if (/\n\s*\n/.test(text)) {
    return <div key={idx} id={`chunk-${idx}`} className="reading-paragraph-break" />;
  }
  // Single newline → line break
  if (/\n/.test(text)) {
    return <br key={idx} id={`chunk-${idx}`} />;
  }
  // Ordinary whitespace span
  return (
    <span key={idx} id={`chunk-${idx}`} className="reading-chunk-plain">
      {text}
    </span>
  );
}
```

### `style.css` — paragraph break spacer

```css
.reading-paragraph-break {
  display: block;
  height: 0.9em;   /* visual paragraph gap */
}
```

`.reading-text-flow` already has `white-space: pre-wrap` — no change needed there.
