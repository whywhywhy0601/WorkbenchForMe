import { useMemo, type ReactNode } from 'react';
import { Check, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  calendarCells,
  currentMonth,
  dateKey,
  formatDateCN,
  monthLabel,
  weekdayLabels,
} from '../../lib/format';

interface MonthCalendarProps {
  month: string;
  onMonthChange?: (month: string) => void;
  checkedDates?: Set<string>;
  noteDates?: Set<string>;
  markedDates?: Record<string, string[]>;
  selected?: string | null;
  onDayClick?: (date: string) => void;
  accent?: 'blue' | 'green' | 'purple' | 'pink' | 'orange' | 'teal';
  disableFuture?: boolean;
  legend?: ReactNode;
  showTodayButton?: boolean;
}

export function MonthCalendar({
  month,
  onMonthChange,
  checkedDates,
  noteDates,
  markedDates,
  selected,
  onDayClick,
  accent = 'blue',
  disableFuture = true,
  legend,
  showTodayButton = true,
}: MonthCalendarProps) {
  const cells = useMemo(() => calendarCells(month), [month]);
  const today = dateKey();

  return (
    <div className={`calendar calendar--${accent}`}>
      <div className="calendar-head">
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMonthChange?.(shift(month, -1))}
          aria-label="上个月"
        >
          <ChevronLeft size={17} />
        </button>
        <div className="calendar-title">
          <strong>{monthLabel(month)}</strong>
          {showTodayButton && month !== currentMonth() && (
            <button
              type="button"
              className="calendar-today-btn"
              onClick={() => onMonthChange?.(currentMonth())}
            >
              回到本月
            </button>
          )}
        </div>
        <button
          type="button"
          className="icon-btn"
          onClick={() => onMonthChange?.(shift(month, 1))}
          aria-label="下个月"
        >
          <ChevronRight size={17} />
        </button>
      </div>

      <div className="calendar-weekdays" aria-hidden="true">
        {weekdayLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="calendar-grid" role="grid" aria-label={monthLabel(month)}>
        {cells.map((cell) => {
          const checked = checkedDates?.has(cell.key) ?? false;
          const hasNote = noteDates?.has(cell.key) ?? false;
          const dots = markedDates?.[cell.key] || [];
          const isToday = cell.key === today;
          const isFuture = cell.key > today;
          const isSelected = selected === cell.key;
          const disabled = !cell.inMonth || (disableFuture && isFuture);
          const day = Number(cell.key.slice(8));
          return (
            <button
              type="button"
              key={cell.key}
              className={[
                'calendar-day',
                !cell.inMonth ? 'is-outside' : '',
                checked ? 'is-checked' : '',
                isToday ? 'is-today' : '',
                isFuture ? 'is-future' : '',
                isSelected ? 'is-selected' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              disabled={disabled || !onDayClick}
              onClick={() => onDayClick?.(cell.key)}
              aria-pressed={checked}
              aria-label={`${formatDateCN(cell.key, { year: true })}${checked ? '，已完成' : ''}${
                hasNote ? '，有备注' : ''
              }`}
            >
              <span className="calendar-day-number">{day}</span>
              {checked && <Check size={12} className="calendar-check" strokeWidth={3} />}
              {!checked && dots.length > 0 && (
                <span className="calendar-dots">
                  {dots.slice(0, 3).map((color, index) => (
                    <i key={`${color}-${index}`} className={`calendar-dot dot--${color}`} />
                  ))}
                </span>
              )}
              {hasNote && <i className="calendar-note-dot" />}
            </button>
          );
        })}
      </div>
      {legend && <div className="calendar-legend">{legend}</div>}
    </div>
  );
}

function shift(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(year, m - 1 + delta, 1);
  return dateKey(date).slice(0, 7);
}
