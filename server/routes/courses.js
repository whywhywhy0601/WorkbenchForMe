import { Router } from 'express';
import { all, get, run } from '../db.js';
import {
  ApiError,
  asInt,
  asOptionalString,
  asString,
  computeHabitStats,
  localDateString,
  nowIso,
  oneOf,
  parseId,
  requireDateString,
  wrapAsync,
} from '../utils.js';
import {
  createFileRecord,
  removeFileRecord,
  uploadStudy,
} from '../upload.js';

const router = Router();
const COLORS = ['blue', 'purple', 'pink', 'orange', 'green', 'teal'];

const COURSE_SELECT = `
  SELECT c.*,
    (SELECT COUNT(*) FROM course_files cf WHERE cf.course_id = c.id) AS file_count,
    (SELECT COUNT(*) FROM course_notes n WHERE n.course_id = c.id) AS note_count,
    (SELECT COUNT(*) FROM course_checkins k WHERE k.course_id = c.id) AS checkin_count,
    (SELECT MAX(k.date) FROM course_checkins k WHERE k.course_id = c.id) AS last_studied
  FROM courses c
`;

function mapCourse(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    color: row.color,
    progress: row.progress,
    archived: Boolean(row.archived),
    createdAt: row.created_at,
    fileCount: Number(row.file_count || 0),
    noteCount: Number(row.note_count || 0),
    checkinCount: Number(row.checkin_count || 0),
    lastStudied: row.last_studied || null,
  };
}

function getCourse(id) {
  const row = get(`${COURSE_SELECT} WHERE c.id = ?`, id);
  if (!row) throw new ApiError(404, '课程不存在');
  return row;
}

function courseFiles(courseId) {
  return all(
    `SELECT cf.id AS link_id, cf.created_at AS linked_at, f.id AS file_id,
       f.original_name, f.ext, f.size, f.mime, f.created_at
     FROM course_files cf JOIN files f ON f.id = cf.file_id
     WHERE cf.course_id = ? ORDER BY cf.created_at DESC`,
    courseId
  ).map((row) => ({
    linkId: row.link_id,
    fileId: row.file_id,
    name: row.original_name,
    ext: row.ext,
    size: row.size,
    mime: row.mime,
    createdAt: row.created_at,
    url: `/api/files/${row.file_id}`,
  }));
}

function courseNotes(courseId) {
  return all(
    'SELECT * FROM course_notes WHERE course_id = ? ORDER BY updated_at DESC',
    courseId
  ).map((row) => ({
    id: row.id,
    courseId: row.course_id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

function mapCheckin(row) {
  return {
    id: row.id,
    courseId: row.course_id,
    date: row.date,
    minutes: row.minutes,
    note: row.note,
    createdAt: row.created_at,
  };
}

function checkinStats(checkins) {
  const dates = checkins.map((checkin) => checkin.date);
  return {
    ...computeHabitStats(dates, localDateString()),
    totalMinutes: checkins.reduce((sum, checkin) => sum + (checkin.minutes || 0), 0),
  };
}

function courseCheckins(courseId) {
  return all(
    'SELECT * FROM course_checkins WHERE course_id = ? ORDER BY date ASC',
    courseId
  ).map(mapCheckin);
}

router.get(
  '/courses',
  wrapAsync(async (_req, res) => {
    const rows = all(`${COURSE_SELECT} WHERE c.archived = 0 ORDER BY c.created_at DESC`);
    res.json({ courses: rows.map(mapCourse) });
  })
);

router.get(
  '/courses/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const row = getCourse(id);
    const checkins = courseCheckins(id);
    res.json({
      course: mapCourse(row),
      files: courseFiles(id),
      notes: courseNotes(id),
      checkins,
      stats: checkinStats(checkins),
    });
  })
);

router.post(
  '/courses',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const name = asString(body.name, '课程名称', { max: 120 });
    const description = asOptionalString(body.description, { max: 2000 });
    const color = oneOf(body.color || 'blue', COLORS, '课程颜色');
    const progress =
      body.progress === undefined ? 0 : asInt(body.progress, '学习进度', { min: 0, max: 100 });
    const info = run(
      'INSERT INTO courses (name, description, color, progress, created_at) VALUES (?, ?, ?, ?, ?)',
      name,
      description,
      color,
      progress,
      nowIso()
    );
    const row = getCourse(Number(info.lastInsertRowid));
    res.status(201).json({ course: mapCourse(row) });
  })
);

router.patch(
  '/courses/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    getCourse(id);
    const body = req.body || {};
    const updates = [];
    const params = [];
    if (body.name !== undefined) {
      updates.push('name = ?');
      params.push(asString(body.name, '课程名称', { max: 120 }));
    }
    if (body.description !== undefined) {
      updates.push('description = ?');
      params.push(asOptionalString(body.description, { max: 2000 }));
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      params.push(oneOf(body.color, COLORS, '课程颜色'));
    }
    if (body.progress !== undefined) {
      updates.push('progress = ?');
      params.push(asInt(body.progress, '学习进度', { min: 0, max: 100 }));
    }
    if (!updates.length) throw new ApiError(400, '没有需要更新的内容');
    params.push(id);
    run(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, ...params);
    res.json({ course: mapCourse(getCourse(id)) });
  })
);

router.delete(
  '/courses/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    getCourse(id);
    const fileIds = all('SELECT file_id FROM course_files WHERE course_id = ?', id).map(
      (row) => row.file_id
    );
    run('DELETE FROM courses WHERE id = ?', id);
    for (const fileId of fileIds) removeFileRecord(fileId);
    res.json({ ok: true });
  })
);

router.post(
  '/courses/:id/files',
  uploadStudy.single('file'),
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    getCourse(id);
    if (!req.file) throw new ApiError(400, '请选择要上传的文件');
    const record = createFileRecord(req.file);
    const link = run(
      'INSERT INTO course_files (course_id, file_id, created_at) VALUES (?, ?, ?)',
      id,
      record.id,
      nowIso()
    );
    res.status(201).json({
      linkId: Number(link.lastInsertRowid),
      files: courseFiles(id),
    });
  })
);

router.delete(
  '/courses/:id/files/:linkId',
  wrapAsync(async (req, res) => {
    const courseId = parseId(req.params.id);
    const linkId = parseId(req.params.linkId);
    const link = get('SELECT * FROM course_files WHERE id = ? AND course_id = ?', linkId, courseId);
    if (!link) throw new ApiError(404, '课程资料不存在');
    run('DELETE FROM course_files WHERE id = ?', linkId);
    removeFileRecord(link.file_id);
    res.json({ files: courseFiles(courseId) });
  })
);

router.post(
  '/courses/:id/notes',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    getCourse(id);
    const body = req.body || {};
    const title = asString(body.title, '笔记标题', { max: 200, required: false }) || '未命名笔记';
    const content = typeof body.content === 'string' ? body.content.slice(0, 200000) : '';
    const now = nowIso();
    const info = run(
      'INSERT INTO course_notes (course_id, title, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      id,
      title,
      content,
      now,
      now
    );
    res.status(201).json({ note: courseNotes(id).find((note) => note.id === Number(info.lastInsertRowid)) });
  })
);

router.patch(
  '/course-notes/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT * FROM course_notes WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '笔记不存在');
    const body = req.body || {};
    const title =
      body.title === undefined
        ? existing.title
        : asString(body.title, '笔记标题', { max: 200, required: false }) || '未命名笔记';
    const content =
      body.content === undefined ? existing.content : String(body.content).slice(0, 200000);
    const updatedAt = nowIso();
    run(
      'UPDATE course_notes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
      title,
      content,
      updatedAt,
      id
    );
    res.json({
      note: {
        id,
        courseId: existing.course_id,
        title,
        content,
        createdAt: existing.created_at,
        updatedAt,
      },
    });
  })
);

router.delete(
  '/course-notes/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT id FROM course_notes WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '笔记不存在');
    run('DELETE FROM course_notes WHERE id = ?', id);
    res.json({ ok: true });
  })
);

router.put(
  '/courses/:id/checkins/:date',
  wrapAsync(async (req, res) => {
    const courseId = parseId(req.params.id);
    getCourse(courseId);
    const date = requireDateString(req.params.date);
    if (date > localDateString()) throw new ApiError(400, '不能为未来日期打卡');
    const checked = req.body?.checked !== false;
    if (checked) {
      let minutes = null;
      if (req.body?.minutes !== undefined && req.body?.minutes !== null && req.body?.minutes !== '') {
        minutes = asInt(req.body.minutes, '学习分钟数', { min: 0, max: 1440 });
      }
      const note =
        req.body?.note === undefined || req.body?.note === null
          ? null
          : String(req.body.note).slice(0, 500);
      run(
        `INSERT INTO course_checkins (course_id, date, minutes, note, created_at) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(course_id, date) DO UPDATE SET minutes = excluded.minutes, note = excluded.note`,
        courseId,
        date,
        minutes,
        note,
        nowIso()
      );
    } else {
      run('DELETE FROM course_checkins WHERE course_id = ? AND date = ?', courseId, date);
    }
    const checkins = courseCheckins(courseId);
    res.json({ checkins, stats: checkinStats(checkins) });
  })
);

export default router;
