import { Router } from 'express';
import { all, get, run } from '../db.js';
import {
  ApiError,
  asOptionalString,
  asString,
  nowIso,
  parseId,
  wrapAsync,
} from '../utils.js';

const router = Router();

function mapMemo(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    pinned: Boolean(row.pinned),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

router.get(
  '/memos',
  wrapAsync(async (req, res) => {
    const query = req.query.q ? String(req.query.q).trim() : '';
    let rows;
    if (query) {
      const like = `%${query}%`;
      rows = all(
        `SELECT * FROM memos WHERE title LIKE ? OR content LIKE ?
         ORDER BY pinned DESC, updated_at DESC LIMIT 200`,
        like,
        like
      );
    } else {
      rows = all('SELECT * FROM memos ORDER BY pinned DESC, updated_at DESC LIMIT 500');
    }
    res.json({ memos: rows.map(mapMemo) });
  })
);

router.post(
  '/memos',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const title = asString(body.title, '标题', { max: 300, required: false });
    const content = typeof body.content === 'string' ? body.content.slice(0, 200000) : '';
    const now = nowIso();
    const info = run(
      'INSERT INTO memos (title, content, created_at, updated_at) VALUES (?, ?, ?, ?)',
      title,
      content,
      now,
      now
    );
    const row = get('SELECT * FROM memos WHERE id = ?', Number(info.lastInsertRowid));
    res.status(201).json({ memo: mapMemo(row) });
  })
);

router.patch(
  '/memos/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT * FROM memos WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '备忘录不存在');
    const body = req.body || {};
    const title =
      body.title === undefined
        ? existing.title
        : asString(body.title, '标题', { max: 300, required: false });
    const content =
      body.content === undefined ? existing.content : String(body.content).slice(0, 200000);
    const pinned =
      body.pinned === undefined ? existing.pinned : body.pinned ? 1 : 0;
    const updatedAt = nowIso();
    run(
      'UPDATE memos SET title = ?, content = ?, pinned = ?, updated_at = ? WHERE id = ?',
      title,
      content,
      pinned,
      updatedAt,
      id
    );
    const row = get('SELECT * FROM memos WHERE id = ?', id);
    res.json({ memo: mapMemo(row) });
  })
);

router.delete(
  '/memos/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT id FROM memos WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '备忘录不存在');
    run('DELETE FROM memos WHERE id = ?', id);
    res.json({ ok: true });
  })
);

export default router;
