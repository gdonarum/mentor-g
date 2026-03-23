# CLAUDE.md — Mentor G Codebase Guide

## Project Overview

**Mentor G** is a web application for FIRST Robotics Competition (FRC) teams that provides AI-powered diagnostics of robot telemetry logs. It parses `.dslog` (Driver Station log), `.dsevents`, and `.wpilog` (WPILib DataLog) files along with optional `Robot.java` source code, then uses the Claude API to identify performance issues and suggest fixes.

Live deployment: GitHub Pages at `https://gdonarum.github.io/mentor-g/`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla TypeScript (no UI framework) |
| Build | Vite 8.x |
| Language | TypeScript 5.9.3 (strict mode) |
| AI | Anthropic Claude API (`claude-haiku-4-5-20251001`) |
| Backend (optional) | Cloudflare Workers |
| Database (optional) | Cloudflare D1 (SQLite) |

---

## Repository Structure

```
mentor-g/
├── src/
│   ├── api/
│   │   ├── anthropic.ts      # Claude API integration & prompt construction
│   │   └── config.ts         # API key/worker URL management (localStorage)
│   ├── components/
│   │   ├── accordion.ts      # FAQ accordion (single-open behavior)
│   │   ├── feedback.ts       # Feedback form submission
│   │   ├── mascot.ts         # SVG mascot assets
│   │   ├── results.ts        # Analysis results renderer
│   │   ├── settings.ts       # Settings modal (API key UI)
│   │   └── upload.ts         # Drag-and-drop file upload zones
│   ├── content/
│   │   └── guide.ts          # Static performance guide content (accordion sections)
│   ├── parsers/
│   │   └── logs.ts           # Binary dslog/wpilog + text dsevents parsers
│   ├── types/
│   │   └── analysis.ts       # Core TypeScript interfaces
│   ├── main.ts               # App entry point — tab switching, file state, workflow
│   └── styles.css            # Global styles
├── worker/
│   ├── index.ts              # Cloudflare Worker proxy to Anthropic
│   ├── schema.sql            # D1 database schema
│   ├── wrangler.toml         # Worker configuration (bindings, DB ID)
│   ├── package.json
│   └── README.md             # Worker deployment instructions
├── index.html                # Main HTML template
├── package.json
├── tsconfig.json
├── vite.config.ts
└── .github/workflows/deploy.yml  # GitHub Pages CI/CD
```

---

## Development Workflow

### Setup

```bash
npm install
npm run dev       # Vite dev server at http://localhost:5173/mentor-g/
```

### Build & Preview

```bash
npm run build     # Outputs to dist/
npm run preview   # Preview the production build locally
```

### Worker Development

```bash
cd worker
npm install
npx wrangler dev  # Local worker at http://localhost:8787
```

### Deployment

- **Frontend:** Automatically deployed to GitHub Pages on push to `master` via `.github/workflows/deploy.yml`
- **Worker:** Manual deploy via `npx wrangler deploy` from the `worker/` directory. See `worker/README.md` for full setup including D1 database creation and API key secret.

---

## Key Conventions

### TypeScript

- **Strict mode** is enforced: no implicit `any`, no unused locals/parameters, no fallthrough switch cases.
- Use `PascalCase` for types/interfaces, `camelCase` for functions and variables.
- Prefer explicit return types on exported functions.
- Non-null assertions (`!`) are used in DOM queries after confirming element existence — use them only when the element is guaranteed to exist.

### Architecture Patterns

- **No framework** — pure DOM manipulation via `document.querySelector` and event listeners.
- **Module-level state** — mutable file references (`dslogFile`, `dseventsFile`, `wpilogFile`, `robotJavaFile`) live in `main.ts`.
- **Separation of concerns:** parser logic stays in `parsers/`, API calls in `api/`, UI rendering in `components/`, static content in `content/`.
- **Progressive enhancement** — the app works with a direct API key (stored in localStorage) or via an optional Cloudflare Worker proxy that hides the key.

### Security

- Always escape user-controlled content before inserting into the DOM. The `escapeHtml()` helper in `components/results.ts` must be used for any content derived from file uploads or API responses.
- API keys are stored in `localStorage`, never hardcoded. The worker mode keeps the key server-side entirely.

### Vite Config

The base path is `/mentor-g/` (matches the GitHub Pages repo path). Do not change this without updating the GitHub Pages deployment settings.

---

## Core Data Flow

1. User uploads `.dslog`, `.dsevents`, `.wpilog`, and/or `Robot.java` via drag-and-drop zones in `upload.ts`.
2. `main.ts` stores file references and calls `parseDslog()` / `parseDsevents()` / `parseWpilog()` / `parseJavaFile()` from `parsers/logs.ts`.
3. Parsed summaries are passed to `buildUserMessage()` in `api/anthropic.ts`, which assembles the Claude prompt (truncated: dslog/dsevents ≤ 8000 chars, wpilog ≤ 10000 chars, Java ≤ 10000 chars).
4. The request is sent to either the Anthropic API directly or the Cloudflare Worker proxy.
5. The JSON response is parsed (with `repairJson()` fallback for malformed output) into `AnalysisResponse`.
6. `displayResults()` in `components/results.ts` renders findings with severity badges.

---

## Claude API Integration (`src/api/anthropic.ts`)

- **Model:** `claude-haiku-4-5-20251001`
- **Max tokens:** 4096
- **System prompt:** Strictly constrains responses to FRC robotics diagnostics. Claude must refuse off-topic requests. Do not loosen these guardrails without careful consideration.
- **Response format:** JSON with `{ summary, needsRobotJava, findings[] }`. The `repairJson()` function handles common LLM formatting issues (trailing commas, extra text).

---

## Type Definitions (`src/types/analysis.ts`)

```typescript
interface Finding {
  severity: 'critical' | 'warning' | 'info' | 'good';
  title: string;
  description: string;
  fix: string;
  codeSnippet?: string;
}

interface AnalysisResponse {
  summary: string;
  needsRobotJava: boolean;
  findings: Finding[];
}

interface LogFiles {
  dslog?: { filename: string; content: string };
  dsevents?: { filename: string; content: string };
  wpilog?: { filename: string; content: string };
  robotJava?: { filename: string; content: string };
}
```

---

## Log Parsers (`src/parsers/logs.ts`)

### `parseDslog(buffer: ArrayBuffer): string`
Parses binary `.dslog` v4 format. Each 10-byte record contains:
- Trip time (1 byte)
- Lost packets (1 byte)
- Battery voltage (2 bytes, scaled)
- Rio CPU % (1 byte)
- Status flags: brownout, watchdog (1 byte)
- CAN bus usage % (1 byte)

Returns a human-readable summary with statistics and detected problem events.

### `parseDsevents(content: string): string`
Parses text-based `.dsevents` files. Groups and counts errors/warnings. Returns a formatted summary.

### `parseWpilog(file: File): Promise<ParsedLog>`
Parses binary `.wpilog` v1.0 format (WPILib DataLog). Extracts:
- Entry definitions (name, type, metadata)
- Data points for each entry with timestamps
- Statistics (min/max/avg) for numeric entries
- Potential issues (low voltage, high temperature, faults)

Returns a human-readable summary organized by category (e.g., `/drivetrain/`, `/arm/`).

### `parseJavaFile(file: File): Promise<ParsedLog>`
Returns the raw Java source (no transformation). Used for the truncation pipeline.

---

## Cloudflare Worker (`worker/index.ts`)

The worker acts as an authenticated proxy:
1. Receives POST requests from the frontend (same body format as Anthropic API).
2. Forwards to `https://api.anthropic.com/v1/messages` using the server-side `ANTHROPIC_API_KEY` secret.
3. Logs the analysis (problem description, file excerpts, response summary, findings count) to the `analyses` D1 table.
4. Returns the Anthropic response to the client with CORS headers.

**CORS:** The worker sets `Access-Control-Allow-Origin: *`. Restrict this in production if needed.

---

## Database Schema (D1)

```sql
CREATE TABLE analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  problem_description TEXT,
  dslog_filename TEXT,
  dslog_summary TEXT,
  dsevents_filename TEXT,
  dsevents_excerpt TEXT,
  java_filename TEXT,
  java_excerpt TEXT,
  response_summary TEXT,
  findings_count INTEGER
);
```

---

## Known TODOs / Incomplete Features

- Multi-turn conversation mode (not started)
- Formal test suite (no tests currently)
- Custom domain hosting for the worker

---

## CI/CD

`.github/workflows/deploy.yml` runs on push to `master`:
1. `npm ci` — install dependencies
2. `npm run build` — Vite build to `dist/`
3. Deploy `dist/` to GitHub Pages

The worker is deployed separately via `wrangler` (manual step, not automated).

---

## Common Gotchas

- The Vite `base` is `/mentor-g/` — all asset paths are relative to this. If you see 404s on assets, check this setting.
- `localStorage` keys: `mentor-g-api-key` and `mentor-g-worker-url`. Clear these during testing to reset state.
- The Claude system prompt is intentionally restrictive. If analysis returns unexpected refusals, check the system prompt in `src/api/anthropic.ts`.
- TypeScript strict mode will reject unused imports/variables — clean these up before building.
- Worker `wrangler.toml` contains a hardcoded D1 database ID — do not change this without updating the binding in the Cloudflare dashboard.
