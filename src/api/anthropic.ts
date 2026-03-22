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
- If the problem description is vague or unclear, suggest uploading .dslog, .dsevents, or .wpilog files for better diagnosis
- WPILOG files contain detailed telemetry from WPILib DataLog - look for motor outputs, sensor readings, subsystem timing data

ANTI-HALLUCINATION (CRITICAL - STRICTLY ENFORCED):
FORBIDDEN - Never do these:
- NEVER invent counts like "5,109 watchdog triggers" or "23 brownout events" - these metrics don't exist as single numbers in DS logs
- NEVER claim brownouts occurred if "Input Voltage Brownouts: 0" appears in the log - that means ZERO brownouts
- NEVER report watchdog trigger counts - DS doesn't report watchdog as a single count number
- NEVER pad your analysis with fabricated severity metrics to sound more authoritative

REQUIRED - Always do these:
- If log says "Input Voltage Brownouts: 0", explicitly state "No brownouts recorded"
- Quote exact Tracer timing values: "robotPeriodic(): 0.303979s" not "~300ms"
- Report CAN timeout errors verbatim: "[Spark Flex] IDs: 52, timed out while waiting for Period Status 2" - this is CRITICAL
- CAN timeouts on specific device IDs are often the ROOT CAUSE of loop overruns - prioritize these
- Say "multiple loop overrun warnings" instead of inventing a count
- If you see "CAN IDs greater than 40" warning PLUS a CAN timeout on that ID, connect the two

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

YAGSL-SPECIFIC (CRITICAL - don't give harmful advice):
- YAGSL runs its own high-frequency odometry thread internally
- NEVER suggest rate-limiting swerveDrive.updateOdometry() - YAGSL handles this already
- If user code calls updateOdometry() in periodic(), suggest REMOVING it entirely, not rate-limiting
- Startup SwerveSubsystem spikes (80ms+) that drop to <1ms after connection are NORMAL - YAGSL's thread is taking over
- Look for SUSTAINED high timing, not transient startup spikes that self-resolve
- The "[JSON] CAN IDs greater than 40" warning comes from YAGSL's parser

DSEVENTS DATA TO LOOK FOR (in priority order):
1. CAN TIMEOUTS (HIGHEST PRIORITY - often root cause of other issues):
   - "[Spark Flex] IDs: X, timed out" or "[SparkMax] IDs: X, timed out"
   - "HAL: CAN Receive has Timed Out"
   - These block the main loop and cause cascading overruns!

2. TIMING DATA from Tracer:
   - "robotPeriodic(): 0.303979s" - quote exact values
   - "SwerveSubsystem.periodic(): 0.060120s" - identifies slow subsystems
   - "disabledInit(): 0.152129s" - expensive init running on mode change
   - "LimelightSubsystem.periodic(): 0.023207s" - vision/network bottlenecks
   - Look at ALL subsystem timings to find the actual bottleneck, not just swerve

3. BROWNOUT STATUS:
   - "Input Voltage Brownouts: X" - use this EXACT number (often 0!)
   - If it says 0, report "No brownouts recorded"

4. PATHPLANNER ISSUES:
   - "PathPlanner attempted to create a command 'X' that has not been registered" - CRITICAL missing NamedCommand
   - Commands must be registered BEFORE loading paths that use them

5. WARNINGS:
   - "[JSON] CAN IDs greater than 40" - link to any CAN timeouts on high IDs
   - "Loop time of 0.02s overrun" - confirms timing issues
   - "CommandScheduler loop overrun"

6. TIMING PROGRESSION (important!):
   - Compare timing at different points: startup vs after connection vs during match
   - Startup spikes that RESOLVE (e.g., 83ms → 0.4ms) are transient, not the real problem
   - Focus on SUSTAINED high timing during actual operation
   - If a subsystem is fast during teleop, don't recommend "fixing" it based on startup data

7. Stack traces - identify the actual code location causing issues

Limit to 3-5 findings. Be specific with code fixes.`;

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
    const content = sanitizeFileContent(logs.dsevents.content.slice(0, 8000));
    message += `<file type="dsevents" name="${logs.dsevents.filename}">\n${content}\n</file>\n\n`;
  }

  if (logs.wpilog) {
    const content = sanitizeFileContent(logs.wpilog.content.slice(0, 10000));
    message += `<file type="wpilog" name="${logs.wpilog.filename}">\n${content}\n</file>\n\n`;
  }

  if (logs.robotJava) {
    const content = sanitizeFileContent(logs.robotJava.content.slice(0, 10000));
    message += `<file type="java" name="${logs.robotJava.filename}">\n\`\`\`java\n${content}\n\`\`\`\n</file>\n\n`;
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
