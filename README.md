# Mentor G — FRC Log Analyzer

AI-powered diagnostics tool for FRC (FIRST Robotics Competition) robots. Upload your log files, describe the problem, and get actionable fixes.

**Live:** https://gdonarum.github.io/mentor-g/

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server (hot reload)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm test
```

## Features

- **Log Analysis** — Upload `.dslog`, `.dsevents`, and `Robot.java` files for AI-powered diagnostics
- **Problem Description** — Describe symptoms in plain English
- **Actionable Fixes** — Get specific code snippets and solutions
- **Feedback Form** — Submit suggestions or report issues
- **Performance Guide** — Built-in FAQ covering common FRC issues:
  - Loop overruns & thread blocking
  - CAN bus optimization
  - Telemetry overhead
  - Swerve drive specifics
  - Vision & autonomous pitfalls

## Project Structure

```
src/
├── main.ts              # App entry point
├── styles.css           # All styles
├── api/
│   ├── anthropic.ts     # Claude API integration
│   └── config.ts        # API key/worker URL config
├── types/analysis.ts    # TypeScript types
├── parsers/logs.ts      # Log file parsers (.dslog, .dsevents)
├── components/          # UI components
└── content/guide.ts     # Performance guide content

worker/                  # Optional Cloudflare Worker backend
├── index.ts             # Worker proxy to Anthropic API
├── schema.sql           # D1 database schema
└── wrangler.toml        # Worker configuration

test/                    # Unit tests (Vitest)
├── fixtures/            # Sample log files for testing
└── parsers/logs.test.ts # Parser unit tests
```

## Tech Stack

- Vite + TypeScript + Vitest
- Anthropic Claude API (claude-haiku-4-5)
- Cloudflare Workers + D1 (optional backend)
- Single-page app (no framework)

## TODO

- [x] Binary `.dslog` parsing
- [ ] Binary `.wpilog` parsing
- [ ] Multi-turn conversation mode
