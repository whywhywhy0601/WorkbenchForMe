import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { formatDateCN } from '../../lib/format';
import {
  compactNumber,
  dayNumber,
  niceScale,
  shortDate,
  useChartId,
  useElementWidth,
} from './chartUtils';

export interface TrendPoint {
  date: string;
  value: number;
}

interface TrendChartProps {
  points: TrendPoint[];
  color: string;
  label: string;
  unit?: string;
  height?: number;
  formatValue?: (value: number) => string;
}

const MARGIN = { top: 20, right: 20, bottom: 28, left: 44 };

export function TrendChart({
  points,
  color,
  label,
  unit = '',
  height = 216,
  formatValue,
}: TrendChartProps) {
  const { ref, width } = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const gradientId = useChartId('trend-fill');
  const format = formatValue || ((value: number) => `${compactNumber(value)}${unit}`);

  const sorted = useMemo(
    () => [...points].sort((a, b) => a.date.localeCompare(b.date)),
    [points]
  );

  const geometry = useMemo(() => {
    if (!width || sorted.length === 0) return null;
    const leftMargin = width < 420 ? 36 : MARGIN.left;
    const plotWidth = Math.max(width - leftMargin - MARGIN.right, 20);
    const plotHeight = Math.max(height - MARGIN.top - MARGIN.bottom, 20);
    const scale = niceScale(
      Math.min(...sorted.map((point) => point.value)),
      Math.max(...sorted.map((point) => point.value))
    );
    const dayNumbers = sorted.map((point) => dayNumber(point.date));
    const minDay = Math.min(...dayNumbers);
    const maxDay = Math.max(...dayNumbers);
    const span = maxDay - minDay || 1;
    const xs = dayNumbers.map((day) =>
      sorted.length === 1 ? leftMargin + plotWidth / 2 : leftMargin + ((day - minDay) / span) * plotWidth
    );
    const ys = sorted.map(
      (point) =>
        MARGIN.top +
        (1 - (point.value - scale.min) / (scale.max - scale.min)) * plotHeight
    );
    const baseline = MARGIN.top + plotHeight;
    return { leftMargin, plotWidth, plotHeight, scale, xs, ys, baseline };
  }, [width, height, sorted]);

  if (sorted.length === 0) {
    return <div className="chart-canvas chart-empty" style={{ height }}>暂无记录</div>;
  }

  if (!geometry) {
    return <div ref={ref} className="chart-canvas chart-canvas--loading" style={{ height }} />;
  }

  const { leftMargin, xs, ys, baseline, scale, plotWidth } = geometry;
  const linePath = xs.map((x, index) => `${index === 0 ? 'M' : 'L'}${x} ${ys[index]}`).join(' ');
  const areaPath = `${linePath} L${xs[xs.length - 1]} ${baseline} L${xs[0]} ${baseline} Z`;
  const activePoint = active !== null ? sorted[active] : null;
  const activeX = active !== null ? xs[active] : 0;
  const activeY = active !== null ? ys[active] : 0;

  const xTickIndices = sorted.length === 1 ? [0] : width < 380 ? [0, sorted.length - 1] : Array.from(
    new Set([0, Math.floor((sorted.length - 1) / 2), sorted.length - 1])
  );

  const handlePointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = event.clientX - rect.left;
    let nearest = 0;
    let closest = Infinity;
    xs.forEach((x, index) => {
      const distance = Math.abs(x - px);
      if (distance < closest) {
        closest = distance;
        nearest = index;
      }
    });
    setActive(nearest);
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

  const tooltipLeft = Math.min(Math.max(activeX + 12, 8), width - 118);
  const tooltipTop = Math.min(Math.max(activeY - 54, 8), height - 58);

  return (
    <div ref={ref} className="chart-canvas" style={{ height }}>
      <svg
        ref={svgRef}
        width={width}
        height={height}
        role="img"
        aria-label={`${label}趋势图`}
        tabIndex={0}
        onPointerMove={handlePointer}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((current) => current ?? sorted.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={handleKey}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.01" />
          </linearGradient>
        </defs>

        {scale.ticks.map((tick) => {
          const y = MARGIN.top + (1 - (tick - scale.min) / (scale.max - scale.min)) * geometry.plotHeight;
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

        <path d={areaPath} fill={`url(#${gradientId})`} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {xTickIndices.map((index) => (
          <text
            key={index}
            x={xs[index]}
            y={height - 8}
            textAnchor={
              index === 0 ? 'start' : index === sorted.length - 1 ? 'end' : 'middle'
            }
            className="chart-axis-text"
          >
            {shortDate(sorted[index].date)}
          </text>
        ))}

        {active !== null && (
          <g>
            <line
              x1={activeX}
              x2={activeX}
              y1={MARGIN.top}
              y2={baseline}
              className="chart-crosshair"
            />
            <circle cx={activeX} cy={activeY} r={4.5} fill={color} className="chart-dot" />
          </g>
        )}

        <circle
          cx={xs[xs.length - 1]}
          cy={ys[ys.length - 1]}
          r={4}
          fill={color}
          className="chart-dot"
        />
        <text
          x={xs[xs.length - 1]}
          y={Math.max(ys[ys.length - 1] - 12, 12)}
          textAnchor={xs[xs.length - 1] > leftMargin + plotWidth - 50 ? 'end' : 'middle'}
          className="chart-end-label"
        >
          {format(sorted[sorted.length - 1].value)}
        </text>
      </svg>

      {activePoint && (
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
