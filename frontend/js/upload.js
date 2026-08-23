// upload.js — drag & drop, click-to-browse, and client-side validation for
// the audio dropzone. Doesn't call the API yet — main.js wires the actual
// upload-triggered request in a later phase.

// The frontend can't read backend/.env, so this has to be kept in sync by
// hand with MAX_UPLOAD_MB in backend/.env.example (currently 50).
const MAX_UPLOAD_MB = 50;
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.webm'];

const dropzone = document.getElementById('dropzone');
const audioInput = document.getElementById('audio-input');
const filePreview = document.getElementById('file-preview');
const filePreviewName = document.getElementById('file-preview-name');
const filePreviewSize = document.getElementById('file-preview-size');
const filePreviewRemove = document.getElementById('file-preview-remove');
const uploadError = document.getElementById('upload-error');
const uploadSubmit = document.getElementById('upload-submit');
const uploadForm = document.getElementById('upload-form');

let selectedFile = null;

function getExtension(filename) {
  const dotIndex = filename.lastIndexOf('.');
  return dotIndex === -1 ? '' : filename.slice(dotIndex).toLowerCase();
}

function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

function validateFile(file) {
  const extension = getExtension(file.name);
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Unsupported file type "${extension || 'unknown'}". Allowed types: mp3, wav, m4a, webm.`;
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `File is too large (${formatFileSize(file.size)}). Max size is ${MAX_UPLOAD_MB}MB.`;
  }
  return null;
}

function clearError() {
  uploadError.hidden = true;
  uploadError.textContent = '';
  dropzone.classList.remove('dropzone--invalid');
}

function showError(message) {
  filePreview.hidden = true;
  uploadSubmit.disabled = true;
  selectedFile = null;
  audioInput.value = '';

  uploadError.textContent = message;
  uploadError.hidden = false;

  // Remove + force a reflow before re-adding, so the shake keyframes
  // restart even if two invalid files are picked back to back.
  dropzone.classList.remove('dropzone--invalid');
  void dropzone.offsetWidth;
  dropzone.classList.add('dropzone--invalid');
}

function showFilePreview(file) {
  filePreviewName.textContent = file.name;
  filePreviewSize.textContent = formatFileSize(file.size);
  filePreview.hidden = false;
  // animateFilePreviewIn() is animations.js's. That file loads after this
  // one, but showFilePreview() only ever runs later, from an event
  // listener — by the time a user can pick a file, every deferred script
  // has already run and animateFilePreviewIn is defined globally.
  animateFilePreviewIn();
}

function handleFile(file) {
  const errorMessage = validateFile(file);
  if (errorMessage) {
    showError(errorMessage);
    return;
  }

  clearError();
  selectedFile = file;
  showFilePreview(file);
  uploadSubmit.disabled = false;
}

function resetSelection() {
  selectedFile = null;
  audioInput.value = '';
  filePreview.hidden = true;
  uploadSubmit.disabled = true;
  clearError();
}

// ---- Click to browse ----

dropzone.addEventListener('click', (event) => {
  // audioInput.click() below dispatches a click that bubbles right back up
  // through this same listener (the input is a descendant of dropzone) —
  // without this guard it would reopen the file picker on every reentrant
  // bubble instead of once per real user click.
  if (event.target === audioInput) return;
  audioInput.click();
});

dropzone.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    audioInput.click();
  }
});

audioInput.addEventListener('change', () => {
  const file = audioInput.files[0];
  if (file) handleFile(file);
});

// ---- Drag and drop ----

dropzone.addEventListener('dragenter', (event) => {
  event.preventDefault();
  dropzone.classList.add('dropzone--dragover');
});

// The `drop` event only fires if dragover's default action (rejecting the
// drop target) is prevented — without this handler, dropping a file never
// fires at all.
dropzone.addEventListener('dragover', (event) => {
  event.preventDefault();
});

dropzone.addEventListener('dragleave', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dropzone--dragover');
});

dropzone.addEventListener('drop', (event) => {
  event.preventDefault();
  dropzone.classList.remove('dropzone--dragover');
  const file = event.dataTransfer.files && event.dataTransfer.files[0];
  if (file) handleFile(file);
});

// ---- Remove selected file ----

filePreviewRemove.addEventListener('click', () => {
  resetSelection();
});

// Prevent the native full-page form submission (GET to the current URL) —
// the real upload request arrives with main.js in a later phase.
uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();
});
