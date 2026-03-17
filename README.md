# Mentor G — FRC Log Analyzer

AI-powered diagnostics tool for FRC (FIRST Robotics Competition) robots. Upload your log files, describe the problem, and get actionable fixes.

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
```

## Features

- **Log Analysis** — Upload `.dslog` and `.wpilog` files for AI-powered diagnostics
- **Problem Description** — Describe symptoms in plain English
- **Actionable Fixes** — Get specific code snippets and solutions
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
├── api/anthropic.ts     # Claude API integration
├── types/analysis.ts    # TypeScript types
├── parsers/logs.ts      # Log file parsers
├── components/          # UI components
└── content/guide.ts     # Performance guide content
```

## Tech Stack

- Vite + TypeScript
- Anthropic Claude API (claude-sonnet-4-20250514)
- Single-page app (no framework)

## TODO

- [ ] Binary `.dslog` parsing
- [ ] Binary `.wpilog` parsing
- [ ] Multi-turn conversation mode
- [ ] Custom domain hosting
