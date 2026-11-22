export type ThemeMode = 'light' | 'dark' | 'system';
export type Gender = 'male' | 'female' | '';

export interface HealthProfile {
  heightCm: number | null;
  waterGoalMl: number;
  gender: Gender;
  birthday: string | null;
  age: number | null;
  profileComplete: boolean;
}

export interface Settings extends HealthProfile {
  theme?: string;
}

export interface HabitStats {
  current: number;
  longest: number;
  total: number;
  thisMonth: number;
  todayChecked: boolean;
}

export interface HabitPayload {
  tracker: 'duolingo' | 'vocabulary';
  checkins: { date: string; note: string | null }[];
  stats: HabitStats;
}

export interface Dashboard {
  today: string;
  settings: Settings;
  habits: Record<'duolingo' | 'vocabulary', HabitStats>;
  reading: { unread: number; reading: number; completed: number };
  reminders: { dueToday: number; overdue: number };
  health: {
    latestWeight: {
      date: string;
      weight: number;
      bodyFat: number | null;
      estimatedBodyFat: number | null;
    } | null;
    waterToday: number;
    waterGoalMl: number;
  };
  courseCount: number;
  memoCount: number;
  ai: { configured: boolean; model: string };
}

export interface PaperMetadata {
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  abstract: string | null;
  citations: number | null;
  doi: string | null;
  url: string | null;
  pdfUrl: string | null;
  language: string | null;
  source: string | null;
  openalexId: string | null;
  isDomestic: boolean;
  topics: string[];
  keywords: string[];
}

export interface DiscoveredPaper extends PaperMetadata {
  type?: string | null;
}

export type PaperStatus = 'unread' | 'reading' | 'completed';

export interface Paper extends PaperMetadata {
  id: number;
  status: PaperStatus;
  fileId: number | null;
  totalPages: number | null;
  currentPage: number;
  scrollRatio: number;
  lastReadAt: string | null;
  addedAt: string;
  fileName: string | null;
  fileExt: string | null;
  annotationCount: number;
}

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink' | 'purple';

export interface HighlightRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Annotation {
  id: number;
  paperId: number;
  page: number;
  color: HighlightColor;
  rects: HighlightRect[];
  text: string;
  comment: string | null;
  type: 'highlight' | 'note';
  createdAt: string;
  updatedAt: string | null;
}

export interface PaperContent {
  type: 'markdown' | 'text' | 'html';
  content: string;
  name: string;
}

export interface LatestResponse {
  foreign: DiscoveredPaper[];
  domestic: DiscoveredPaper[];
  warnings: string[];
  fromDate: string;
  source: string;
  fetchedAt: string;
  trend: { summary: string; model: string | null; createdAt: string } | null;
  keywords: { name: string; count: number }[];
  trendKey: string;
  aiConfigured: boolean;
  cached?: boolean;
  stale?: boolean;
}

export interface AiStatus {
  configured: boolean;
  provider: string;
  model: string;
  tools: string[];
}

export interface AiChatResponse {
  reply: string;
  papers: DiscoveredPaper[];
  queries: string[];
  degraded: boolean;
  model: string | null;
  toolUsed: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  papers?: DiscoveredPaper[];
  degraded?: boolean;
  error?: boolean;
  pending?: boolean;
}

export interface WeightEntry {
  id: number;
  date: string;
  weight: number;
  bodyFat: number | null;
  estimatedBodyFat: number | null;
  createdAt: string;
}

export interface WaterEntry {
  id: number;
  date: string;
  amount: number;
  createdAt: string;
}

export interface HealthPayload {
  today: string;
  profile: HealthProfile;
  weights: WeightEntry[];
  waterEntries: WaterEntry[];
  waterByDate: Record<string, number>;
}

export interface VocabCard {
  id: number;
  word: string;
  phonetic: string | null;
  meaning: string;
  example: string | null;
  exampleZh: string | null;
}

export interface CourseFile {
  linkId: number;
  fileId: number;
  name: string;
  ext: string;
  size: number;
  mime: string | null;
  createdAt: string;
  url: string;
}

export interface CourseNote {
  id: number;
  courseId: number;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CourseCheckin {
  id: number;
  courseId: number;
  date: string;
  minutes: number | null;
  note: string | null;
  createdAt: string;
}

export interface CourseStats extends HabitStats {
  totalMinutes: number;
}

export interface Course {
  id: number;
  name: string;
  description: string | null;
  color: string;
  progress: number;
  archived: boolean;
  createdAt: string;
  fileCount: number;
  noteCount: number;
  checkinCount: number;
  lastStudied: string | null;
}

export interface CourseDetail {
  course: Course;
  files: CourseFile[];
  notes: CourseNote[];
  checkins: CourseCheckin[];
  stats: CourseStats;
}

export interface Memo {
  id: number;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
}

export type ReminderPriority = 'high' | 'medium' | 'low';

export interface Reminder {
  id: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  dueTime: string | null;
  priority: ReminderPriority;
  category: string | null;
  completed: boolean;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
