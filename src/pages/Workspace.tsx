import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Check,
  ChevronUp,
  CircleAlert,
  Droplets,
  Flame,
  NotebookPen,
  Plus,
  Scale,
  Star,
} from 'lucide-react';
import { useDashboard } from '../lib/queries';
import { navModules, type NavModule } from '../lib/nav';
import {
  clamp,
  dateKey,
  formatDateCN,
  formatNumber,
  greeting,
  weekdayOf,
} from '../lib/format';
import { Spinner } from '../components/ui/basics';

export function Workspace() {
  const { data, isLoading } = useDashboard();
  const today = data?.today || dateKey();
  const checkedToday =
    (data?.habits.duolingo.todayChecked ? 1 : 0) +
    (data?.habits.vocabulary.todayChecked ? 1 : 0);
  const water = data?.health.waterToday ?? 0;
  const waterGoal = data?.health.waterGoalMl ?? 2000;

  return (
    <div className="workspace-page">
      <header className="workspace-hero">
        <div className="workspace-hero-copy">
          <div className="eyebrow">
            <span className="live-dot" />
            MY WORKSPACE · {formatDateCN(today, { year: true })}
          </div>
          <h1>
            {greeting()}，<span className="hero-accent">欢迎回来</span>
          </h1>
          <p>
            把研究、习惯和生活收进同一个工作台。把鼠标移到文件夹上，抽出今天要做的事。
          </p>
          <div className="hero-quick-links">
            <Link to="/daily/health" className="quick-chip">
              <Scale size={14} /> 记录体重
            </Link>
            <Link to="/life/memos" className="quick-chip">
              <NotebookPen size={14} /> 新建备忘
            </Link>
            <Link to="/life/reminders" className="quick-chip">
              <Plus size={14} /> 添加提醒
            </Link>
          </div>
        </div>

        <aside className="today-card" aria-label="今日概览">
          <div className="today-card-head">
            <span>今日概览</span>
            <span className="today-card-date">
              {weekdayOf(today)} · {formatDateCN(today)}
            </span>
          </div>

          {isLoading ? (
            <div className="today-card-loading">
              <Spinner size={18} /> 正在整理今天…
            </div>
          ) : (
            <>
              <div className="today-row">
                <span className="today-row-icon habit">
                  <Flame size={15} />
                </span>
                <div className="today-row-main">
                  <span>学习打卡</span>
                  <small>多邻国 · 不背单词</small>
                </div>
                <div className="today-check-dots" aria-label={`今日完成 ${checkedToday} / 2`}>
                  <i className={data?.habits.duolingo.todayChecked ? 'is-on' : ''}>
                    {data?.habits.duolingo.todayChecked && <Check size={10} strokeWidth={3} />}
                  </i>
                  <i className={data?.habits.vocabulary.todayChecked ? 'is-on' : ''}>
                    {data?.habits.vocabulary.todayChecked && <Check size={10} strokeWidth={3} />}
                  </i>
                </div>
              </div>

              <div className="today-row today-row--water">
                <span className="today-row-icon water">
                  <Droplets size={15} />
                </span>
                <div className="today-row-main">
                  <span>今日饮水</span>
                  <div className="today-meter">
                    <span
                      style={{ width: `${clamp(water / waterGoal, 0, 1) * 100}%` }}
                    />
                  </div>
                </div>
                <span className="today-row-value">
                  {formatNumber(water)}
                  <small> / {formatNumber(waterGoal)} ml</small>
                </span>
              </div>

              <div className="today-row">
                <span className="today-row-icon todo">
                  <CircleAlert size={15} />
                </span>
                <div className="today-row-main">
                  <span>待办提醒</span>
                  <small>
                    {data?.reminders.overdue
                      ? `${data.reminders.overdue} 项已逾期`
                      : '暂无逾期任务'}
                  </small>
                </div>
                <Link to="/life/reminders" className="today-row-value link">
                  {data?.reminders.dueToday ?? 0}
                  <small> 项今日</small>
                </Link>
              </div>

              <Link to="/research/reader" className="today-reading">
                <span>在读论文</span>
                <span className="today-reading-count">
                  {data?.reading.reading ?? 0}
                  <ArrowUpRight size={13} />
                </span>
              </Link>
            </>
          )}
        </aside>
      </header>

      <section className="folders-section" aria-label="工作区文件夹">
        <div className="folders-head">
          <div>
            <span className="section-kicker">WORKSPACE</span>
            <h2>我的文件夹</h2>
          </div>
          <span className="folders-hint">
            <Star size={13} /> 悬停或点击文件夹展开
          </span>
        </div>

        <div className="folders-grid">
          {navModules.map((module, index) => (
            <FolderCard
              key={module.key}
              module={module}
              index={index + 1}
              meta={folderMeta(module, data)}
            />
          ))}
        </div>
      </section>

      <footer className="workspace-foot">
        <span className="workspace-foot-dot" />
        所有数据保存在本机 · 随时可导出备份
      </footer>
    </div>
  );
}

function folderMeta(
  module: NavModule,
  data: ReturnType<typeof useDashboard>['data']
): string {
  if (!data) return '正在加载…';
  if (module.key === 'research') {
    return data.reading.reading
      ? `${data.reading.reading} 篇在读 · ${data.reading.unread} 篇未读`
      : `${data.reading.completed} 篇已读完`;
  }
  if (module.key === 'daily') {
    const checked =
      (data.habits.duolingo.todayChecked ? 1 : 0) +
      (data.habits.vocabulary.todayChecked ? 1 : 0);
    return checked === 2 ? '今日习惯已全部打卡' : `今日打卡 ${checked} / 2`;
  }
  if (data.reminders.dueToday || data.reminders.overdue) {
    return `${data.reminders.dueToday} 项今日到期${
      data.reminders.overdue ? ` · ${data.reminders.overdue} 项逾期` : ''
    }`;
  }
  return `${data.memoCount} 条备忘 · 无逾期提醒`;
}

function FolderCard({
  module,
  index,
  meta,
}: {
  module: NavModule;
  index: number;
  meta: string;
}) {
  const [pinned, setPinned] = useState(false);
  const ModuleIcon = module.icon;
  const style = { '--folder-index': `"0${index}"` } as CSSProperties;

  return (
    <div className={`folder-zone accent-${module.accent}`} style={style}>
      <article
        className={`folder ${pinned ? 'is-pinned' : ''}`}
        aria-label={`${module.zh}文件夹`}
      >
        <div className="folder-back" aria-hidden="true" />
        <div className="folder-paper folder-paper--1" aria-hidden="true" />
        <div className="folder-paper folder-paper--2" aria-hidden="true" />

        <div className="folder-menu" role="group" aria-label={`${module.label} 功能`}>
          <div className="folder-menu-head">
            <span>{module.label}</span>
            <small>{module.items.length} 个功能</small>
          </div>
          <ul>
            {module.items.map((item) => {
              const ItemIcon = item.icon;
              return (
                <li key={item.path}>
                  <Link to={item.path} className="folder-link">
                    <span className="folder-link-icon">
                      <ItemIcon size={15} />
                    </span>
                    <span className="folder-link-copy">
                      <strong>{item.label}</strong>
                      <small>{item.description}</small>
                    </span>
                    <ArrowUpRight size={14} className="folder-link-arrow" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          className="folder-cover"
          onClick={() => setPinned((value) => !value)}
          aria-expanded={pinned}
          aria-label={`${pinned ? '收起' : '展开'}${module.zh}功能`}
        >
          <span className="folder-tab">{module.label}</span>
          <span className="folder-index" aria-hidden="true">
            0{index}
          </span>
          <span className="folder-cover-top">
            <span className="folder-emblem">
              <ModuleIcon size={24} />
            </span>
            <span className="folder-tagline">{module.tagline}</span>
          </span>
          <span className="folder-cover-copy">
            <span className="folder-english">{module.label}</span>
            <strong>{module.zh}</strong>
            <span className="folder-meta">{meta}</span>
          </span>
          <span className="folder-cover-foot">
            <span>{module.items.length} 个功能</span>
            <span className="folder-open-hint">
              展开 <ChevronUp size={13} />
            </span>
          </span>
        </button>
      </article>
    </div>
  );
}
