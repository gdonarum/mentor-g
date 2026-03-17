import type { AnalysisResponse, LogFiles } from '../types/analysis';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 1000;

const SYSTEM_PROMPT = `You are Mentor G, a friendly and knowledgeable FRC (FIRST Robotics Competition) robot diagnostics expert. You wear glasses, a blue hard hat with a gold star, and have circuit patterns on your cheeks.

Analyze the provided log files and/or problem description. Respond ONLY with valid JSON (no markdown code blocks, no extra text) in this exact format:

{
  "summary": "A brief 1-2 sentence summary of the main issue(s)",
  "needsRobotJava": true or false (set true if seeing the Robot.java code would help diagnose the issue better, and no Robot.java was provided),
  "robotJavaReason": "If needsRobotJava is true, explain why you need to see it",
  "findings": [
    {
      "severity": "critical" | "warning" | "info" | "good",
      "title": "Short title for this finding",
      "description": "Detailed explanation of the issue",
      "fix": "How to fix this issue",
      "codeSnippet": "Optional code example showing the fix (can be empty string)"
    }
  ]
}

Guidelines:
- Be encouraging and helpful, like a mentor
- Focus on common FRC issues: loop overruns, CAN bus problems, vision latency, thread blocking
- Provide specific, actionable fixes
- Include code snippets when helpful
- If log files appear to be binary/unparseable, acknowledge this and work with what information is available
- Order findings by severity (critical first)`;

function buildUserMessage(logs: LogFiles, problemDescription: string): string {
  let message = '';

  if (logs.dslog) {
    message += `## Driver Station Log (${logs.dslog.filename})\n${logs.dslog.content}\n\n`;
  }

  if (logs.wpilog) {
    message += `## WPILib Log (${logs.wpilog.filename})\n${logs.wpilog.content}\n\n`;
  }

  if (logs.robotJava) {
    message += `## Robot.java (${logs.robotJava.filename})\n\`\`\`java\n${logs.robotJava.content}\n\`\`\`\n\n`;
  }

  if (problemDescription) {
    message += `## Problem Description\n${problemDescription}`;
  }

  return message;
}

export async function analyzeRobotLogs(
  logs: LogFiles,
  problemDescription: string
): Promise<AnalysisResponse> {
  const userMessage = buildUserMessage(logs, problemDescription);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      (errorData as { error?: { message?: string } }).error?.message ||
        `API error: ${response.status}`
    );
  }

  const data = await response.json();
  const content = (data as { content: { text: string }[] }).content[0].text;

  // Parse JSON response
  try {
    return JSON.parse(content) as AnalysisResponse;
  } catch {
    // Try to extract JSON from response if wrapped in markdown
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as AnalysisResponse;
    }
    throw new Error('Could not parse response as JSON');
  }
}
