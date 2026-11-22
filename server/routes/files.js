import { Router } from 'express';
import fs from 'node:fs';
import { get } from '../db.js';
import { ApiError, parseId, wrapAsync } from '../utils.js';
import { contentTypeFor, storedPath } from '../upload.js';

const router = Router();

router.get(
  '/files/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const record = get('SELECT * FROM files WHERE id = ?', id);
    if (!record) throw new ApiError(404, '文件不存在');
    const filePath = storedPath(record.stored_name);
    if (!fs.existsSync(filePath)) throw new ApiError(404, '文件已从磁盘移除');
    const disposition = req.query.download === '1' ? 'attachment' : 'inline';
    res.setHeader('Content-Type', contentTypeFor(record.ext, record.mime));
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename*=UTF-8''${encodeURIComponent(record.original_name)}`
    );
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.sendFile(filePath, (error) => {
      if (error && !res.headersSent) {
        res.status(500).json({ error: '文件发送失败' });
      }
    });
  })
);

export default router;
