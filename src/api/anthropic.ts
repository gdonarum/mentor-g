/**
 * Mentor G - Claude API Integration
 * Copyright (c) 2026 Gregory Donarum
 * Licensed under MIT License with Commons Clause
 */

import type { AnalysisResponse, LogFiles } from '../types/analysis';
import { getApiKey, useWorkerMode, WORKER_URL } from './config';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are Mentor G, an FRC robot diagnostics expert. Respond ONLY with valid JSON.

RESPONSE FORMAT (required):
{"summary":"...","needsRobotJava":false,"robotJavaReason":"","findings":[{"severity":"critical|warning|info|good","title":"...","description":"...","fix":"...","codeSnippet":""}]}
- Limit to 3-5 findings. Be specific with fixes.
- Set needsRobotJava=true if code would help diagnose. Specify which files in robotJavaReason.
- If completely off-topic (cooking, homework, etc.), return: {"summary":"I can only help with FRC robot diagnostics.","needsRobotJava":false,"findings":[]}

ACCURACY RULES (CRITICAL - violations cause harm):
- NEVER invent metrics. NO fabricated counts like "254 watchdog triggers" or "23 brownout events"
- Watchdog triggers are NOT counted in DS logs - never report a number for them
- If "Input Voltage Brownouts: 0" appears, state "No brownouts recorded"
- Quote exact Tracer values: "robotPeriodic(): 0.303979s" not "~300ms"
- Say "multiple loop overruns" or "repeated warnings" - never invent a count
- NEVER suggest SystemStats.getFPGAButton() - doesn't exist. Use RobotController.getCPUTemp()

VOLTAGE TERMS (use precisely):
- BROWNOUT: <6.3V, roboRIO may reset - serious
- VOLTAGE SAG: 7-10V under load - NORMAL, not a brownout
- Never call >6.3V a "brownout"

LOG ANALYSIS (priority order):
1. CAN TIMEOUTS - ROOT CAUSE of many issues
   - "[Spark Flex] IDs: X, timed out" or "[SparkMax] IDs: X, timed out"
   - CAN hardware timeout = 500-750ms. A ~700ms timing spike with CAN timeout nearby = CAN CAUSED the spike
   - If "[JSON] CAN IDs greater than 40" warning + timeout on that ID, connect them

2. TIMING - distinguish transient vs sustained
   - Quote exact Tracer values for all slow subsystems
   - CRITICAL: Startup spikes (e.g., 700ms) that drop to <1ms are TRANSIENT - look for CAN timeout as cause
   - Only flag timing that stays high during actual match operation
   - YAGSL: startup SwerveSubsystem spikes are normal if they self-resolve (YAGSL thread taking over)

3. PHOTONVISION - if "Could not find any PhotonVision coprocessors" repeats every ~5s, cameras never connected entire match

4. MEMORY - if wpilog shows memory dropping significantly (23MB→3MB), causes GC pauses and sporadic overruns

5. PATHPLANNER ISSUES:
   - "command 'X' has not been registered" = missing NamedCommand registration
   - SequentialCommandGroup.execute() taking 80-100ms+ often means unregistered command running no-op search loop

6. OTHER WARNINGS - radio firmware outdated, CommandScheduler overruns

FRAMEWORK GUIDANCE:
- YAGSL: Never rate-limit updateOdometry() - YAGSL handles it. If called in periodic(), remove it entirely
- PathPlanner: Register NamedCommands BEFORE loading paths
- PhotonVision: verifyVersion() runs on main thread, adds latency when cameras missing

COMMON FIXES:
- Loop overruns: LiveWindow.disableAllTelemetry(), remove System.out.println(), frame counter for slow ops
- Code snippet for frame counter: if (frameCount++ % 5 == 0) { slowMethod(); }
- Never suggest raw Thread/Notifier - use frame counters
- High CAN: Increase SparkMax frame periods for unused status frames
- Brownout: Check battery connections, reduce current limits

HARDWARE REFERENCE:
- RoboRIO: 0-40°C ambient safe, CPU can run hotter. 47°C safe, >60°C needs cooling. Monitor via RobotController.getCPUTemp()
- Motors: NEO, NEO 550, Falcon 500, CIM, etc. Controllers: Spark MAX/Flex, Talon SRX/FX, Victor SPX
- Power: PDH/PDP distributes power, VRM provides 5V/12V regulated`;

/**
 * Strip characters that have no place in a log file and could be used to
 * smuggle instructions into the prompt (null bytes, most C0/C1 control chars).
 * Preserves newlines (\n), carriage returns (\r), and tabs (\t) because those
 * appear legitimately in log and source files.
 */
function sanitizeFileContent(content: string): string {
  // eslint-disable-next-line no-control-regex
  return content.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '');
}

function buildUserMessage(logs: LogFiles, problemDescription: string): string {
  let message = '';

  // Each file section is wrapped in XML-style tags so the model has an
  // unambiguous boundary between "file data" and "instructions". This is a
  // standard prompt-injection mitigation: injected text inside the tags is
  // structurally less likely to be mistaken for a top-level instruction.
  if (logs.dslog) {
    const content = sanitizeFileContent(logs.dslog.content.slice(0, 8000));
    message += `<file type="dslog" name="${logs.dslog.filename}">\n${content}\n</file>\n\n`;
  }

  if (logs.dsevents) {
    // dsevents is the most info-rich file (Tracer, CAN timeouts, PhotonVision errors)
    // Take head (startup) + tail (match-time) to capture both phases
    const raw = logs.dsevents.content;
    let content: string;
    if (raw.length <= 15000) {
      content = sanitizeFileContent(raw);
    } else {
      const head = raw.slice(0, 5000);
      const tail = raw.slice(-10000);
      content = sanitizeFileContent(head + '\n...[truncated]...\n' + tail);
    }
    message += `<file type="dsevents" name="${logs.dsevents.filename}">\n${content}\n</file>\n\n`;
  }

  if (logs.wpilog) {
    const content = sanitizeFileContent(logs.wpilog.content.slice(0, 10000));
    message += `<file type="wpilog" name="${logs.wpilog.filename}">\n${content}\n</file>\n\n`;
  }

  if (logs.javaFiles && logs.javaFiles.length > 0) {
    // Distribute 10000 char limit across all Java files
    const charLimit = Math.floor(10000 / logs.javaFiles.length);
    for (const javaFile of logs.javaFiles) {
      const content = sanitizeFileContent(javaFile.content.slice(0, charLimit));
      message += `<file type="java" name="${javaFile.filename}">\n\`\`\`java\n${content}\n\`\`\`\n</file>\n\n`;
    }
  }

  if (problemDescription) {
    // Problem description is user-typed text — sanitize it too.
    message += `<problem>\n${sanitizeFileContent(problemDescription)}\n</problem>`;
  }

  return message;
}

/**
 * Try to repair common JSON issues from LLM responses
 */
function tryRepairJson(text: string): AnalysisResponse | null {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to extract just the JSON object using indexOf (avoids regex backtracking)
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return null;

  cleaned = cleaned.slice(firstBrace, lastBrace + 1);

  // Try parsing as-is first
  try {
    return JSON.parse(cleaned) as AnalysisResponse;
  } catch {
    // Continue with repairs
  }

  // Try to fix truncated JSON by closing arrays and objects
  let repaired = cleaned;

  // Count braces and brackets
  const openBraces = (repaired.match(/\{/g) || []).length;
  const closeBraces = (repaired.match(/\}/g) || []).length;
  const openBrackets = (repaired.match(/\[/g) || []).length;
  const closeBrackets = (repaired.match(/\]/g) || []).length;

  // If we're in the middle of a string (odd number of quotes), try to close it
  const quoteCount = (repaired.match(/"/g) || []).length;
  if (quoteCount % 2 === 1) {
    repaired += '"';
  }

  // Add missing closing brackets/braces
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    repaired += ']';
  }
  for (let i = 0; i < openBraces - closeBraces; i++) {
    repaired += '}';
  }

  // Remove trailing commas before ] or }
  repaired = repaired.replace(/,\s*([\]}])/g, '$1');

  try {
    return JSON.parse(repaired) as AnalysisResponse;
  } catch {
    return null;
  }
}

export async function analyzeRobotLogs(
  logs: LogFiles,
  problemDescription: string
): Promise<AnalysisResponse> {
  const userMessage = buildUserMessage(logs, problemDescription);
  const requestBody = JSON.stringify({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });

  let response: Response;

  if (useWorkerMode()) {
    // Use Cloudflare Worker (hides API key, logs analyses)
    response = await fetch(WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: requestBody,
    });
  } else {
    // Direct API mode (requires user's API key)
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('API key not configured. Click the gear icon to add your Anthropic API key.');
    }

    response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'x-api-key': apiKey,
      },
      body: requestBody,
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: { message?: string } }).error?.message ||
        `API error: ${response.status}`
    );
  }

  const data = await response.json();
  const content = (data as { content: { text: string }[] }).content[0].text;

  // Try to parse JSON response
  const parsed = tryRepairJson(content);

  if (parsed) {
    return parsed;
  }

  // If we still can't parse, return a fallback response
  return {
    summary: 'Analysis completed but response format was invalid.',
    needsRobotJava: false,
    findings: [
      {
        severity: 'info',
        title: 'Analysis Response',
        description: content.slice(0, 500),
        fix: 'Try running the analysis again with a simpler problem description.',
      },
    ],
  };
}
