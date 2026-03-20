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

ANTI-HALLUCINATION (CRITICAL - follow exactly):
- NEVER invent statistics, counts, or numbers not explicitly present in the log data
- NEVER claim "X watchdog triggers" or "Y brownouts" unless you see that exact count in the data
- The dsevents file often contains "Input Voltage Brownouts: X" - use ONLY that number
- Look for actual Tracer timing output (e.g., "robotPeriodic(): 0.303979s") and quote those exact values
- Look for actual error messages like "[Spark Flex] IDs: 52, timed out" and report them verbatim
- If you see "CAN IDs greater than 40" warnings, this is a real issue - mention it
- When unsure about a count, say "multiple instances" or "repeated" instead of inventing a number
- Focus on what IS in the logs, not what you assume should be there

REQUESTING CODE FILES:
- Set needsRobotJava=true if seeing their code would help diagnose the issue
- In robotJavaReason, specify which file(s) would help: Robot.java, RobotContainer.java, drive subsystem, or other relevant files
- For swerve issues, ask for their swerve drive subsystem
- For autonomous issues, ask for RobotContainer.java or auto commands

Respond with JSON only:
{"summary":"...","needsRobotJava":false,"robotJavaReason":"","findings":[{"severity":"critical|warning|info|good","title":"...","description":"...","fix":"...","codeSnippet":""}]}

VOLTAGE TERMINOLOGY (CRITICAL - use precise terms):
- BROWNOUT: Voltage dropped below 6.3V. This is serious - the roboRIO may have reset. Requires immediate attention.
- VOLTAGE SAG: Voltage dropped to 7-10V under load. This is NORMAL and NOT a brownout. High current draw from motors temporarily pulls voltage down. Only mention if it's severe or unexpected.
- LOW VOLTAGE: Voltage stayed around 10-11V. Usually indicates weak battery or high sustained load. Not critical unless it drops further.
- NEVER call voltage sag (>6.3V) a "brownout" - this causes unnecessary alarm. Only use "brownout" when voltage actually went below 6.3V.

COMMON FRC FIXES (suggest these when relevant):
- Loop overruns: Call LiveWindow.disableAllTelemetry() in robotInit()
- Loop overruns: Remove System.out.println() from periodic methods
- Loop overruns: Wrap SmartDashboard calls in a Constants.COMPETITION_MODE guard
- Loop overruns: Use a frame counter to run slow operations less frequently (e.g., every 5th loop = 10Hz)
- Loop overruns: NEVER suggest raw Thread or Notifier - use a simple frame counter instead
- Loop overruns: Profile with Tracer to find the actual bottleneck before optimizing
- High CAN usage: Increase SparkMax periodic frame periods for unused status frames
- High CAN usage: Never configure motors in periodic methods, only in init
- Watchdog: Check for blocking calls (network, file I/O) in main thread
- Brownout (<6.3V): Check battery connections, reduce motor current limits, check for shorted wires
- Voltage sag (7-10V): Normal under high load, but consider current limiting if motors are stalling
- Vision latency: Run vision processing on a coprocessor (PhotonVision/Limelight does this automatically)

CODE SNIPPET GUIDELINES:
- For slow periodic operations, use a frame counter: if (frameCount++ % 5 == 0) { slowMethod(); }
- Never show raw Thread or Notifier code - use frame counters for simplicity
- Never use addPeriodic() in subsystems - it only exists on TimedRobot
- Keep snippets minimal and focused on the specific fix

DSEVENTS DATA TO LOOK FOR:
- Tracer output lines like "robotPeriodic(): 0.303979s" or "SwerveSubsystem.periodic(): 0.060120s" - these are real timing measurements
- "Input Voltage Brownouts: X" - the actual brownout count from DS
- "[Spark Flex] IDs: X, timed out" - CAN timeout errors (critical!)
- "[JSON] CAN IDs greater than 40" - YAGSL warning about high CAN IDs causing issues
- "Loop time of 0.02s overrun" - actual loop overrun warnings
- "CommandScheduler loop overrun" - scheduler timing issues
- Stack traces pointing to specific code locations
- Quote these exact values in your analysis rather than paraphrasing

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
