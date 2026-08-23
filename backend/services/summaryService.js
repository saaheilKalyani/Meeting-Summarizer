const { SummaryGenerationError } = require('../middleware/errorHandler');

// Verify this is still a current model name at https://ai.google.dev/gemini-api/docs/models
// before relying on it — override via GEMINI_MODEL in .env if it has moved on.
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const SYSTEM_PROMPT = `You are an assistant that extracts structured information from meeting transcripts.
Respond with ONLY valid JSON, no prose, no markdown fences, matching this shape:
{
  "summary": string,
  "decisions": string[],
  "actionItems": [ { "owner": string | null, "task": string, "dueDate": string | null } ]
}
Always write the summary, decisions, and action item text in English, regardless of what language the transcript itself is in.
Only include a decision or action item if the transcript clearly supports it. Do not invent names or dates.`;

function formatMs(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function transcriptToText(transcript) {
  return transcript
    .map((turn) => `${turn.speaker} [${formatMs(turn.start)}]: ${turn.text}`)
    .join('\n');
}

async function generateSummary(transcript) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new SummaryGenerationError('GEMINI_API_KEY is not set.');
  }

  const transcriptText = transcriptToText(transcript);
  const userContent = `${transcriptText}\n\nExtract the summary, decisions, and action items as JSON per the schema above.`;

  let response;
  try {
    response = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ parts: [{ text: userContent }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    throw new SummaryGenerationError(`Failed to reach the Gemini API: ${err.message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new SummaryGenerationError(`Gemini API returned ${response.status}: ${detail}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new SummaryGenerationError('Gemini API response did not contain any content.');
  }

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new SummaryGenerationError('Gemini API returned malformed JSON.');
  }

  return {
    summary: typeof parsed.summary === 'string' ? parsed.summary : '',
    decisions: Array.isArray(parsed.decisions) ? parsed.decisions : [],
    actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems : [],
  };
}

module.exports = { generateSummary };
