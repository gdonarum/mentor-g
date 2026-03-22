/**
 * Mentor G - Cloudflare Worker
 * Proxies requests to Anthropic API while:
 * 1. Hiding the API key from clients
 * 2. Automatically logging all analyses for feedback
 */

interface Env {
  ANTHROPIC_API_KEY: string;
  DISCORD_WEBHOOK_ANALYSIS?: string;
  DISCORD_WEBHOOK_FEEDBACK?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  MENTOR_G_DB: any;
}

interface AnalysisRequest {
  problemDescription: string;
  dslogSummary?: string;
  dslogFilename?: string;
  dseventsExcerpt?: string;
  dseventsFilename?: string;
  javaFilename?: string;
  javaExcerpt?: string;
}

interface AnthropicRequest {
  model: string;
  max_tokens: number;
  system: string;
  messages: { role: string; content: string }[];
}

interface FeedbackRequest {
  type: string;
  name?: string;
  message: string;
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export default {
  async fetch(request: Request, env: Env, ctx: { waitUntil: (promise: Promise<unknown>) => void }): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
    }

    // Route: /feedback - Store user feedback
    if (url.pathname === '/feedback') {
      return handleFeedback(request, env, ctx);
    }

    // Default route: Proxy to Anthropic API
    try {
      const body = await request.json() as AnthropicRequest;

      // Extract analysis details for logging
      const userMessage = body.messages?.[0]?.content || '';
      const analysisData = extractAnalysisData(userMessage);

      // Forward to Anthropic API
      const anthropicResponse = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
          'x-api-key': env.ANTHROPIC_API_KEY,
        },
        body: JSON.stringify(body),
      });

      const responseData = await anthropicResponse.json();

      // Log the analysis using waitUntil to keep worker alive
      if (anthropicResponse.ok) {
        const responseText = (responseData as { content: { text: string }[] }).content?.[0]?.text || '';
        ctx.waitUntil(
          logAnalysis(env, analysisData, responseText).catch((err) => {
            console.error('Failed to log analysis:', err);
          })
        );

        // Notify Discord if webhook is configured
        if (env.DISCORD_WEBHOOK_ANALYSIS) {
          let findingsCount = 0;
          try {
            const parsed = JSON.parse(responseText);
            findingsCount = parsed.findings?.length || 0;
          } catch {
            // Ignore parse errors
          }
          ctx.waitUntil(
            notifyDiscordAnalysis(env.DISCORD_WEBHOOK_ANALYSIS, analysisData, findingsCount).catch((err) => {
              console.error('Discord notification failed:', err);
            })
          );
        }
      }

      return new Response(JSON.stringify(responseData), {
        status: anthropicResponse.status,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(
        JSON.stringify({ error: { message: 'Internal server error' } }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }
  },
};

function extractAnalysisData(userMessage: string): AnalysisRequest {
  const data: AnalysisRequest = { problemDescription: '' };

  // Extract problem description from <problem> tags
  const problemMatch = userMessage.match(/<problem>\n?([\s\S]*?)\n?<\/problem>/);
  if (problemMatch) {
    data.problemDescription = problemMatch[1].trim().slice(0, 500);
  }

  // Extract dslog info from <file type="dslog" name="..."> tags
  const dslogMatch = userMessage.match(/<file type="dslog" name="([^"]+)">\n?([\s\S]*?)\n?<\/file>/);
  if (dslogMatch) {
    data.dslogFilename = dslogMatch[1];
    data.dslogSummary = dslogMatch[2].trim().slice(0, 1000);
  }

  // Extract dsevents info from <file type="dsevents" name="..."> tags
  const dseventsMatch = userMessage.match(/<file type="dsevents" name="([^"]+)">\n?([\s\S]*?)\n?<\/file>/);
  if (dseventsMatch) {
    data.dseventsFilename = dseventsMatch[1];
    data.dseventsExcerpt = dseventsMatch[2].trim().slice(0, 1000);
  }

  // Extract Java file info from <file type="java" name="..."> tags
  const javaMatch = userMessage.match(/<file type="java" name="([^"]+)">\n?```java\n?([\s\S]*?)```\n?<\/file>/);
  if (javaMatch) {
    data.javaFilename = javaMatch[1];
    data.javaExcerpt = javaMatch[2].trim().slice(0, 500);
  }

  return data;
}

async function logAnalysis(env: Env, request: AnalysisRequest, response: string): Promise<void> {
  // Parse the response to extract summary and findings
  let summary = '';
  let findingsCount = 0;

  try {
    const parsed = JSON.parse(response);
    summary = parsed.summary || '';
    findingsCount = parsed.findings?.length || 0;
  } catch {
    // Response wasn't valid JSON, store raw excerpt
    summary = response.slice(0, 500);
  }

  await env.MENTOR_G_DB.prepare(`
    INSERT INTO analyses (
      timestamp,
      problem_description,
      dslog_filename,
      dslog_summary,
      dsevents_filename,
      dsevents_excerpt,
      java_filename,
      java_excerpt,
      response_summary,
      findings_count
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    new Date().toISOString(),
    request.problemDescription,
    request.dslogFilename || null,
    request.dslogSummary || null,
    request.dseventsFilename || null,
    request.dseventsExcerpt || null,
    request.javaFilename || null,
    request.javaExcerpt || null,
    summary,
    findingsCount
  ).run();
}

async function notifyDiscordFeedback(webhookUrl: string, feedback: FeedbackRequest): Promise<void> {
  const colorMap: Record<string, number> = {
    bug: 0xff0000,
    feature: 0x00ff00,
    question: 0x0099ff,
    other: 0x808080,
  };

  const embed = {
    title: `Mentor G Feedback: ${feedback.type}`,
    color: colorMap[feedback.type] ?? 0x0099ff,
    fields: [
      { name: 'Type', value: feedback.type, inline: true },
      { name: 'From', value: feedback.name || 'Anonymous', inline: true },
      { name: 'Message', value: feedback.message.slice(0, 1000) },
    ],
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

async function notifyDiscordAnalysis(
  webhookUrl: string,
  analysis: AnalysisRequest,
  findingsCount: number
): Promise<void> {
  const files: string[] = [];
  if (analysis.dslogFilename) files.push(analysis.dslogFilename);
  if (analysis.dseventsFilename) files.push(analysis.dseventsFilename);
  if (analysis.javaFilename) files.push(analysis.javaFilename);

  const embed = {
    title: 'New Analysis Request',
    color: 0x5865f2,
    fields: [
      {
        name: 'Problem',
        value: analysis.problemDescription?.slice(0, 500) || 'No description provided',
      },
      {
        name: 'Files',
        value: files.length > 0 ? files.join(', ') : 'None',
        inline: true,
      },
      {
        name: 'Findings',
        value: String(findingsCount),
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ embeds: [embed] }),
  });
}

async function handleFeedback(
  request: Request,
  env: Env,
  ctx: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<Response> {
  try {
    const body = await request.json() as FeedbackRequest;

    if (!body.message || !body.type) {
      return new Response(
        JSON.stringify({ error: 'Message and type are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      );
    }

    // Store feedback in background
    ctx.waitUntil(
      env.MENTOR_G_DB.prepare(`
        INSERT INTO feedback (timestamp, type, name, message)
        VALUES (?, ?, ?, ?)
      `).bind(
        new Date().toISOString(),
        body.type,
        body.name || null,
        body.message.slice(0, 2000)
      ).run()
    );

    // Notify Discord if webhook is configured
    if (env.DISCORD_WEBHOOK_FEEDBACK) {
      ctx.waitUntil(
        notifyDiscordFeedback(env.DISCORD_WEBHOOK_FEEDBACK, body).catch((err) => {
          console.error('Discord notification failed:', err);
        })
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  } catch (error) {
    console.error('Feedback error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to submit feedback' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    );
  }
}
