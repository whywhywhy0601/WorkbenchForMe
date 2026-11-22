import crypto from 'node:crypto';
import path from 'node:path';

export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function nowIso() {
  return new Date().toISOString();
}

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isValidDateString(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function requireDateString(value, field = 'date') {
  if (!isValidDateString(value)) {
    throw new ApiError(400, `${field} 必须是有效日期（YYYY-MM-DD）`);
  }
  return value;
}

export function parseId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, '无效的 ID');
  return id;
}

export function asString(value, field, { max = 20000, required = true } = {}) {
  if (value === undefined || value === null) {
    if (required) throw new ApiError(400, `${field} 不能为空`);
    return '';
  }
  if (typeof value !== 'string') throw new ApiError(400, `${field} 必须是文本`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new ApiError(400, `${field} 不能为空`);
  if (trimmed.length > max) throw new ApiError(400, `${field} 过长（最多 ${max} 字）`);
  return trimmed;
}

export function asOptionalString(value, { max = 20000 } = {}) {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new ApiError(400, '字段必须是文本');
  if (value.length > max) throw new ApiError(400, `文本过长（最多 ${max} 字）`);
  return value;
}

export function asInt(value, field, { min = -Infinity, max = Infinity, fallback } = {}) {
  if ((value === undefined || value === null || value === '') && fallback !== undefined) {
    return fallback;
  }
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) throw new ApiError(400, `${field} 必须是整数`);
  if (n < min || n > max) throw new ApiError(400, `${field} 超出允许范围`);
  return n;
}

export function asNumber(value, field, { min = -Infinity, max = Infinity } = {}) {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new ApiError(400, `${field} 必须是数字`);
  if (n < min || n > max) throw new ApiError(400, `${field} 超出允许范围`);
  return n;
}

export function oneOf(value, allowed, field) {
  if (!allowed.includes(value)) {
    throw new ApiError(400, `${field} 取值无效`);
  }
  return value;
}

export function safeJsonParse(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function dayNumber(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

export function ageFromBirthday(birthday, now = new Date()) {
  if (!isValidDateString(birthday)) return null;
  const [year, month, day] = birthday.split('-').map(Number);
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month || (now.getMonth() + 1 === month && now.getDate() < day)) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function resolveAge(settings) {
  const stored = Number(settings?.age);
  if (Number.isInteger(stored) && stored >= 1 && stored <= 120) return stored;
  return ageFromBirthday(settings?.birthday || '');
}

// Deurenberg-style estimate supplied by the user:
// body fat % = 1.20 * BMI + 0.23 * age - 10.8 * sex - 5.4
// sex: male = 1, female = 0. This is an estimate, not a medical diagnosis.
export function estimateBodyFat({ weight, heightCm, age, gender }) {
  const weightValue = Number(weight);
  const heightValue = Number(heightCm);
  const ageValue = Number(age);
  if (
    !(weightValue > 0) ||
    !(heightValue > 0) ||
    !Number.isFinite(ageValue) ||
    (gender !== 'male' && gender !== 'female')
  ) {
    return null;
  }
  const bmi = weightValue / (heightValue / 100) ** 2;
  const sex = gender === 'male' ? 1 : 0;
  const value = 1.2 * bmi + 0.23 * ageValue - 10.8 * sex - 5.4;
  return Number.isFinite(value) ? Math.round(value * 10) / 10 : null;
}

export function computeHabitStats(dates, today = localDateString()) {
  const unique = [...new Set(dates)].sort();
  const daySet = new Set(unique.map(dayNumber));
  const todayNum = dayNumber(today);

  let current = 0;
  let cursor = daySet.has(todayNum) ? todayNum : todayNum - 1;
  if (daySet.has(cursor)) {
    while (daySet.has(cursor)) {
      current += 1;
      cursor -= 1;
    }
  }

  let longest = 0;
  let streak = 0;
  let previous = null;
  for (const day of unique.map(dayNumber)) {
    streak = previous !== null && day === previous + 1 ? streak + 1 : 1;
    if (streak > longest) longest = streak;
    previous = day;
  }

  const monthPrefix = today.slice(0, 7);
  return {
    current,
    longest,
    total: unique.length,
    thisMonth: unique.filter((date) => date.startsWith(monthPrefix)).length,
    todayChecked: daySet.has(todayNum),
  };
}

// Browsers send UTF-8 filenames; multer/busboy decodes them as latin1 by
// default. Re-interpreting the bytes restores Chinese filenames.
export function decodeFileName(name) {
  if (!name) return name;
  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    return decoded.includes('�') ? name : decoded;
  } catch {
    return name;
  }
}

export function extensionOf(name) {
  return path.extname(name || '').toLowerCase();
}

export function sha1(value) {
  return crypto.createHash('sha1').update(value).digest('hex');
}

export function isSafeRemoteFileUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '0.0.0.0' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host)
  ) {
    return false;
  }
  return true;
}

export function mapPaperRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    authors: safeJsonParse(row.authors_json, []),
    year: row.year,
    venue: row.venue,
    abstract: row.abstract,
    citations: row.citations,
    doi: row.doi,
    url: row.url,
    pdfUrl: row.pdf_url,
    language: row.language,
    source: row.source,
    openalexId: row.openalex_id,
    isDomestic: Boolean(row.is_domestic),
    topics: safeJsonParse(row.topics_json, []),
    keywords: safeJsonParse(row.keywords_json, []),
    status: row.status,
    fileId: row.file_id,
    totalPages: row.total_pages,
    currentPage: row.current_page,
    scrollRatio: row.scroll_ratio,
    lastReadAt: row.last_read_at,
    addedAt: row.added_at,
    fileName: row.file_name ?? null,
    fileExt: row.file_ext ?? null,
    annotationCount: row.annotation_count ?? 0,
  };
}

export function wrapAsync(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}
