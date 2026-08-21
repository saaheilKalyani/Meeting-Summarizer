const path = require('path');
const express = require('express');
const meetingsRouter = require('./routes/meetings');
const { errorHandler } = require('./middleware/errorHandler');
const { ensureStorageReady } = require('./services/storageService');

const PORT = process.env.PORT || 3000;

ensureStorageReady();

const app = express();

app.use(express.static(path.join(__dirname, '..', 'frontend')));
app.use('/api/meetings', meetingsRouter);

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Meeting Summarizer backend listening on http://localhost:${PORT}`);
});
