// main.js — state object + orchestration. The final piece wiring
// upload.js, api.js, render.js, animations.js, and pastMeetings.js
// together into the real upload -> process -> result flow.

// status: 'idle' | 'file-selected' | 'processing' | 'done' | 'error'.
// 'file-selected' is part of the vocabulary but isn't actively pushed into
// here from an event listener of its own — upload.js already owns and
// visually reflects that sub-state (enabled submit button + visible file
// preview) on its own. main.js's job starts at the submit boundary.
const state = {
  status: 'idle',
  file: null,
  result: null,
  errorMessage: null,
};

const uploadSection = document.getElementById('upload');
const uploadFormEl = document.getElementById('upload-form');
const processingSection = document.getElementById('processing');
const equalizerEl = processingSection.querySelector('.equalizer');
const processingStatus = document.getElementById('processing-status');

const PROCESSING_PHASES = [
  'Uploading audio…',
  'Transcribing speech…',
  'Splitting speaker turns…',
  'Summarizing…',
];

let processingIntervalId = null;

function startProcessingCycle() {
  let phaseIndex = 0;
  processingStatus.textContent = PROCESSING_PHASES[phaseIndex];
  processingIntervalId = setInterval(() => {
    phaseIndex = (phaseIndex + 1) % PROCESSING_PHASES.length;
    processingStatus.textContent = PROCESSING_PHASES[phaseIndex];
  }, 4000);
}

function stopProcessingCycle() {
  if (processingIntervalId !== null) {
    clearInterval(processingIntervalId);
    processingIntervalId = null;
  }
}

// Built once, appended into #processing. Nothing in index.html already
// fits a "submission failed" state — #upload-error is specifically for
// client-side file validation, scoped to the upload form.
const errorBlock = document.createElement('div');
errorBlock.className = 'processing-error';
errorBlock.hidden = true;

const errorMessageEl = document.createElement('p');
errorMessageEl.className = 'upload-error';
errorMessageEl.setAttribute('role', 'alert');

const retryButton = document.createElement('button');
retryButton.type = 'button';
retryButton.className = 'btn btn--primary';
retryButton.textContent = 'Try again';
retryButton.addEventListener('click', handleTryAgain);

errorBlock.append(errorMessageEl, retryButton);
processingSection.appendChild(errorBlock);

function showProcessingSpinner() {
  errorBlock.hidden = true;
  equalizerEl.hidden = false;
  processingStatus.hidden = false;
}

function showProcessingError(message) {
  equalizerEl.hidden = true;
  processingStatus.hidden = true;
  errorMessageEl.textContent = message;
  errorBlock.hidden = false;
}

function handleTryAgain() {
  // Deliberately doesn't call upload.js's resetSelection() — keeping the
  // same file selected means the user can retry without re-picking it.
  state.status = 'idle';
  state.errorMessage = null;
  processingSection.hidden = true;
  uploadSection.hidden = false;
}

async function handleUploadSubmit() {
  // upload.js's own submit listener (registered first, since that file
  // loads before this one) already calls preventDefault() — this listener
  // just adds the actual request on top of that.
  if (!selectedFile) return;

  state.status = 'processing';
  state.file = selectedFile;
  state.errorMessage = null;

  uploadSection.hidden = true;
  showProcessingSpinner();
  processingSection.hidden = false;
  startProcessingCycle();

  try {
    const meeting = await createMeeting(selectedFile);
    stopProcessingCycle();

    state.status = 'done';
    state.result = meeting;

    processingSection.hidden = true;
    uploadSection.hidden = false;
    resetSelection();

    renderMeetingResult(meeting);
    showResults();
    animateResultsIn();
    document.getElementById('results').scrollIntoView({ block: 'start' });

    loadPastMeetings();
  } catch (err) {
    stopProcessingCycle();
    state.status = 'error';
    state.errorMessage = err.message;
    showProcessingError(err.message);
  }
}

function init() {
  processingSection.hidden = true;
  resetResults();
  uploadFormEl.addEventListener('submit', handleUploadSubmit);
}

document.addEventListener('DOMContentLoaded', init);
