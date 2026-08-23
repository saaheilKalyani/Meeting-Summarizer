# Meeting Summarizer

Upload a meeting recording and get back a transcript, a summary, key decisions, and action items — automatically.

## Features

- Upload an audio recording (`mp3`, `wav`, `m4a`, `webm`) and get a full transcript, a concise summary, key decisions, and action items.
- Transcript is split into speaker turns and labeled "Speaker 1" / "Speaker 2" (see [Known Limitations](#known-limitations) — this is a heuristic, not real diarization).
- Past meetings row: previously processed meetings are listed and clickable, reloading their results without re-processing.
- Single animated one-page frontend (hero, upload, processing, results, past meetings) — no build step, no framework.

## Tech Stack

- **Frontend**: plain HTML/CSS/JS, no bundler, no framework. [GSAP 3.15.0](https://gsap.com) + ScrollTrigger via the jsDelivr CDN, Space Grotesk + Inter via the Google Fonts CDN.
- **Backend**: Node.js (built and tested on v24), Express, multer — the only two npm dependencies. Pinned in `backend/package.json` as `express@^4.19.0` and `multer@^2.2.0`; currently resolving to `express@4.22.2` / `multer@2.2.0` per `package-lock.json`.
- **ASR**: OpenAI Whisper (`whisper-1`), called with Node's built-in `fetch`/`FormData`/`Blob` — no `openai` SDK.
- **LLM**: Google Gemini (`gemini-2.5-flash` by default, overridable), called with `fetch` — no `@google/generative-ai` SDK.
- **Storage**: a flat JSON file (`backend/data/meetings.json`), audio saved to `backend/uploads/`. Both are created automatically on first run and are git-ignored.

## Architecture Overview

One Express process does double duty: it serves the static frontend and exposes the `/api/meetings` API.

```
Browser (frontend/, static — served by Express itself)
   │
   │  POST /api/meetings  (multipart/form-data, field "audio")
   ▼
backend/server.js
   │
   ├─ middleware/upload.js            validates the file, saves it to uploads/<id>.<ext>
   ├─ services/transcriptionService.js
   │      fetch() ──▶ OpenAI Whisper (verbose_json, word-level timestamps)
   │      then a pause-based heuristic splits the words into speaker turns
   ├─ services/summaryService.js
   │      fetch() ──▶ Google Gemini (structured JSON output)
   └─ services/storageService.js      read/write backend/data/meetings.json

GET /api/meetings , GET /api/meetings/:id   →  power the "Past meetings" row
```

On the frontend, `frontend/js/main.js` is the orchestrator: it owns a small `idle | processing | done | error` state object and wires together `upload.js` (drag/drop + validation), `api.js` (the three fetch wrappers), `render.js` (populating the results DOM), `animations.js` (GSAP entrances/reveals), and `pastMeetings.js` (the past-meetings row). There's no module bundler — all six files are plain `<script defer>` tags sharing one global scope.

## Known Limitations

- **Speaker labels are a pause-based heuristic, not true diarization.** Whisper doesn't identify speakers. `transcriptionService.js` requests word-level timestamps and starts a new speaker turn whenever the gap between two consecutive words exceeds **1.2 seconds**, alternating "Speaker 1" / "Speaker 2". This reasonably approximates turn-taking in a small back-and-forth conversation, but it will mislabel speakers in a group call, and it can't recognize a speaker who returns after a pause shorter than 1.2s as the same person they were before. A dedicated diarization service is the natural next step.
- **The processing status text is a staged client-side illusion, not a real progress feed.** While the single `POST /api/meetings` request is in flight, `main.js` cycles the status text through four phases ("Uploading audio…" → "Transcribing speech…" → "Splitting speaker turns…" → "Summarizing…") on a `setInterval` every ~4 seconds. The backend does not report real progress at any point during the request — from the server's perspective it's one request that resolves or fails as a whole; the phase text is purely a client-side approximation of what's probably happening.

## Setup Instructions

Requires **Node.js 20.6+** (the start script uses Node's native `--env-file` flag instead of `dotenv`).

1. `cd backend && npm install`
2. `cp .env.example .env`, then fill in `OPENAI_API_KEY` and `GEMINI_API_KEY`
3. `npm start`
4. Open `http://localhost:3000` (or whatever `PORT` is set to) — the frontend is served automatically, nothing separate to run

### Environment variables (`backend/.env.example`)

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Express port (serves both the frontend and the API) | `3000` |
| `OPENAI_API_KEY` | Whisper transcription | — (required) |
| `GEMINI_API_KEY` | Summary / decisions / action-item generation | — (required) |
| `GEMINI_MODEL` | Gemini model name — verify it's still current at [ai.google.dev/gemini-api/docs/models](https://ai.google.dev/gemini-api/docs/models) before relying on the default | `gemini-2.5-flash` |
| `MAX_UPLOAD_MB` | multer's file-size limit | `50` |

## API Documentation

### `POST /api/meetings`

`multipart/form-data`, one field: `audio` (`.mp3` / `.wav` / `.m4a` / `.webm`, ≤ `MAX_UPLOAD_MB`).

Success — `200`:

```json
{
  "id": "b6f1c2a0-3e9d-4b7a-9c1e-2f8a6d4b0e7c",
  "title": "Meeting on August 22, 2026",
  "createdAt": "2026-08-22T10:15:00.000Z",
  "durationSec": 812,
  "transcript": [
    { "speaker": "Speaker 1", "start": 0, "end": 4200, "text": "Let's start with the roadmap." },
    { "speaker": "Speaker 2", "start": 5100, "end": 8300, "text": "Sure, I think we should prioritize billing." }
  ],
  "summary": "The team reviewed Q3 roadmap priorities and agreed to...",
  "decisions": ["Ship the billing redesign before the Q4 freeze"],
  "actionItems": [
    { "owner": "Priya", "task": "Draft the migration doc", "dueDate": "2026-08-29" },
    { "owner": null, "task": "Follow up on staging access", "dueDate": null }
  ]
}
```

`transcript[].start` / `.end` are milliseconds. `actionItems[].owner` / `.dueDate` are `null` when the transcript doesn't clearly support a value — the frontend omits those pills entirely rather than rendering them empty.

Errors — always `{ "error": "message" }`:

| Status | Cause |
|---|---|
| `400` | No file attached, unsupported file type, or file exceeds `MAX_UPLOAD_MB` |
| `502` | The Whisper or Gemini request failed, or Gemini returned malformed JSON |
| `500` | Unexpected server error |

### `GET /api/meetings`

Returns the list that powers the "Past meetings" row — `200`:

```json
[
  { "id": "b6f1c2a0-3e9d-4b7a-9c1e-2f8a6d4b0e7c", "title": "Meeting on August 22, 2026", "createdAt": "2026-08-22T10:15:00.000Z", "durationSec": 812 }
]
```

### `GET /api/meetings/:id`

Returns the full meeting object (same shape as the `POST` response) — `200`, or `404` with `{ "error": "Meeting not found." }`.

## LLM Prompt Example

The exact system prompt sent to Gemini (`backend/services/summaryService.js`), with `generationConfig.responseMimeType` set to `application/json`:

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

The user content is the speaker-labeled transcript followed by an explicit instruction, e.g.:

```
Speaker 1 [00:00]: Let's start with the roadmap.
Speaker 2 [00:05]: Sure, I think we should prioritize billing.

Extract the summary, decisions, and action items as JSON per the schema above.
```

## Demo Notes

1. Upload a short real recording and let it run through to a real result — this is the one thing that can't be faked, since it needs live `OPENAI_API_KEY` / `GEMINI_API_KEY` credentials.
2. Narrate the flow as it happens: hero → upload (drag-and-drop or click-to-browse) → processing (equalizer bars + the four cycling status phases) → results.
3. Scroll through the results section — transcript (speaker avatars, alternating row tint, timestamps), then the Summary / Key Decisions / Action Items cards.
4. Click a card in the "Past meetings" row and show it reloading that meeting's results instantly, with no re-processing.

## Future Improvements

- A real diarization service in place of the pause-based heuristic.
- Real progress reporting (e.g. Server-Sent Events) instead of the staged client-side status text.
- Export a meeting's results to PDF or Markdown.
