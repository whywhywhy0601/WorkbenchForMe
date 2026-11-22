import type { LucideIcon } from 'lucide-react';
import {
  BellRing,
  BookMarked,
  Flame,
  GraduationCap,
  HeartPulse,
  Languages,
  Sparkles,
  StickyNote,
} from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

export interface NavModule {
  key: string;
  label: string;
  zh: string;
  tagline: string;
  icon: LucideIcon;
  accent: 'blue' | 'purple' | 'orange';
  items: NavItem[];
}

export const navModules: NavModule[] = [
  {
    key: 'research',
    label: 'Research',
    zh: '论文阅读',
    tagline: '发现文献 · 精读批注',
    icon: BookMarked,
    accent: 'blue',
    items: [
      {
        path: '/research/latest',
        label: '最新论文',
        description: '追踪领域前沿，AI 辅助检索',
        icon: Sparkles,
      },
      {
        path: '/research/reader',
        label: '论文阅读',
        description: '阅读、高亮、批注与进度管理',
        icon: BookMarked,
      },
    ],
  },
  {
    key: 'daily',
    label: 'Daily Activities',
    zh: '日常活动',
    tagline: '习惯养成 · 健康记录',
    icon: Flame,
    accent: 'purple',
    items: [
      {
        path: '/daily/duolingo',
        label: '多邻国打卡',
        description: '连续学习天数与月历记录',
        icon: Flame,
      },
      {
        path: '/daily/vocabulary',
        label: '不背单词打卡',
        description: '每日单词学习与卡片复习',
        icon: Languages,
      },
      {
        path: '/daily/health',
        label: '减肥打卡',
        description: '体重、饮水、BMI 与体脂趋势',
        icon: HeartPulse,
      },
      {
        path: '/daily/courses',
        label: '网课学习',
        description: '课程资料、笔记与学习日历',
        icon: GraduationCap,
      },
    ],
  },
  {
    key: 'life',
    label: 'Life Management',
    zh: '事件记录',
    tagline: '随手记录 · 有序提醒',
    icon: StickyNote,
    accent: 'orange',
    items: [
      {
        path: '/life/memos',
        label: '备忘录',
        description: 'Markdown 记录与自动保存',
        icon: StickyNote,
      },
      {
        path: '/life/reminders',
        label: '提醒事项',
        description: '任务、截止日期与优先级',
        icon: BellRing,
      },
    ],
  },
];

export function findNavContext(pathname: string) {
  for (const module of navModules) {
    for (const item of module.items) {
      if (pathname === item.path || pathname.startsWith(`${item.path}/`)) {
        return { module, item };
      }
    }
  }
  return null;
}

export const allItems = navModules.flatMap((module) =>
  module.items.map((item) => ({ ...item, module }))
);
