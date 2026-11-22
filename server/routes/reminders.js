import { Router } from 'express';
import { all, get, run } from '../db.js';
import {
  ApiError,
  asOptionalString,
  asString,
  isValidDateString,
  nowIso,
  oneOf,
  parseId,
  wrapAsync,
} from '../utils.js';

const router = Router();
const PRIORITIES = ['high', 'medium', 'low'];

function mapReminder(row) {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    dueDate: row.due_date,
    dueTime: row.due_time,
    priority: row.priority,
    category: row.category,
    completed: Boolean(row.completed),
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (!isValidDateString(value)) throw new ApiError(400, '截止日期格式无效');
  return value;
}

function parseDueTime(value) {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new ApiError(400, '提醒时间格式无效（HH:MM）');
  }
  return value;
}

router.get(
  '/reminders',
  wrapAsync(async (_req, res) => {
    const rows = all(
      `SELECT * FROM reminders
       ORDER BY completed ASC,
         CASE WHEN completed = 0 THEN
           CASE WHEN due_date IS NULL THEN 1 ELSE 0 END
         ELSE 0 END,
         due_date ASC,
         due_time ASC,
         created_at DESC
       LIMIT 1000`
    );
    res.json({ reminders: rows.map(mapReminder) });
  })
);

router.post(
  '/reminders',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const title = asString(body.title, '提醒事项', { max: 300 });
    const notes = asOptionalString(body.notes, { max: 5000 });
    const dueDate = parseDueDate(body.dueDate) ?? null;
    const dueTime = parseDueTime(body.dueTime) ?? null;
    const priority = oneOf(body.priority || 'medium', PRIORITIES, '优先级');
    const category = asOptionalString(body.category, { max: 40 });
    const now = nowIso();
    const info = run(
      `INSERT INTO reminders (title, notes, due_date, due_time, priority, category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      title,
      notes,
      dueDate,
      dueTime,
      priority,
      category,
      now,
      now
    );
    const row = get('SELECT * FROM reminders WHERE id = ?', Number(info.lastInsertRowid));
    res.status(201).json({ reminder: mapReminder(row) });
  })
);

router.patch(
  '/reminders/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT * FROM reminders WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '提醒事项不存在');
    const body = req.body || {};
    const updates = [];
    const params = [];
    if (body.title !== undefined) {
      updates.push('title = ?');
      params.push(asString(body.title, '提醒事项', { max: 300 }));
    }
    if (body.notes !== undefined) {
      updates.push('notes = ?');
      params.push(asOptionalString(body.notes, { max: 5000 }));
    }
    const dueDate = parseDueDate(body.dueDate);
    if (dueDate !== undefined) {
      updates.push('due_date = ?');
      params.push(dueDate);
    }
    const dueTime = parseDueTime(body.dueTime);
    if (dueTime !== undefined) {
      updates.push('due_time = ?');
      params.push(dueTime);
    }
    if (body.priority !== undefined) {
      updates.push('priority = ?');
      params.push(oneOf(body.priority, PRIORITIES, '优先级'));
    }
    if (body.category !== undefined) {
      updates.push('category = ?');
      params.push(asOptionalString(body.category, { max: 40 }));
    }
    if (body.completed !== undefined) {
      const completed = Boolean(body.completed);
      updates.push('completed = ?', 'completed_at = ?');
      params.push(completed ? 1 : 0, completed ? nowIso() : null);
    }
    if (!updates.length) throw new ApiError(400, '没有需要更新的内容');
    updates.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    run(`UPDATE reminders SET ${updates.join(', ')} WHERE id = ?`, ...params);
    const row = get('SELECT * FROM reminders WHERE id = ?', id);
    res.json({ reminder: mapReminder(row) });
  })
);

router.delete(
  '/reminders/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT id FROM reminders WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '提醒事项不存在');
    run('DELETE FROM reminders WHERE id = ?', id);
    res.json({ ok: true });
  })
);

export default router;
