const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'meetings.json');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

function ensureStorageReady() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]\n', 'utf8');
  }
}

function readMeetings() {
  ensureStorageReady();
  const raw = fs.readFileSync(DATA_FILE, 'utf8');
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function writeMeetings(meetings) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(meetings, null, 2), 'utf8');
}

function saveMeeting(meeting) {
  const meetings = readMeetings();
  meetings.push(meeting);
  writeMeetings(meetings);
  return meeting;
}

function listMeetings() {
  return readMeetings().map(({ id, title, createdAt, durationSec }) => ({
    id,
    title,
    createdAt,
    durationSec,
  }));
}

function getMeetingById(id) {
  return readMeetings().find((meeting) => meeting.id === id) || null;
}

module.exports = {
  UPLOADS_DIR,
  ensureStorageReady,
  saveMeeting,
  listMeetings,
  getMeetingById,
};
