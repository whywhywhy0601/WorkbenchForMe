import { Router } from 'express';
import { all } from '../db.js';
import { localDateString, wrapAsync } from '../utils.js';

const router = Router();

const TABLES = [
  'papers',
  'annotations',
  'habits',
  'weight_entries',
  'water_entries',
  'courses',
  'course_files',
  'course_notes',
  'course_checkins',
  'memos',
  'reminders',
  'files',
  'settings',
];

router.get(
  '/export',
  wrapAsync(async (_req, res) => {
    const data = {
      app: 'My Workspace',
      version: 1,
      exportedAt: new Date().toISOString(),
    };
    for (const table of TABLES) {
      data[table] = all(`SELECT * FROM ${table}`);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="workbench-backup-${localDateString()}.json"`
    );
    res.send(JSON.stringify(data, null, 2));
  })
);

export default router;
