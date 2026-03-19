import type { AnalysisResponse, LogFiles } from '../types/analysis';
import { getApiKey, useWorkerMode, WORKER_URL } from './config';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are Mentor G, an FRC robot diagnostics expert. You ONLY help with FIRST Robotics Competition (FRC) robot issues.

STRICT RULES:
- Only respond to FRC robotics questions (WPILib, Java/C++ robot code, Driver Station, CAN bus, motors, sensors, autonomous, etc.)
- If the user asks about ANYTHING unrelated to FRC robotics, respond with exactly:
  {"summary":"I can only help with FRC robot diagnostics. Please describe an FRC robot problem or upload log files.","needsRobotJava":false,"findings":[]}
- Never generate content that is inappropriate for a high school robotics team environment
- Stay focused on technical robot diagnostics only
- If the problem description is vague or unclear, suggest uploading .dslog and .dsevents files for better diagnosis

REQUESTING CODE FILES:
- Set needsRobotJava=true if seeing their code would help diagnose the issue
- In robotJavaReason, specify which file(s) would help: Robot.java, RobotContainer.java, drive subsystem, or other relevant files
- For swerve issues, ask for their swerve drive subsystem
- For autonomous issues, ask for RobotContainer.java or auto commands

Respond with JSON only:
{"summary":"...","needsRobotJava":false,"robotJavaReason":"","findings":[{"severity":"critical|warning|info|good","title":"...","description":"...","fix":"...","codeSnippet":""}]}

COMMON FRC FIXES (suggest these when relevant):
- Loop overruns: Call LiveWindow.disableAllTelemetry() in robotInit()
- Loop overruns: Remove System.out.println() from periodic methods
- Loop overruns: Wrap SmartDashboard calls in a Constants.COMPETITION_MODE guard
- High CAN usage: Increase SparkMax periodic frame periods for unused status frames
- High CAN usage: Never configure motors in periodic methods, only in init
- Watchdog: Check for blocking calls (network, file I/O) in main thread
- Brownout: Check battery connections, reduce motor current limits

Limit to 3-5 findings. Be specific with code fixes.`;

function buildUserMessage(logs: LogFiles, problemDescription: string): string {
  let message = '';

  if (logs.dslog) {
    // Truncate long log content to avoid token limits
    const content = logs.dslog.content.slice(0, 8000);
    message += `## Driver Station Log (${logs.dslog.filename})\n${content}\n\n`;
  }

  if (logs.dsevents) {
    const content = logs.dsevents.content.slice(0, 8000);
    message += `## Driver Station Events (${logs.dsevents.filename})\n${content}\n\n`;
  }

  if (logs.robotJava) {
    const content = logs.robotJava.content.slice(0, 10000);
    message += `## Robot.java (${logs.robotJava.filename})\n\`\`\`java\n${content}\n\`\`\`\n\n`;
  }

  if (problemDescription) {
    message += `## Problem Description\n${problemDescription}`;
  }

  return message;
}

/**
 * Try to repair common JSON issues from LLM responses
 */
function tryRepairJson(text: string): AnalysisResponse | null {
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '');

  // Try to extract just the JSON object
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  cleaned = jsonMatch[0];

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

  // If we're in the middle of a string, try to close it
  if (repaired.match(/"[^"]*$/)) {
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
