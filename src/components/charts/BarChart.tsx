import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { formatDateCN, weekdayOfShort } from '../../lib/format';
import {
  compactNumber,
  niceScale,
  shortDate,
  useChartId,
  useElementWidth,
} from './chartUtils';

export interface BarPoint {
  date: string;
  value: number;
}

interface BarChartProps {
  points: BarPoint[];
  color: string;
  label: string;
  unit?: string;
  height?: number;
  formatValue?: (value: number) => string;
  xLabels?: 'weekday' | 'date';
}

const MARGIN = { top: 22, right: 10, bottom: 28, left: 40 };

export function BarChart({
  points,
  color,
  label,
  unit = '',
  height = 196,
  formatValue,
  xLabels = 'weekday',
}: BarChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useChartId('bar-fill');
  const format = formatValue || ((value: number) => `${compactNumber(value)}${unit}`);

  const sorted = useMemo(
    () => [...points].sort((a, b) => a.date.localeCompare(b.date)),
    [points]
  );

  const geometry = useMemo(() => {
    if (!width || sorted.length === 0) return null;
    const leftMargin = width < 360 ? 34 : MARGIN.left;
    const plotWidth = Math.max(width - leftMargin - MARGIN.right, 20);
    const plotHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 20);
    const maxValue = Math.max(...sorted.map((point) => point.value), 1);
    const scale = niceScale(0, maxValue, 4);
    const band = plotWidth / sorted.length;
    const barWidth = Math.max(Math.min(24, band * 0.54), 5);
    const baseline = MARGIN.top + plotHeight;
    const bars = sorted.map((point, index) => {
      const value = Math.max(point.value, 0);
      const barHeight = ((value - scale.min) / (scale.max - scale.min)) * plotHeight;
      const x = leftMargin + band * index + (band - barWidth) / 2;
      const y = baseline - barHeight;
      return { x, y, barHeight, barWidth, band, value };
    });
    return { leftMargin, plotWidth, plotHeight, scale, baseline, bars };
  }, [width, height, sorted]);

  if (sorted.length === 0) {
    return <div className="chart-canvas chart-empty" style={{ height }}>暂无记录</div>;
  }
  if (!geometry) {
    return <div ref={ref} className="chart-canvas chart-canvas--loading" style={{ height }} />;
  }

  const { leftMargin, plotWidth, plotHeight, scale, baseline, bars } = geometry;
  const activePoint = active !== null ? sorted[active] : null;
  const activeBar = active !== null ? bars[active] : null;

  const handlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = event.clientX - rect.left - leftMargin;
    if (px < 0 || px > plotWidth) {
      setActive(null);
      return;
    }
    const band = plotWidth / sorted.length;
    setActive(Math.min(Math.floor(px / band), sorted.length - 1));
  };

  const handleKey = (event: ReactKeyboardEvent<SVGSVGElement>) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      setActive((current) => {
        const start = current === null ? sorted.length - 1 : current;
        const next = event.key === 'ArrowLeft' ? start - 1 : start + 1;
        return Math.min(Math.max(next, 0), sorted.length - 1);
      });
    } else if (event.key === 'Home') {
      event.preventDefault();
      setActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      setActive(sorted.length - 1);
    }
  };

  const tooltipLeft = Math.min(Math.max((activeBar?.x || 0) - 28, 6), width - 112);
  const tooltipTop = Math.min(
    Math.max((activeBar?.y ?? baseline) - 52, 6),
    height - 54
  );

  return (
    <div ref={ref} className="chart-canvas" style={{ height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={`${label}柱状图`}
        tabIndex={0}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? sorted.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKey}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.95" />
            <stop offset="100%" stopColor={color} stopOpacity="0.6" />
          </linearGradient>
        </defs>

        {scale.ticks.map((tick) => {
          const y = MARGIN.top + (1 - (tick - scale.min) / (scale.max - scale.min)) * plotHeight;
          return (
            <g key={tick}>
              <line
                x1={leftMargin}
                x2={leftMargin + plotWidth}
                y1={y}
                y2={y}
                className="chart-gridline"
              />
              <text x={leftMargin - 8} y={y + 3.5} textAnchor="end" className="chart-axis-text">
                {compactNumber(tick)}
              </text>
            </g>
          );
        })}

        {bars.map((bar, index) => {
          const isActive = active === index;
          return (
            <g key={sorted[index].date}>
              <path
                d={barPath(bar.x, bar.y, bar.barWidth, bar.barHeight)}
                fill={`url(#${gradientId})`}
                className={`chart-bar ${isActive ? 'is-active' : ''}`}
              />
              <rect
                x={leftMargin + bar.band * index}
                y={MARGIN.top}
                width={bar.band}
                height={plotHeight}
                fill="transparent"
                className="chart-hit"
              />
              <text
                x={bar.x + bar.barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                className="chart-axis-text"
              >
                {xLabels === 'weekday' ? weekdayOfShort(sorted[index].date) : shortDate(sorted[index].date)}
              </text>
            </g>
          );
        })}

        {bars.length > 0 && bars[bars.length - 1].value > 0 && (
          <text
            x={bars[bars.length - 1].x + bars[bars.length - 1].barWidth / 2}
            y={Math.max(bars[bars.length - 1].y - 6, 12)}
            textAnchor="middle"
            className="chart-end-label"
          >
            {format(bars[bars.length - 1].value)}
          </text>
        )}
      </svg>

      {activePoint && activeBar && (
        <div className="chart-tooltip" style={{ left: tooltipLeft, top: tooltipTop }}>
          <strong>{format(activePoint.value)}</strong>
          <span>{formatDateCN(activePoint.date, { weekday: true })}</span>
        </div>
      )}
      <div className="sr-only" aria-live="polite">
        {activePoint
          ? `${formatDateCN(activePoint.date, { year: true })}，${label} ${format(activePoint.value)}`
          : ''}
      </div>
    </div>
  );
}

function barPath(x: number, y: number, width: number, height: number) {
  if (height <= 0.5) return '';
  const radius = Math.min(4, width / 2, height);
  return [
    `M${x} ${y + height}`,
    `L${x} ${y + radius}`,
    `Q${x} ${y} ${x + radius} ${y}`,
    `L${x + width - radius} ${y}`,
    `Q${x + width} ${y} ${x + width} ${y + radius}`,
    `L${x + width} ${y + height}`,
    'Z',
  ].join(' ');
}
