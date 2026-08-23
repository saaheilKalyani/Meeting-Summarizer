// pastMeetings.js — loads past meetings into the horizontal row on load,
// and re-renders the results section from a past meeting on card click.
//
// This section is a nice-to-have, not core: any failure loading the list
// degrades quietly to the same empty state rather than surfacing an error
// or blocking anything else on the page from working.

const pastMeetingsRow = document.getElementById('past-meetings-row');

function formatCardDate(isoString) {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function renderEmptyPastMeetings() {
  pastMeetingsRow.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'past-meetings__empty';
  empty.style.color = 'var(--text-muted)';
  empty.textContent = 'No past meetings yet.';
  pastMeetingsRow.appendChild(empty);
}

function buildMeetingCard(meeting) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'meeting-card';

  const title = document.createElement('span');
  title.className = 'meeting-card__title';
  title.textContent = meeting.title;

  const date = document.createElement('span');
  date.className = 'meeting-card__date';
  // formatDuration() is render.js's — already loaded by the time this file
  // runs, since script order in index.html is api.js, upload.js, render.js,
  // pastMeetings.js.
  date.textContent = `${formatCardDate(meeting.createdAt)} · ${formatDuration(meeting.durationSec)}`;

  card.append(title, date);
  card.addEventListener('click', () => handleMeetingCardClick(meeting.id));

  return card;
}

function renderPastMeetings(meetings) {
  pastMeetingsRow.replaceChildren();

  if (meetings.length === 0) {
    renderEmptyPastMeetings();
    return;
  }

  for (const meeting of meetings) {
    pastMeetingsRow.appendChild(buildMeetingCard(meeting));
  }
}

// Guards against a slow response landing after a faster, more recent one —
// without this, clicking one card and then quickly clicking another can
// have the first (now-stale) fetch resolve last and overwrite the second.
let latestMeetingRequestId = 0;

async function handleMeetingCardClick(id) {
  const requestId = ++latestMeetingRequestId;
  try {
    // getMeeting(), renderMeetingResult(), showResults(), and
    // animateResultsIn() all come from api.js / render.js / animations.js —
    // all already loaded by the time a user can click a card.
    const meeting = await getMeeting(id);
    if (requestId !== latestMeetingRequestId) return;
    renderMeetingResult(meeting);
    showResults();
    animateResultsIn();
    document.getElementById('results').scrollIntoView({ block: 'start' });
  } catch (err) {
    if (requestId !== latestMeetingRequestId) return;
    // Same "degrade quietly" stance as the list load below — a past
    // meeting failing to open isn't fatal to the rest of the page.
    console.error('Failed to load past meeting:', err);
  }
}

async function loadPastMeetings() {
  try {
    const meetings = await listMeetings();
    renderPastMeetings(meetings);
  } catch (err) {
    renderEmptyPastMeetings();
  }
}

document.addEventListener('DOMContentLoaded', loadPastMeetings);
