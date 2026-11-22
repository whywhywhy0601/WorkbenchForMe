import { Router } from 'express';
import fs from 'node:fs/promises';
import mammoth from 'mammoth';
import WordExtractor from 'word-extractor';
import { all, get, run } from '../db.js';
import {
  ApiError,
  asInt,
  asNumber,
  asOptionalString,
  asString,
  isSafeRemoteFileUrl,
  mapPaperRow,
  nowIso,
  oneOf,
  parseId,
  safeJsonParse,
  wrapAsync,
} from '../utils.js';
import {
  createFileRecord,
  getFileRecord,
  registerRemoteFile,
  removeFileRecord,
  storedPath,
  uploadPaper,
} from '../upload.js';

const router = Router();
const STATUSES = ['unread', 'reading', 'completed'];
const COLORS = ['yellow', 'green', 'blue', 'pink', 'purple'];

const PAPER_SELECT = `
  SELECT p.*, f.original_name AS file_name, f.ext AS file_ext,
    (SELECT COUNT(*) FROM annotations a WHERE a.paper_id = p.id) AS annotation_count
  FROM papers p
  LEFT JOIN files f ON f.id = p.file_id
`;

function getPaperRow(id) {
  return get(`${PAPER_SELECT} WHERE p.id = ?`, id);
}

function requirePaper(id) {
  const row = getPaperRow(id);
  if (!row) throw new ApiError(404, '文献不存在');
  return row;
}

function stringArray(value, field, max = 30) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, `${field} 必须是数组`);
  return value
    .filter((item) => typeof item === 'string' && item.trim())
    .map((item) => item.trim().slice(0, 300))
    .slice(0, max);
}

function findDuplicate({ openalexId, doi }) {
  if (openalexId) {
    const row = get('SELECT id FROM papers WHERE openalex_id = ?', openalexId);
    if (row) return row.id;
  }
  if (doi) {
    const row = get('SELECT id FROM papers WHERE doi = ?', doi);
    if (row) return row.id;
  }
  return null;
}

function insertPaper(data) {
  const info = run(
    `INSERT INTO papers (
      title, authors_json, year, venue, abstract, citations, doi, url, pdf_url,
      language, source, openalex_id, is_domestic, topics_json, keywords_json,
      status, file_id, added_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    data.title,
    JSON.stringify(data.authors || []),
    data.year ?? null,
    data.venue ?? null,
    data.abstract ?? null,
    data.citations ?? null,
    data.doi ?? null,
    data.url ?? null,
    data.pdfUrl ?? null,
    data.language ?? null,
    data.source ?? 'manual',
    data.openalexId ?? null,
    data.isDomestic ? 1 : 0,
    JSON.stringify(data.topics || []),
    JSON.stringify(data.keywords || []),
    data.status || 'unread',
    data.fileId ?? null,
    nowIso()
  );
  return Number(info.lastInsertRowid);
}

router.get(
  '/papers',
  wrapAsync(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : null;
    if (status && !STATUSES.includes(status)) throw new ApiError(400, '无效的文献状态');
    const rows = status
      ? all(`${PAPER_SELECT} WHERE p.status = ? ORDER BY COALESCE(p.last_read_at, p.added_at) DESC`, status)
      : all(`${PAPER_SELECT} ORDER BY COALESCE(p.last_read_at, p.added_at) DESC`);
    res.json({ papers: rows.map(mapPaperRow) });
  })
);

router.get(
  '/papers/:id',
  wrapAsync(async (req, res) => {
    const paper = mapPaperRow(requirePaper(parseId(req.params.id)));
    res.json(paper);
  })
);

router.post(
  '/papers',
  wrapAsync(async (req, res) => {
    const body = req.body || {};
    const title = asString(body.title, '论文标题', { max: 500 });
    const openalexId = asOptionalString(body.openalexId, { max: 500 });
    const doi = asOptionalString(body.doi, { max: 300 });
    const existingId = findDuplicate({ openalexId, doi });
    if (existingId) {
      res.json({ paper: mapPaperRow(getPaperRow(existingId)), existed: true });
      return;
    }
    const authors = stringArray(body.authors, '作者');
    const topics = stringArray(body.topics, '主题');
    const keywords = stringArray(body.keywords, '关键词');
    const year =
      body.year === undefined || body.year === null || body.year === ''
        ? null
        : asInt(body.year, '年份', { min: 1500, max: 2200 });
    const citations =
      body.citations === undefined || body.citations === null || body.citations === ''
        ? null
        : asInt(body.citations, '引用次数', { min: 0, max: 10000000 });
    const abstract = asOptionalString(body.abstract, { max: 20000 });
    const venue = asOptionalString(body.venue, { max: 300 });
    const language = asOptionalString(body.language, { max: 30 });
    const url = asOptionalString(body.url, { max: 2000 });
    const pdfUrl = asOptionalString(body.pdfUrl, { max: 2000 });
    if (pdfUrl && !isSafeRemoteFileUrl(pdfUrl)) throw new ApiError(400, 'PDF 链接无效');
    const id = insertPaper({
      title,
      authors,
      year,
      venue,
      abstract,
      citations,
      doi,
      url,
      pdfUrl,
      language,
      topics,
      keywords,
      source: asOptionalString(body.source, { max: 60 }) || 'manual',
      openalexId,
      isDomestic: Boolean(body.isDomestic),
    });
    res.status(201).json({ paper: mapPaperRow(getPaperRow(id)), existed: false });
  })
);

router.patch(
  '/papers/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    requirePaper(id);
    const body = req.body || {};
    const updates = [];
    const params = [];
    if (body.status !== undefined) {
      const status = oneOf(body.status, STATUSES, '文献状态');
      updates.push('status = ?');
      params.push(status);
      updates.push('last_read_at = ?');
      params.push(nowIso());
    }
    if (body.currentPage !== undefined) {
      updates.push('current_page = ?');
      params.push(asInt(body.currentPage, '当前页码', { min: 1, max: 100000 }));
    }
    if (body.totalPages !== undefined) {
      const pages = body.totalPages === null ? null : asInt(body.totalPages, '总页数', { min: 1, max: 100000 });
      updates.push('total_pages = ?');
      params.push(pages);
    }
    if (body.scrollRatio !== undefined) {
      updates.push('scroll_ratio = ?');
      params.push(asNumber(body.scrollRatio, '阅读位置', { min: 0, max: 1 }));
    }
    if (!updates.length) throw new ApiError(400, '没有需要更新的内容');
    params.push(id);
    run(`UPDATE papers SET ${updates.join(', ')} WHERE id = ?`, ...params);
    res.json(mapPaperRow(getPaperRow(id)));
  })
);

router.delete(
  '/papers/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const paper = requirePaper(id);
    run('DELETE FROM papers WHERE id = ?', id);
    if (paper.file_id) removeFileRecord(paper.file_id);
    res.json({ ok: true });
  })
);

router.post(
  '/papers/upload',
  uploadPaper.single('file'),
  wrapAsync(async (req, res) => {
    if (!req.file) throw new ApiError(400, '请选择要上传的文件');
    const record = createFileRecord(req.file);
    const fallbackTitle = record.originalName.replace(/\.[^.]+$/, '');
    let title = fallbackTitle;
    try {
      title = asString(req.body.title, '标题', { max: 500, required: false }) || fallbackTitle;
    } catch {
      title = fallbackTitle;
    }
    const id = insertPaper({
      title,
      authors: [],
      source: 'upload',
      fileId: record.id,
      language: record.ext === '.txt' || record.ext === '.doc' || record.ext === '.docx' ? 'zh' : null,
    });
    res.status(201).json({ paper: mapPaperRow(getPaperRow(id)) });
  })
);

router.post(
  '/papers/:id/file',
  uploadPaper.single('file'),
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const paper = requirePaper(id);
    if (!req.file) throw new ApiError(400, '请选择要上传的文件');
    const record = createFileRecord(req.file);
    run('UPDATE papers SET file_id = ?, total_pages = NULL WHERE id = ?', record.id, id);
    if (paper.file_id) removeFileRecord(paper.file_id);
    res.json(mapPaperRow(getPaperRow(id)));
  })
);

async function downloadWithLimit(url, maxBytes) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh) MyWorkspace/1.0',
      Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.5',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new ApiError(502, `原文下载失败（HTTP ${response.status}）`);
  if (!isSafeRemoteFileUrl(response.url)) {
    throw new ApiError(400, '下载跳转到了不安全的地址，已阻止');
  }
  const contentLength = Number(response.headers.get('content-length') || 0);
  if (contentLength && contentLength > maxBytes) {
    throw new ApiError(413, '原文文件超过 50MB 限制');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new ApiError(502, '原文下载失败：响应为空');
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ApiError(413, '原文文件超过 50MB 限制');
    }
    chunks.push(Buffer.from(value));
  }
  return { buffer: Buffer.concat(chunks), contentType: response.headers.get('content-type') || '' };
}

router.post(
  '/papers/:id/fetch-pdf',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const paper = requirePaper(id);
    if (!paper.pdf_url) throw new ApiError(400, '这篇文献没有可用的开放获取 PDF 链接');
    if (!isSafeRemoteFileUrl(paper.pdf_url)) throw new ApiError(400, 'PDF 链接不安全，已阻止下载');
    if (paper.file_id) {
      res.json({ paper: mapPaperRow(paper), alreadyAttached: true });
      return;
    }
    let downloaded;
    try {
      downloaded = await downloadWithLimit(paper.pdf_url, 50 * 1024 * 1024);
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError(502, `原文下载失败：${error.message}`);
    }
    const isPdf =
      downloaded.contentType.toLowerCase().includes('application/pdf') ||
      downloaded.buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    if (!isPdf) {
      throw new ApiError(422, '该链接返回的不是 PDF 文件，请手动上传原文');
    }
    const fileName = `${paper.title.slice(0, 80) || 'paper'}.pdf`;
    const fileId = registerRemoteFile({
      filename: fileName.replace(/[\\/:*?"<>|]/g, '_'),
      mime: 'application/pdf',
      ext: '.pdf',
      buffer: downloaded.buffer,
    });
    run('UPDATE papers SET file_id = ? WHERE id = ?', fileId, id);
    if (paper.file_id) removeFileRecord(paper.file_id);
    res.json({ paper: mapPaperRow(getPaperRow(id)), downloaded: true });
  })
);

router.get(
  '/papers/:id/content',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const paper = requirePaper(id);
    if (!paper.file_id) throw new ApiError(400, '这篇文献还没有上传原文');
    const file = getFileRecord(paper.file_id);
    if (!file) throw new ApiError(404, '原文文件丢失');
    const filePath = storedPath(file.stored_name);
    const ext = file.ext;
    if (ext === '.md' || ext === '.markdown') {
      const content = await fs.readFile(filePath, 'utf8');
      res.json({ type: 'markdown', content, name: file.original_name });
      return;
    }
    if (ext === '.txt') {
      const content = await fs.readFile(filePath, 'utf8');
      res.json({ type: 'text', content, name: file.original_name });
      return;
    }
    if (ext === '.docx') {
      try {
        const result = await mammoth.convertToHtml(
          { path: filePath },
          {
            convertImage: mammoth.images.imgElement(async (image) => {
              const buffer = await image.read();
              const base64 = buffer.toString('base64');
              return { src: `data:${image.contentType};base64,${base64}` };
            }),
          }
        );
        res.json({ type: 'html', content: result.value, name: file.original_name });
      } catch (error) {
        throw new ApiError(422, `Word 文档解析失败：${error.message}`);
      }
      return;
    }
    if (ext === '.doc') {
      try {
        const extractor = new WordExtractor();
        const doc = await extractor.extract(filePath);
        res.json({ type: 'text', content: doc.getBody(), name: file.original_name });
      } catch (error) {
        throw new ApiError(422, `旧版 Word 文档解析失败：${error.message}`);
      }
      return;
    }
    if (ext === '.pdf') {
      throw new ApiError(400, 'PDF 请通过 PDF 阅读器打开');
    }
    throw new ApiError(400, '该文件类型暂不支持在线阅读');
  })
);

router.get(
  '/papers/:id/annotations',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    requirePaper(id);
    const rows = all(
      'SELECT * FROM annotations WHERE paper_id = ? ORDER BY page ASC, created_at ASC',
      id
    );
    res.json({
      annotations: rows.map((row) => ({
        id: row.id,
        paperId: row.paper_id,
        page: row.page,
        color: row.color,
        rects: safeJsonParse(row.rects_json, []),
        text: row.text,
        comment: row.comment,
        type: row.type,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      })),
    });
  })
);

function parseRects(value) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ApiError(400, '高亮区域格式无效');
  if (value.length > 400) throw new ApiError(400, '选区过于零碎，请重新选择');
  return value.map((rect) => {
    const x = Number(rect?.x);
    const y = Number(rect?.y);
    const w = Number(rect?.w);
    const h = Number(rect?.h);
    if (![x, y, w, h].every(Number.isFinite)) throw new ApiError(400, '高亮区域格式无效');
    return {
      x: Math.min(Math.max(x, 0), 1),
      y: Math.min(Math.max(y, 0), 1),
      w: Math.min(Math.max(w, 0.0001), 1),
      h: Math.min(Math.max(h, 0.0001), 1),
    };
  });
}

router.post(
  '/papers/:id/annotations',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    requirePaper(id);
    const body = req.body || {};
    const page = asInt(body.page, '页码', { min: 1, max: 100000, fallback: 1 });
    const color = oneOf(body.color || 'yellow', COLORS, '高亮颜色');
    const type = oneOf(body.type || 'highlight', ['highlight', 'note'], '批注类型');
    const rects = parseRects(body.rects);
    const text = asOptionalString(body.text, { max: 5000 }) || '';
    const comment = asOptionalString(body.comment, { max: 3000 });
    const now = nowIso();
    const info = run(
      `INSERT INTO annotations (paper_id, page, color, rects_json, text, comment, type, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      page,
      color,
      JSON.stringify(rects),
      text,
      comment,
      type,
      now
    );
    res.status(201).json({
      id: Number(info.lastInsertRowid),
      paperId: id,
      page,
      color,
      rects,
      text,
      comment,
      type,
      createdAt: now,
      updatedAt: null,
    });
  })
);

router.patch(
  '/annotations/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT * FROM annotations WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '批注不存在');
    const body = req.body || {};
    const updates = [];
    const params = [];
    if (body.comment !== undefined) {
      updates.push('comment = ?');
      params.push(asOptionalString(body.comment, { max: 3000 }));
    }
    if (body.color !== undefined) {
      updates.push('color = ?');
      params.push(oneOf(body.color, COLORS, '高亮颜色'));
    }
    if (!updates.length) throw new ApiError(400, '没有需要更新的内容');
    updates.push('updated_at = ?');
    params.push(nowIso());
    params.push(id);
    run(`UPDATE annotations SET ${updates.join(', ')} WHERE id = ?`, ...params);
    const row = get('SELECT * FROM annotations WHERE id = ?', id);
    res.json({
      id: row.id,
      paperId: row.paper_id,
      page: row.page,
      color: row.color,
      rects: safeJsonParse(row.rects_json, []),
      text: row.text,
      comment: row.comment,
      type: row.type,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  })
);

router.delete(
  '/annotations/:id',
  wrapAsync(async (req, res) => {
    const id = parseId(req.params.id);
    const existing = get('SELECT id FROM annotations WHERE id = ?', id);
    if (!existing) throw new ApiError(404, '批注不存在');
    run('DELETE FROM annotations WHERE id = ?', id);
    res.json({ ok: true });
  })
);

export default router;
