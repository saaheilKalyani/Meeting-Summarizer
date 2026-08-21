const multer = require('multer');

class ValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
  }
}

class TranscriptionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TranscriptionError';
  }
}

class SummaryGenerationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SummaryGenerationError';
  }
}

// Express only recognizes this as error-handling middleware because it takes 4 args.
function errorHandler(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? `Audio file is too large. Max size is ${process.env.MAX_UPLOAD_MB || 50}MB.`
      : err.message;
    return res.status(400).json({ error: message });
  }

  if (err instanceof ValidationError) {
    return res.status(400).json({ error: err.message });
  }

  if (err instanceof TranscriptionError || err instanceof SummaryGenerationError) {
    return res.status(502).json({ error: err.message });
  }

  console.error(err);
  return res.status(500).json({ error: 'Something went wrong while processing the meeting.' });
}

module.exports = { errorHandler, ValidationError, TranscriptionError, SummaryGenerationError };
