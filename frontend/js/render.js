// render.js — populates the results section (meta line, transcript,
// summary, key decisions, action items) from a meeting result object
// shaped exactly like the POST /api/meetings response (Section 4 of the
// spec). Not wired into the real upload flow yet — main.js will call into
// this once the actual request/response cycle exists.

const resultsSection = document.getElementById('results');
const resultsMeta = document.getElementById('results-meta');
const transcriptList = document.getElementById('transcript-list');
const summaryText = document.getElementById('summary-text');
const decisionsList = document.getElementById('decisions-list');
const actionsList = document.getElementById('actions-list');

function msToClock(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatDuration(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m ${seconds}s`;
}

// Due dates arrive as plain "YYYY-MM-DD" strings. Parsing that directly with
// `new Date(str)` treats it as UTC midnight, which `toLocaleDateString` then
// renders in the viewer's local time — shifting the displayed day back by
// one for anyone west of UTC. Building the Date from numeric Y/M/D instead
// always resolves in local time, so the calendar day never shifts.
function formatDueDate(dateStr) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr || '');
  if (!match) return dateStr;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// The backend's speaker heuristic only ever emits "Speaker 1" / "Speaker 2"
// alternating labels — this just extracts the digit for the avatar's
// data-speaker attribute (which style.css keys the avatar color off of).
function speakerNumber(speakerLabel) {
  const match = /(\d+)/.exec(speakerLabel || '');
  return match ? match[1] : '';
}

function speakerInitials(speakerLabel) {
  const number = speakerNumber(speakerLabel);
  if (number) return `S${number}`;
  return (speakerLabel || '?').slice(0, 2).toUpperCase();
}

function renderResultsMeta(meeting) {
  resultsMeta.textContent = `${meeting.title} · ${formatDuration(meeting.durationSec)}`;
}

function renderTranscript(transcript) {
  transcriptList.replaceChildren();

  for (const turn of transcript) {
    const row = document.createElement('li');
    row.className = 'transcript__row';

    const avatar = document.createElement('span');
    avatar.className = 'transcript__avatar';
    avatar.dataset.speaker = speakerNumber(turn.speaker);
    avatar.setAttribute('aria-hidden', 'true');
    avatar.textContent = speakerInitials(turn.speaker);

    const speakerName = document.createElement('span');
    speakerName.className = 'transcript__speaker';
    speakerName.textContent = turn.speaker;

    const time = document.createElement('span');
    time.className = 'transcript__time';
    time.textContent = msToClock(turn.start);

    const meta = document.createElement('div');
    meta.className = 'transcript__meta';
    meta.append(speakerName, time);

    const text = document.createElement('p');
    text.className = 'transcript__text';
    text.textContent = turn.text;

    const body = document.createElement('div');
    body.className = 'transcript__body';
    body.append(meta, text);

    row.append(avatar, body);
    transcriptList.appendChild(row);
  }
}

function renderSummary(summary) {
  summaryText.textContent = summary;
}

function renderDecisions(decisions) {
  decisionsList.replaceChildren();

  for (const decision of decisions) {
    const item = document.createElement('li');
    item.className = 'decisions-list__item';

    const check = document.createElement('span');
    check.className = 'decisions-list__check';
    check.setAttribute('aria-hidden', 'true');
    check.textContent = '✓';

    item.append(check, document.createTextNode(decision));
    decisionsList.appendChild(item);
  }
}

function renderActionItems(actionItems) {
  actionsList.replaceChildren();

  for (const action of actionItems) {
    const item = document.createElement('li');
    item.className = 'actions-list__item';

    const task = document.createElement('div');
    task.className = 'actions-list__task';
    task.textContent = action.task;
    item.appendChild(task);

    if (action.owner || action.dueDate) {
      const meta = document.createElement('div');
      meta.className = 'actions-list__meta';

      if (action.owner) {
        const owner = document.createElement('span');
        owner.className = 'actions-list__owner';
        owner.textContent = action.owner;
        meta.appendChild(owner);
      }

      if (action.dueDate) {
        const due = document.createElement('span');
        due.className = 'actions-list__due';
        due.textContent = `Due ${formatDueDate(action.dueDate)}`;
        meta.appendChild(due);
      }

      item.appendChild(meta);
    }

    actionsList.appendChild(item);
  }
}

function renderMeetingResult(meeting) {
  renderResultsMeta(meeting);
  renderTranscript(meeting.transcript);
  renderSummary(meeting.summary);
  renderDecisions(meeting.decisions);
  renderActionItems(meeting.actionItems);
}

function showResults() {
  resultsSection.hidden = false;
}

function resetResults() {
  resultsMeta.textContent = '';
  transcriptList.replaceChildren();
  summaryText.textContent = '';
  decisionsList.replaceChildren();
  actionsList.replaceChildren();
  resultsSection.hidden = true;
}
