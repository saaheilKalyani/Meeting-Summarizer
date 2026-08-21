const fs = require('fs');
const path = require('path');
const { TranscriptionError } = require('../middleware/errorHandler');

const WHISPER_URL = 'https://api.openai.com/v1/audio/transcriptions';

// Whisper doesn't diarize. This is a pause-based heuristic, not real speaker
// identification: a gap longer than this between two words starts a new turn,
// and turns alternate "Speaker 1" / "Speaker 2". See README "Known Limitations".
const SPEAKER_GAP_THRESHOLD_SEC = 1.2;

async function transcribeAudio(filePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new TranscriptionError('OPENAI_API_KEY is not set.');
  }

  const audioBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), filename);
  form.append('model', 'whisper-1');
  form.append('response_format', 'verbose_json');
  form.append('timestamp_granularities[]', 'word');

  let response;
  try {
    response = await fetch(WHISPER_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } catch (err) {
    throw new TranscriptionError(`Failed to reach the Whisper API: ${err.message}`);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new TranscriptionError(`Whisper API returned ${response.status}: ${detail}`);
  }

  const data = await response.json();

  if (!Array.isArray(data.words) || data.words.length === 0) {
    return { transcript: [], durationSec: Math.round(data.duration || 0) };
  }

  return {
    transcript: splitIntoSpeakerTurns(data.words),
    durationSec: Math.round(data.duration || 0),
  };
}

function splitIntoSpeakerTurns(words) {
  const turns = [];
  let speakerIndex = 0;
  let previousWordEnd = null;

  for (const word of words) {
    const gap = previousWordEnd === null ? 0 : word.start - previousWordEnd;
    const startsNewTurn = turns.length === 0 || gap > SPEAKER_GAP_THRESHOLD_SEC;

    if (startsNewTurn) {
      if (turns.length > 0) {
        speakerIndex = (speakerIndex + 1) % 2;
      }
      turns.push({
        speaker: `Speaker ${speakerIndex + 1}`,
        start: Math.round(word.start * 1000),
        end: Math.round(word.end * 1000),
        text: word.word.trim(),
      });
    } else {
      const turn = turns[turns.length - 1];
      turn.end = Math.round(word.end * 1000);
      turn.text += ` ${word.word.trim()}`;
    }

    previousWordEnd = word.end;
  }

  return turns;
}

module.exports = { transcribeAudio };
