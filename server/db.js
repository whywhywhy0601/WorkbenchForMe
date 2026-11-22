import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedVocabCards } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(ROOT_DIR, 'data');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'workbench.db'));
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  original_name TEXT NOT NULL,
  stored_name TEXT NOT NULL UNIQUE,
  mime TEXT,
  size INTEGER NOT NULL DEFAULT 0,
  ext TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS papers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  authors_json TEXT NOT NULL DEFAULT '[]',
  year INTEGER,
  venue TEXT,
  abstract TEXT,
  citations INTEGER,
  doi TEXT,
  url TEXT,
  pdf_url TEXT,
  language TEXT,
  source TEXT,
  openalex_id TEXT UNIQUE,
  is_domestic INTEGER NOT NULL DEFAULT 0,
  topics_json TEXT NOT NULL DEFAULT '[]',
  keywords_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'unread',
  file_id INTEGER REFERENCES files(id) ON DELETE SET NULL,
  total_pages INTEGER,
  current_page INTEGER NOT NULL DEFAULT 1,
  scroll_ratio REAL NOT NULL DEFAULT 0,
  last_read_at TEXT,
  added_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_papers_status ON papers(status);

CREATE TABLE IF NOT EXISTS annotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id INTEGER NOT NULL REFERENCES papers(id) ON DELETE CASCADE,
  page INTEGER NOT NULL DEFAULT 1,
  color TEXT NOT NULL DEFAULT 'yellow',
  rects_json TEXT NOT NULL DEFAULT '[]',
  text TEXT NOT NULL DEFAULT '',
  comment TEXT,
  type TEXT NOT NULL DEFAULT 'highlight',
  created_at TEXT NOT NULL,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_annotations_paper ON annotations(paper_id);

CREATE TABLE IF NOT EXISTS habits (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracker TEXT NOT NULL,
  date TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(tracker, date)
);

CREATE TABLE IF NOT EXISTS weight_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight REAL NOT NULL,
  body_fat REAL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS water_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  amount INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_water_date ON water_entries(date);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'blue',
  progress INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  file_id INTEGER NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT '未命名笔记',
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS course_checkins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  minutes INTEGER,
  note TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(course_id, date)
);

CREATE TABLE IF NOT EXISTS memos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  pinned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reminders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  notes TEXT,
  due_date TEXT,
  due_time TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  category TEXT,
  completed INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reminders_due ON reminders(due_date);

CREATE TABLE IF NOT EXISTS vocab_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  word TEXT NOT NULL,
  phonetic TEXT,
  meaning TEXT NOT NULL,
  example TEXT,
  example_zh TEXT
);

CREATE TABLE IF NOT EXISTS discovery_cache (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  fetched_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trend_summaries (
  paper_key TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL
);
`);

const DEFAULTS = {
  theme: 'light',
  height_cm: '',
  gender: '',
  birthday: '',
  age: '',
  water_goal_ml: '2000',
};
const insertSetting = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING'
);
for (const [key, value] of Object.entries(DEFAULTS)) insertSetting.run(key, value);

const count = db.prepare('SELECT COUNT(*) AS n FROM vocab_cards').get();
if (Number(count.n) === 0) {
  const insertVocab = db.prepare(
    'INSERT INTO vocab_cards (word, phonetic, meaning, example, example_zh) VALUES (?, ?, ?, ?, ?)'
  );
  for (const card of seedVocabCards) {
    insertVocab.run(card.word, card.phonetic ?? null, card.meaning, card.example ?? null, card.exampleZh ?? null);
  }
}

export function all(sql, ...params) {
  return db.prepare(sql).all(...params);
}

export function get(sql, ...params) {
  return db.prepare(sql).get(...params) ?? null;
}

export function run(sql, ...params) {
  return db.prepare(sql).run(...params);
}

export function transaction(fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function getSettings() {
  const rows = all('SELECT key, value FROM settings');
  const settings = { ...DEFAULTS };
  for (const row of rows) settings[row.key] = row.value;
  return settings;
}

export default db;
