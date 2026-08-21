const express = require('express');
const upload = require('../middleware/upload');
const { ValidationError } = require('../middleware/errorHandler');
const { transcribeAudio } = require('../services/transcriptionService');
const { generateSummary } = require('../services/summaryService');
const { saveMeeting, listMeetings, getMeetingById } = require('../services/storageService');

const router = express.Router();

router.post('/', upload.single('audio'), async (req, res, next) => {
  try {
    if (!req.file) {
      throw new ValidationError('No audio file was uploaded. Attach a file under the "audio" field.');
    }

    const { transcript, durationSec } = await transcribeAudio(req.file.path);
    const { summary, decisions, actionItems } = await generateSummary(transcript);

    const meeting = {
      id: req.meetingId,
      title: `Meeting on ${new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}`,
      createdAt: new Date().toISOString(),
      durationSec,
      transcript,
      summary,
      decisions,
      actionItems,
    };

    saveMeeting(meeting);
    res.status(200).json(meeting);
  } catch (err) {
    next(err);
  }
});

router.get('/', (req, res) => {
  res.status(200).json(listMeetings());
});

router.get('/:id', (req, res) => {
  const meeting = getMeetingById(req.params.id);
  if (!meeting) {
    return res.status(404).json({ error: 'Meeting not found.' });
  }
  res.status(200).json(meeting);
});

module.exports = router;
