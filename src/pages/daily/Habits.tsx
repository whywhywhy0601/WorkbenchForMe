import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Flame,
  Languages,
  Pencil,
  Shuffle,
  Sparkles,
  Volume2,
} from 'lucide-react';
import type { HabitPayload, VocabCard } from '../../types';
import {
  useHabit,
  useToggleHabit,
  useVocabDeck,
} from '../../lib/queries';
import { errorMessage } from '../../lib/api';
import { useToast } from '../../app/ToastProvider';
import {
  PageHeader,
  Spinner,
  EmptyState,
  ErrorState,
  Tag,
} from '../../components/ui/basics';
import { MonthCalendar } from '../../components/ui/MonthCalendar';
import { Modal } from '../../components/ui/Overlay';
import {
  currentMonth,
  dateKey,
  formatDateCN,
  lastNDays,
  weekdayOfShort,
} from '../../lib/format';

type Tracker = 'duolingo' | 'vocabulary';

export function DuolingoPage() {
  return (
    <HabitTracker
      tracker="duolingo"
      title="多邻国打卡"
      eyebrow="DAILY ACTIVITIES / LANGUAGE STREAK"
      description="记录每天的多邻国学习，用连续的绿色日历保持节奏。点击日期即可打卡或取消。"
      accent="green"
      side={(data) => (
        <>
          <WeeklyRhythm data={data} accent="green" />
          <div className="card habit-tip">
            <h3>保持节奏</h3>
            <p>
              连续打卡天数会以今天或昨天为终点计算。断签不会清空历史记录，你可以随时从今天重新开始。
            </p>
          </div>
        </>
      )}
    />
  );
}

export function VocabularyPage() {
  return (
    <HabitTracker
      tracker="vocabulary"
      title="不背单词打卡"
      eyebrow="DAILY ACTIVITIES / VOCABULARY"
      description="记录每日单词学习，并在休息间隙翻一张单词卡。点击日期打卡，右侧可切换与朗读单词。"
      accent="pink"
      side={() => (
        <>
          <WordDeck />
          <div className="card habit-tip">
            <h3>卡片说明</h3>
            <p>
              单词卡来自内置学习牌组，支持浏览器朗读与随机切换。先尝试回忆释义，再点击显示。
            </p>
          </div>
        </>
      )}
    />
  );
}

function HabitTracker({
  tracker,
  title,
  eyebrow,
  description,
  accent,
  side,
}: {
  tracker: Tracker;
  title: string;
  eyebrow: string;
  description: string;
  accent: 'green' | 'pink';
  side: (data: HabitPayload) => ReactNode;
}) {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useHabit(tracker);
  const toggle = useToggleHabit(tracker);
  const [month, setMonth] = useState(currentMonth());
  const [noteDate, setNoteDate] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const today = dateKey();

  const checkedDates = useMemo(
    () => new Set((data?.checkins ?? []).map((checkin) => checkin.date)),
    [data?.checkins]
  );
  const noteDates = useMemo(
    () =>
      new Set(
        (data?.checkins ?? [])
          .filter((checkin) => checkin.note)
          .map((checkin) => checkin.date)
      ),
    [data?.checkins]
  );
  const recent = useMemo(
    () => [...(data?.checkins ?? [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10),
    [data?.checkins]
  );

  const handleDay = async (date: string) => {
    if (date > today || toggle.isPending) return;
    const checked = checkedDates.has(date);
    try {
      await toggle.mutateAsync({ date, checked: !checked });
      toast.success(
        checked ? `已取消 ${formatDateCN(date)} 的打卡` : `已记录 ${formatDateCN(date)} 的打卡`,
        checked ? '已取消' : '打卡成功'
      );
    } catch (err) {
      toast.error(errorMessage(err), '打卡失败');
    }
  };

  const openNote = (date: string) => {
    const existing = data?.checkins.find((checkin) => checkin.date === date);
    setNoteDate(date);
    setNoteText(existing?.note ?? '');
  };

  const saveNote = async () => {
    if (!noteDate) return;
    try {
      await toggle.mutateAsync({
        date: noteDate,
        checked: true,
        note: noteText.trim() || null,
      });
      setNoteDate(null);
      setNoteText('');
      toast.success('学习记录已保存');
    } catch (err) {
      toast.error(errorMessage(err), '保存失败');
    }
  };

  const stats = data?.stats;
  const todayChecked = stats?.todayChecked ?? false;

  return (
    <div className={`page habit-page habit-${accent}`}>
      <PageHeader
        eyebrow={
          <>
            <Flame size={13} /> {eyebrow}
          </>
        }
        title={title}
        description={description}
        actions={
          <>
            <button className="btn btn-secondary" onClick={() => openNote(today)}>
              <Pencil size={14} /> 记录学习内容
            </button>
            {!todayChecked ? (
              <button
                className="btn btn-primary"
                onClick={() => void handleDay(today)}
                disabled={toggle.isPending}
              >
                {toggle.isPending ? <Spinner size={14} /> : <Check size={15} />}
                完成今日打卡
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => void handleDay(today)}
                disabled={toggle.isPending}
                title="点击撤销今天的打卡"
              >
                <Check size={15} /> 今日已打卡
              </button>
            )}
          </>
        }
      />

      {isError && (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      )}

      <div className="habit-layout">
        <div className="habit-main">
          <section className={`streak-hero streak-hero--${accent}`}>
            <div className="streak-hero-main">
              <span className="streak-flame">
                <Flame size={34} />
              </span>
              <div>
                <span className="streak-kicker">在当前节奏中</span>
                <div className="streak-number">
                  {stats?.current ?? 0}
                  <small>天连续</small>
                </div>
                <p>
                  {todayChecked
                    ? '今天已经完成，继续保持这个节奏。'
                    : stats?.current
                      ? '今天还没有打卡，别让连续记录中断。'
                      : '从今天开始，先完成第一次打卡。'}
                </p>
              </div>
            </div>
            <div className="streak-metrics">
              <Metric label="最长连续" value={`${stats?.longest ?? 0} 天`} />
              <Metric label="累计打卡" value={`${stats?.total ?? 0} 天`} />
              <Metric label="本月" value={`${stats?.thisMonth ?? 0} 天`} />
            </div>
            <span className="streak-glow" aria-hidden="true" />
          </section>

          <section className="card calendar-card">
            <header className="card-head">
              <div>
                <h2 className="card-title">学习月历</h2>
                <p className="card-subtitle">点击过去或今天的日期，添加或取消打卡</p>
              </div>
              <Tag tone={accent === 'green' ? 'green' : 'pink'} icon={<CalendarCheck size={12} />}>
                {stats?.thisMonth ?? 0} 次本月
              </Tag>
            </header>
            {isLoading ? (
              <div className="calendar-skeleton" aria-hidden="true">
                {Array.from({ length: 35 }).map((_, index) => (
                  <span key={index} className="skeleton skeleton-cell" />
                ))}
              </div>
            ) : (
              <MonthCalendar
                month={month}
                onMonthChange={setMonth}
                checkedDates={checkedDates}
                noteDates={noteDates}
                onDayClick={(date) => void handleDay(date)}
                accent={accent === 'green' ? 'green' : 'pink'}
                legend={
                  <>
                    <span>
                      <i className={`legend-dot legend-dot--${accent}`} /> 已打卡
                    </span>
                    <span>
                      <i className="legend-dot legend-dot--note" /> 有学习记录
                    </span>
                  </>
                }
              />
            )}
          </section>

          <section className="card records-card">
            <header className="card-head">
              <div>
                <h2 className="card-title">最近记录</h2>
                <p className="card-subtitle">点击记录可以补充或修改学习内容</p>
              </div>
              <span className="record-count">{data?.checkins.length ?? 0} 条</span>
            </header>
            {isLoading ? (
              <div className="records-loading">
                <Spinner size={16} /> 正在加载记录…
              </div>
            ) : recent.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarCheck size={20} />}
                title="还没有打卡记录"
                description="点击日历中的今天，或使用右上角的「完成今日打卡」。"
              />
            ) : (
              <ul className="record-list">
                {recent.map((record) => (
                  <li key={record.date}>
                    <button
                      type="button"
                      className="record-row"
                      onClick={() => openNote(record.date)}
                    >
                      <span className="record-date">
                        <strong>{formatDateCN(record.date)}</strong>
                        <small>{weekdayOfShort(record.date)}</small>
                      </span>
                      <span className="record-note">
                        {record.note || <em>没有备注，点击补充</em>}
                      </span>
                      <span className="record-edit">
                        <Pencil size={13} />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="habit-side">
          {data ? side(data) : <div className="skeleton skeleton-side" />}
        </aside>
      </div>

      <Modal
        open={Boolean(noteDate)}
        onClose={() => setNoteDate(null)}
        title="学习记录"
        subtitle={noteDate ? formatDateCN(noteDate, { year: true, weekday: true }) : undefined}
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setNoteDate(null)}>
              取消
            </button>
            <button className="btn btn-primary" onClick={() => void saveNote()} disabled={toggle.isPending}>
              {toggle.isPending ? <Spinner size={13} /> : <Check size={14} />}
              保存记录
            </button>
          </>
        }
      >
        <div className="note-editor">
          <label className="field">
            <span>今天学了什么？</span>
            <textarea
              rows={5}
              value={noteText}
              onChange={(event) => setNoteText(event.target.value.slice(0, 500))}
              placeholder="例如：完成 3 个单元，复习了 20 个单词…"
              autoFocus
            />
          </label>
          <p className="field-hint">保存后该日期会自动标记为已打卡。</p>
        </div>
      </Modal>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="streak-metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function WeeklyRhythm({ data, accent }: { data: HabitPayload; accent: 'green' | 'pink' }) {
  const today = dateKey();
  const days = lastNDays(7, today);
  const checked = new Set(data.checkins.map((checkin) => checkin.date));
  const count = days.filter((day) => checked.has(day)).length;
  return (
    <section className="card rhythm-card">
      <header className="card-head">
        <div>
          <h2 className="card-title">本周节奏</h2>
          <p className="card-subtitle">最近 7 天的完成情况</p>
        </div>
        <span className="rhythm-count">{count}/7</span>
      </header>
      <div className="rhythm-days">
        {days.map((day) => {
          const isChecked = checked.has(day);
          return (
            <div
              key={day}
              className={`rhythm-day ${isChecked ? 'is-checked' : ''} ${
                day === today ? 'is-today' : ''
              }`}
            >
              <span>{weekdayOfShort(day)}</span>
              <i className={`rhythm-dot rhythm-dot--${accent}`}>
                {isChecked && <Check size={12} strokeWidth={3} />}
              </i>
              <small>{Number(day.slice(8))}</small>
            </div>
          );
        })}
      </div>
      <p className="rhythm-note">
        {count === 7
          ? '一整周都在坚持，节奏非常稳。'
          : count >= 4
            ? '这一周已经过半，再补几次就更完整了。'
            : '节奏刚起步，从今天补上一次。'}
      </p>
    </section>
  );
}

function WordDeck() {
  const toast = useToast();
  const { data, isLoading, isError, error, refetch } = useVocabDeck();
  const cards = data ?? [];
  const [order, setOrder] = useState<number[] | null>(null);
  const [position, setPosition] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const orderedCards = useMemo(
    () =>
      order
        ? order
            .map((index) => cards[index])
            .filter((item): item is VocabCard => Boolean(item))
        : cards,
    [cards, order]
  );
  const card: VocabCard | undefined = orderedCards[position];

  useEffect(() => {
    if (position >= orderedCards.length && orderedCards.length > 0) setPosition(0);
  }, [orderedCards.length, position]);

  const next = (delta: number) => {
    if (!orderedCards.length) return;
    setPosition((current) => (current + delta + orderedCards.length) % orderedCards.length);
    setRevealed(false);
  };

  const shuffle = () => {
    if (!cards.length) return;
    const indices = cards.map((_, index) => index);
    for (let index = indices.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [indices[index], indices[swap]] = [indices[swap], indices[index]];
    }
    setOrder(indices);
    setPosition(0);
    setRevealed(false);
  };

  const speak = () => {
    if (!card || !('speechSynthesis' in window)) {
      toast.info('当前浏览器不支持语音朗读');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(card.word);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  return (
    <section className="card word-card">
      <header className="card-head">
        <div>
          <h2 className="card-title">单词卡片</h2>
          <p className="card-subtitle">先回忆，再翻看释义</p>
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={shuffle}
          aria-label="随机换一批"
          title="随机换一批"
        >
          <Shuffle size={15} />
        </button>
      </header>

      {isLoading ? (
        <div className="word-loading">
          <Spinner size={18} /> 准备单词卡…
        </div>
      ) : isError ? (
        <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
      ) : card ? (
        <div className="word-card-body" key={`${position}-${card.id}`}>
          <div className="word-card-top">
            <span className="word-counter">
              {position + 1} / {orderedCards.length}
            </span>
            <Tag tone="pink" icon={<Languages size={11} />}>
              {revealed ? '已显示释义' : '先想一想'}
            </Tag>
          </div>
          <div className="word-main">
            <h3>{card.word}</h3>
            <div className="word-phonetic-row">
              {card.phonetic && <span>{card.phonetic}</span>}
              <button
                type="button"
                className="icon-btn icon-btn--xs"
                onClick={speak}
                aria-label="朗读单词"
                title="朗读单词"
              >
                <Volume2 size={13} />
              </button>
            </div>
          </div>

          {revealed ? (
            <div className="word-reveal">
              <p className="word-meaning">{card.meaning}</p>
              {card.example && (
                <div className="word-example">
                  <p>{card.example}</p>
                  {card.exampleZh && <small>{card.exampleZh}</small>}
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary word-reveal-btn"
              onClick={() => setRevealed(true)}
            >
              <Sparkles size={14} /> 显示释义
            </button>
          )}

          <div className="word-card-foot">
            <button type="button" className="icon-btn" onClick={() => next(-1)} aria-label="上一个单词">
              <ChevronLeft size={16} />
            </button>
            <span className="word-foot-hint">左右切换</span>
            <button type="button" className="icon-btn" onClick={() => next(1)} aria-label="下一个单词">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      ) : (
        <EmptyState compact icon={<Languages size={20} />} title="暂无单词卡" />
      )}

      <footer className="word-card-footer">
        <button type="button" className="btn btn-secondary btn-sm" onClick={shuffle}>
          <Shuffle size={13} /> 换一批
        </button>
        <span>内置牌组 · 离线可用</span>
      </footer>
    </section>
  );
}
