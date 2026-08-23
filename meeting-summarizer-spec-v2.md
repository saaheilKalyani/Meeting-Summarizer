# Meeting Summarizer — Implementation-Ready Spec (v2, aligned to official brief)

This version is built directly against the two documents you shared: the **Assignment Submission Usage Guidelines** and the **Meeting Summarizer** assignment brief. Where my earlier draft assumed extra polish (speaker diarization, a third-party ASR provider, SDK dependencies), this version treats the official brief as the source of truth and clearly separates **required** from **bonus, for the job-application angle**.

## Requirement compliance map

| Official requirement | How this spec satisfies it |
|---|---|
| Input: meeting audio files | Upload endpoint accepts mp3/wav/m4a/webm |
| Output: transcript + summary + action items | All three produced and rendered; key decisions included too (explicitly named in the brief's own LLM prompt example) |
| Optional frontend to upload & view | Built — one animated page, exceeds the "optional" bar for the job-impression goal you mentioned |
| ASR: Google / Azure / OpenAI Whisper / etc. | **OpenAI Whisper**, explicitly named in the brief |
| Backend to store & process data | Express + JSON file storage (`data/meetings.json`) |
| LLM for summary generation | Gemini, called via raw REST `fetch` (no SDK) |
| No extra modules / native whenever possible | Only 2 npm packages total: `express`, `multer`. No ASR/LLM SDK, no dotenv (uses Node's native `--env-file`) |
| No `node_modules`, `.env`, build artifacts, editor folders in repo | `.gitignore` provided below |
| Public GitHub repo, `main` branch, downloadable | Standard repo, no LFS, no large binaries checked in |
| Deliverables: GitHub repo + README + demo video | README outline in section 6; demo notes included |
| Evaluation: transcription accuracy, summary quality, prompt effectiveness, code structure | Addressed directly in ASR/LLM choices and file structure below |

**Bonus, not required by the brief:** speaker-turn labels ("Speaker 1", "Speaker 2") and the animated one-page UI. I kept both because they're what will actually make the submission stand out in a placement round, but they're built so that removing either doesn't break anything required — flagged inline below.

---

## Simplicity decisions

1. **One process, one command.** Express serves the frontend as static files. `npm install && npm start` → `http://localhost:3000`. No build tool, no WSL, no Docker.
2. **No frontend build step.** Plain HTML/CSS/JS, animations via GSAP from a CDN `<script>` tag. Zero `node_modules` on the frontend.
3. **Two backend dependencies, period.** `express` (server) and `multer` (multipart file upload — there's no clean native alternative for this). Both Whisper and Gemini are called with Node's built-in `fetch`, so no `openai` or `@google/generative-ai` packages. Env vars are loaded with Node's native `--env-file=.env` flag (Node 20.6+) instead of `dotenv`.
   - *If your Node version is older than 20.6*, add `dotenv` as a third dependency — it's small and standard enough that a grader won't blink, but native is preferred if you have it.
4. **Speaker labels are a heuristic, not real diarization**, and the README says so explicitly (see section 6). Whisper doesn't diarize. The approximation: request word-level timestamps (`timestamp_granularities: ["word"]`), and start a new speaker turn whenever the gap between two consecutive words exceeds ~1.2 seconds, alternating "Speaker 1" / "Speaker 2". This is honest, simple, and good enough for a single-provider, dependency-free solution — call it out as a known limitation rather than oversell it.

---

## 1. System Overview

```
┌─────────────┐   POST /api/meetings (multipart audio)   ┌──────────────────┐
│   Browser    │ ────────────────────────────────────────▶│  Express server   │
│ (index.html) │                                            │  (single process) │
└─────────────┘◀──────────────────────────────────────────└──────────────────┘
      ▲                     JSON: transcript + summary +            │  │
      │                     decisions + action items                │  │
      │                                                              │  │
      │                                          1. save audio ──────┘  │
      │                                          2. fetch() → Whisper API ──▶ OpenAI Whisper
      │                                             (verbose_json, word     │  (transcription,
      │                                              timestamps)            │   word timestamps)
      │                                          3. heuristic speaker split │
      │                                          4. fetch() → Gemini API ───┼──▶ Gemini REST
      │                                             (summary/decisions/     │   (structured JSON out)
      │                                              actions as JSON)       │
      │                                          5. write data/meetings.json
      │                                          6. respond to browser
      │
      └── GET /api/meetings , GET /api/meetings/:id  (for "Past meetings")
```

---

## 2. Frontend UI/UX Design

*(Unchanged from the polish goal — this is the "optional frontend" the brief allows, built to impress reviewers. If you're short on time, cut "Past meetings" first — it's the least essential piece.)*

**Palette:** background `#0A0E17`, surface `#131826`, primary `#6366F1` (indigo), accent `#22D3EE` (cyan), success `#34D399` (decisions), warning `#FBBF24` (action items), text `#F1F5F9` / `#94A3B8`.
**Type:** Space Grotesk (headings), Inter (body/transcript), both via Google Fonts CDN.

**Hero** — full-height, blurred gradient blobs drifting via CSS keyframes, headline "Turn Meetings into Clear Summaries & Actions" revealed word-by-word with GSAP stagger, CTA with a slow pulsing glow.

**Upload** — dashed-border card, drag-over state (border/tint shift, 150ms CSS transition), selected-file preview slides in, invalid-file shake+red flash.

**Processing** — animated equalizer bars, status text cycles "Uploading…" → "Transcribing…" → "Splitting speaker turns…" → "Summarizing…" (client-side staged text while the one real request is in flight — not a real progress feed, noted as an intentional simplification).

**Results** — transcript panel (speaker avatar + `mm:ss` timestamp + line, alternating row tint), Summary card (indigo accent stripe), Key Decisions (emerald, checkmarks), Action Items (amber, most visually distinct — this is what a reviewer will screenshot). Section fades/slides in, children stagger via `IntersectionObserver` + GSAP.

**Past meetings (optional)** — horizontal card row, click re-renders results from `GET /api/meetings/:id`, no navigation.

**Micro-interactions:** button hover scale 1.03 + glow, card hover lift, visible focus rings (`outline: 2px solid #22D3EE`), and everything ambient/looping respects `prefers-reduced-motion`.

---

## 3. Frontend Implementation Spec

**Plain HTML + CSS + vanilla JS, GSAP via CDN. No React, no Vite.**

```
frontend/
├── index.html          # entire single page
├── css/
│   ├── style.css
│   └── animations.css
└── js/
    ├── main.js          # state object + orchestration
    ├── upload.js         # drag/drop + validation
    ├── api.js             # fetch() wrappers for the 3 endpoints
    ├── render.js           # DOM rendering for results
    ├── pastMeetings.js     # optional past-meetings row
    └── animations.js       # GSAP timelines + ScrollTrigger
```

State: one plain object (`status`, `file`, `result`, `pastMeetings`, `errorMessage`) in `main.js`, re-rendered by a single `render()` call on each transition — no framework needed at this scale.

---

## 4. Backend Design

```
backend/
├── server.js                    # static-serves ../frontend, mounts /api, loads env
├── routes/
│   └── meetings.js               # POST /api/meetings, GET /api/meetings, GET /api/meetings/:id
├── services/
│   ├── transcriptionService.js   # fetch() → Whisper, then heuristic speaker-turn split
│   ├── summaryService.js         # fetch() → Gemini, build prompt, parse structured JSON
│   └── storageService.js         # read/write data/meetings.json, save audio to uploads/
├── middleware/
│   ├── upload.js                  # multer: mimetype + size validation
│   └── errorHandler.js            # centralized error → { error: message } JSON
├── data/meetings.json             # created at first run
├── uploads/                        # created at first run
├── .env.example
├── package.json                    # dependencies: express, multer (that's it)
└── .gitignore
```

### API endpoints

**`POST /api/meetings`** — `multipart/form-data`, field `audio` (mp3/wav/m4a/webm, ≤ `MAX_UPLOAD_MB`).

Success `200`:
```json
{
  "id": "b3f1...",
  "title": "Meeting on Aug 22, 2026",
  "createdAt": "2026-08-22T10:15:00.000Z",
  "durationSec": 812,
  "transcript": [
    { "speaker": "Speaker 1", "start": 0, "end": 4200, "text": "Let's start with the roadmap." }
  ],
  "summary": "The team reviewed Q3 roadmap priorities and agreed to...",
  "decisions": ["Ship the billing redesign before the Q4 freeze"],
  "actionItems": [
    { "owner": "Priya", "task": "Draft the migration doc", "dueDate": "2026-08-29" }
  ]
}
```
Errors: `400` (missing/invalid/too-large file), `502` (Whisper failure), `502` (Gemini failure or malformed JSON), `500` (unexpected).

**`GET /api/meetings`** → `[{ id, title, createdAt, durationSec }]`.
**`GET /api/meetings/:id`** → full object or `404`.

### ASR integration — Groq Whisper, no SDK

```js
// transcriptionService.js (sketch)
const form = new FormData();
form.append('file', new Blob([audioBuffer]), filename);
form.append('model', process.env.GROQ_MODEL || 'whisper-large-v3');
form.append('response_format', 'verbose_json');
form.append('timestamp_granularities[]', 'word');

const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
  method: 'POST',
  headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  body: form,
});
const { words, duration } = await res.json();
// heuristic: new speaker whenever gap between word.end and next word.start > 1.2s
```

Groq's endpoint is OpenAI-compatible in request shape, and `response_format: 'verbose_json'` + `timestamp_granularities[]: 'word'` is the same combination OpenAI requires for word-level timestamps. The response shape above (`words: [{ word, start, end }]` plus a top-level `duration`) is assumed to match OpenAI's, per Groq's docs — but this hasn't been confirmed against a real Groq response yet (no key to test with), so verify it during the first real end-to-end run rather than trusting it permanently.

This uses Node 18+'s global `fetch`/`FormData`/`Blob` — zero dependencies for the ASR call itself. The heuristic speaker split is a plain function over the `words` array, alternating "Speaker 1"/"Speaker 2" labels — clearly documented in the README as an approximation, not true diarization.

### LLM integration — Gemini, no SDK

```js
// summaryService.js (sketch)
const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ parts: [{ text: transcriptAsText }] }],
      generationConfig: { responseMimeType: 'application/json' },
    }),
  }
);
```
Check `https://ai.google.dev/gemini-api/docs/models` for the current fast-tier model name at build time (`MODEL` above) — exact names change, so don't hardcode one from memory.

**System prompt:**
```
You are an assistant that extracts structured information from meeting transcripts.
Respond with ONLY valid JSON, no prose, no markdown fences, matching this shape:
{
  "summary": string,
  "decisions": string[],
  "actionItems": [ { "owner": string | null, "task": string, "dueDate": string | null } ]
}
Only include a decision or action item if the transcript clearly supports it. Do not invent names or dates.
```

**User content:** the speaker-labeled transcript, e.g.:
```
Speaker 1 [00:00]: Let's start with the roadmap.
Speaker 2 [00:04]: Sure, I think we should prioritize billing.
...
Extract the summary, decisions, and action items as JSON per the schema above.
```

### Storage
`data/meetings.json` — single JSON array, read-modify-write on each successful transcription. Audio saved to `uploads/<id>.<ext>` for reference, not re-served.

### Error handling
Typed errors (`ValidationError`, `TranscriptionError`, `SummaryGenerationError`) → `errorHandler.js` maps to status codes → always `{ "error": "message" }`, surfaced directly in the frontend's error banner.

---

## 5. `.env` and Configuration

| Variable | Purpose |
|---|---|
| `PORT` | Express port (serves frontend + API) |
| `GROQ_API_KEY` | Groq Whisper transcription |
| `GROQ_MODEL` | Groq Whisper model name (defaults to `whisper-large-v3`) |
| `GEMINI_API_KEY` | summary/decisions/action-item generation |
| `GEMINI_MODEL` | Gemini model name (defaults to `gemini-2.5-flash`) |
| `MAX_UPLOAD_MB` | multer file-size limit |

**`.env.example`:**
```
PORT=3000
GROQ_API_KEY=your_groq_key_here
# Swap to whisper-large-v3-turbo for lower cost/latency at a small accuracy tradeoff.
GROQ_MODEL=whisper-large-v3
GEMINI_API_KEY=your_gemini_key_here
# Verify this is current at https://ai.google.dev/gemini-api/docs/models before relying on it.
GEMINI_MODEL=gemini-2.5-flash
# Matches Groq's free-tier file size cap. Raise this back up if you're on
# their paid dev tier (100MB cap).
MAX_UPLOAD_MB=25
```

**`package.json` (backend) — start script for native env loading:**
```json
{
  "scripts": { "start": "node --env-file=.env server.js" },
  "dependencies": { "express": "^4.19.0", "multer": "^1.4.5-lts.1" }
}
```

**`.gitignore` (repo root):**
```
node_modules/
.env
dist/
.next/
out/
.vscode/
.idea/
backend/data/meetings.json
backend/uploads/
```

---

## 6. README Outline

```
# Meeting Summarizer

## Features
- audio upload → transcript, speaker turns (heuristic), summary, decisions, action items

## Tech Stack
- Frontend: HTML/CSS/JS, GSAP (no build step)
- Backend: Node.js, Express, multer only
- ASR: OpenAI Whisper (raw REST via fetch)
- LLM: Google Gemini (raw REST via fetch)

## Architecture Overview
(paragraph + diagram from Section 1)

## Known Limitations
- Speaker labels are a pause-based heuristic, not true diarization — good enough to
  distinguish turns in a small meeting, not guaranteed to correctly re-identify a
  speaker who returns after someone else talks. A dedicated diarization service is
  the natural next step.

## Setup Instructions
1. cd backend && npm install
2. cp .env.example .env, fill in OPENAI_API_KEY and GEMINI_API_KEY
3. npm start
4. open http://localhost:3000 — frontend is served automatically, nothing separate to run

## API Documentation
(endpoint table from Section 4)

## LLM Prompt Example
(system + user prompt from Section 4)

## Demo Notes
- upload a short sample clip, narrate the processing animation, scroll through
  transcript/summary/decisions/actions, click a past meeting

## Future Improvements
- real diarization service instead of the pause heuristic
- SSE-based real progress instead of staged client-side text
- export to PDF/Markdown
```

---

## 7. Implementation Plan (15 steps)

1. Scaffold `backend/` and `frontend/` per the file trees above, add `.gitignore` at the repo root.
2. `npm init` in `backend/`, install only `express` and `multer`.
3. Write `server.js`: static-serve `../frontend`, mount `/api`, `errorHandler.js` last.
4. Write `middleware/upload.js` (multer disk storage, type/size checks from env).
5. Write `services/storageService.js` (read/write `data/meetings.json`).
6. Write `services/transcriptionService.js`: `fetch()` to Whisper with `timestamp_granularities: ["word"]`, then the pause-based speaker-split heuristic.
7. Write `services/summaryService.js`: build the exact prompt above, `fetch()` to Gemini, `JSON.parse` with try/catch.
8. Write `routes/meetings.js` wiring the three endpoints to the services.
9. Create `.env` from `.env.example`, add your real keys.
10. Build `frontend/index.html` skeleton (hero, upload, processing, results, past-meetings).
11. Write `css/style.css` then `css/animations.css`.
12. Write `js/upload.js` and `js/api.js`.
13. Write `js/render.js` and `js/pastMeetings.js`.
14. Write `js/animations.js` (GSAP + ScrollTrigger), wire it all in `js/main.js`.
15. `npm start`, test end-to-end with a real short clip, confirm no extra files are staged for git (`git status` against the `.gitignore`), then record the demo video.
