import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { UPLOAD_DIR, all, get, run } from './db.js';
import { ApiError, decodeFileName, extensionOf, nowIso } from './utils.js';

const PAPER_EXTS = new Set(['.pdf', '.doc', '.docx', '.md', '.markdown', '.txt']);
const STUDY_EXTS = new Set([
  ...PAPER_EXTS,
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ppt',
  '.pptx',
  '.xls',
  '.xlsx',
  '.csv',
  '.zip',
  '.epub',
]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    cb(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`);
  },
});

export const uploadStudy = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!STUDY_EXTS.has(ext)) {
      cb(new ApiError(400, `不支持的文件格式：${ext || '未知'}`));
      return;
    }
    cb(null, true);
  },
});

export const uploadPaper = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = extensionOf(file.originalname);
    if (!PAPER_EXTS.has(ext)) {
      cb(new ApiError(400, '论文仅支持 PDF / Word / Markdown / TXT'));
      return;
    }
    cb(null, true);
  },
});

export const uploadAny = uploadStudy;

export function createFileRecord(file) {
  const originalName = decodeFileName(file.originalname);
  const ext = extensionOf(originalName);
  const info = run(
    `INSERT INTO files (original_name, stored_name, mime, size, ext, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    originalName,
    file.filename,
    file.mimetype || null,
    file.size,
    ext,
    nowIso()
  );
  return {
    id: Number(info.lastInsertRowid),
    originalName,
    storedName: file.filename,
    mime: file.mimetype,
    size: file.size,
    ext,
  };
}

export function getFileRecord(id) {
  return get('SELECT * FROM files WHERE id = ?', id);
}

export function storedPath(storedName) {
  return path.join(UPLOAD_DIR, path.basename(storedName));
}

export function removeFileRecord(id) {
  const record = getFileRecord(id);
  if (!record) return;
  // A paper attachment and a course attachment are separate records; the same
  // record is never shared, so it is safe to remove the row and the file.
  run('DELETE FROM files WHERE id = ?', id);
  fs.rm(storedPath(record.stored_name), { force: true }, () => {});
}

export function registerRemoteFile({ filename, mime, ext, buffer }) {
  const storedName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
  fs.writeFileSync(path.join(UPLOAD_DIR, storedName), buffer);
  const originalName = filename || storedName;
  const info = run(
    `INSERT INTO files (original_name, stored_name, mime, size, ext, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    originalName,
    storedName,
    mime,
    buffer.length,
    ext,
    nowIso()
  );
  return Number(info.lastInsertRowid);
}

const CONTENT_TYPES = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.md': 'text/markdown; charset=utf-8',
  '.markdown': 'text/markdown; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.csv': 'text/csv; charset=utf-8',
  '.zip': 'application/zip',
  '.epub': 'application/epub+zip',
};

export function contentTypeFor(ext, fallback) {
  return CONTENT_TYPES[ext] || fallback || 'application/octet-stream';
}

export function removePaperAttachment(paperId) {
  const paper = get('SELECT file_id FROM papers WHERE id = ?', paperId);
  if (!paper?.file_id) return;
  run('UPDATE papers SET file_id = NULL, total_pages = NULL WHERE id = ?', paperId);
  removeFileRecord(paper.file_id);
}

export function listCourseFiles(courseId) {
  return all(
    `SELECT cf.id AS link_id, cf.created_at AS linked_at, f.*
     FROM course_files cf JOIN files f ON f.id = cf.file_id
     WHERE cf.course_id = ? ORDER BY cf.created_at DESC`,
    courseId
  );
}
