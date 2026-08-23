// api.js — fetch() wrappers for the Meeting Summarizer API.
// Every non-2xx response is expected to carry a JSON body shaped like
// { "error": "message" } (see backend/middleware/errorHandler.js) — that
// message becomes the thrown Error's message here.

const MEETINGS_ENDPOINT = '/api/meetings';

async function parseErrorMessage(response) {
  try {
    const body = await response.json();
    if (body && typeof body.error === 'string') {
      return body.error;
    }
  } catch {
    // Body wasn't JSON (or was empty) — fall through to the generic message.
  }
  return `Request failed with status ${response.status}`;
}

async function requestJSON(url, options) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.json();
}

async function createMeeting(audioFile) {
  const formData = new FormData();
  formData.append('audio', audioFile);
  return requestJSON(MEETINGS_ENDPOINT, {
    method: 'POST',
    body: formData,
  });
}

async function listMeetings() {
  return requestJSON(MEETINGS_ENDPOINT);
}

async function getMeeting(id) {
  return requestJSON(`${MEETINGS_ENDPOINT}/${encodeURIComponent(id)}`);
}
