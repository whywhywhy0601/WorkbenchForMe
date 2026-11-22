const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const WEEKDAYS_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

export function dateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseDateKey(value).getTime());
}

export function ageFromBirthday(birthday: string, reference = dateKey()): number | null {
  if (!isValidDateKey(birthday) || !isValidDateKey(reference)) return null;
  const birth = parseDateKey(birthday);
  const today = parseDateKey(reference);
  let age = today.getFullYear() - birth.getFullYear();
  if (
    today.getMonth() < birth.getMonth() ||
    (today.getMonth() === birth.getMonth() && today.getDate() < birth.getDate())
  ) {
    age -= 1;
  }
  return age >= 0 && age <= 130 ? age : null;
}

export function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

export function currentMonth(): string {
  return dateKey().slice(0, 7);
}

export function shiftMonth(month: string, delta: number): string {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return dateKey(date).slice(0, 7);
}

export function monthLabel(month: string): string {
  const [year, m] = month.split('-').map(Number);
  return `${year}年${m}月`;
}

export function monthLabelShort(month: string): string {
  const [, m] = month.split('-').map(Number);
  return `${m}月`;
}

export function calendarCells(month: string): { key: string; inMonth: boolean }[] {
  const [year, m] = month.split('-').map(Number);
  const first = new Date(year, m - 1, 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first grid
  const gridStart = new Date(year, m - 1, 1 - offset);
  const cells: { key: string; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i);
    cells.push({ key: dateKey(date), inMonth: date.getMonth() === m - 1 });
  }
  return cells;
}

export const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日'];

export function weekdayOf(key: string): string {
  return WEEKDAYS[parseDateKey(key).getDay()];
}

export function weekdayOfShort(key: string): string {
  return WEEKDAYS_SHORT[parseDateKey(key).getDay()];
}

export function formatDateCN(
  key: string,
  options: { year?: boolean; weekday?: boolean } = {}
): string {
  if (!isValidDateKey(key)) return key;
  const date = parseDateKey(key);
  const datePart = options.year
    ? `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
    : `${date.getMonth() + 1}月${date.getDate()}日`;
  return options.weekday ? `${datePart} ${WEEKDAYS[date.getDay()]}` : datePart;
}

export function formatRelativeDate(key: string): string {
  const today = dateKey();
  if (key === today) return '今天';
  if (key === addDays(today, 1)) return '明天';
  if (key === addDays(today, -1)) return '昨天';
  const currentYear = today.slice(0, 4);
  return formatDateCN(key, { year: key.slice(0, 4) !== currentYear });
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const time = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${date.getMonth() + 1}月${date.getDate()}日 ${time}`;
}

export function formatTime(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function timeAgo(iso: string | null): string {
  if (!iso) return '';
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return '';
  const diff = Date.now() - date;
  if (diff < 60_000) return '刚刚';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  return formatDateCN(dateKey(new Date(date)), {
    year: new Date(date).getFullYear() !== new Date().getFullYear(),
  });
}

export function lastNDays(count: number, end = dateKey()): string[] {
  const days: string[] = [];
  for (let i = count - 1; i >= 0; i -= 1) days.push(addDays(end, -i));
  return days;
}

export function daysBetween(a: string, b: string): number {
  const first = parseDateKey(a).getTime();
  const second = parseDateKey(b).getTime();
  return Math.round((second - first) / 86_400_000);
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 5) return '夜深了';
  if (hour < 11) return '早上好';
  if (hour < 13) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('zh-CN').format(value);
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 10 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export interface BmiInfo {
  value: number;
  category: string;
  tone: 'low' | 'normal' | 'high' | 'very-high';
}

export function bmiInfo(weightKg: number, heightCm: number | null): BmiInfo | null {
  if (!heightCm || heightCm <= 0 || !weightKg) return null;
  const meters = heightCm / 100;
  const value = weightKg / (meters * meters);
  if (value < 18.5) return { value, category: '偏瘦', tone: 'low' };
  if (value < 24) return { value, category: '正常', tone: 'normal' };
  if (value < 28) return { value, category: '超重', tone: 'high' };
  return { value, category: '肥胖', tone: 'very-high' };
}

export function minutesLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

export function truncate(text: string, length: number): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length).trimEnd()}…`;
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return '·';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}
