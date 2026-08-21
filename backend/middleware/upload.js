const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const { ValidationError } = require('./errorHandler');
const { UPLOADS_DIR } = require('../services/storageService');

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB) || 50;

const ALLOWED_EXTENSIONS = new Set(['.mp3', '.wav', '.m4a', '.webm']);
const ALLOWED_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/webm',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const id = crypto.randomUUID();
    req.meetingId = id;
    cb(null, `${id}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  const extOk = ALLOWED_EXTENSIONS.has(ext);
  // Some OS/client combinations can't map less common audio extensions to a
  // proper MIME type and fall back to a generic binary type. Extension is the
  // authoritative signal here; the MIME check just guards against an obvious
  // mismatch (e.g. a .txt or .png masquerading as audio).
  const mimeOk = ALLOWED_MIME_TYPES.has(file.mimetype) || file.mimetype === 'application/octet-stream';

  if (!extOk || !mimeOk) {
    return cb(new ValidationError(
      `Unsupported audio file type: "${file.originalname}" (${file.mimetype}). Allowed types: mp3, wav, m4a, webm.`,
    ));
  }

  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024 },
});

module.exports = upload;
