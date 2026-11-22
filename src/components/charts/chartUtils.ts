import { useEffect, useId, useRef, useState } from 'react';

export function useElementWidth<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.width || 0;
      setWidth((current) => (Math.abs(current - next) > 1 ? next : current));
    });
    observer.observe(element);
    setWidth(element.getBoundingClientRect().width);
    return () => observer.disconnect();
  }, []);

  return { ref, width };
}

export function dayNumber(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return Math.round(Date.UTC(year, month - 1, day) / 86400000);
}

export function niceScale(min: number, max: number, count = 4) {
  let low = min;
  let high = max;
  if (!Number.isFinite(low) || !Number.isFinite(high)) {
    low = 0;
    high = 1;
  }
  if (low === high) {
    const delta = Math.abs(low) * 0.1 || 1;
    low -= delta;
    high += delta;
  }
  const rawStep = (high - low) / Math.max(count - 1, 1);
  const power = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  const step = niceFraction * power;
  const niceMin = Math.floor(low / step) * step;
  const niceMax = Math.ceil(high / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step / 2; value += step) {
    ticks.push(Number(value.toFixed(6)));
  }
  return { min: niceMin, max: niceMax, ticks };
}

export function shortDate(date: string): string {
  return `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`;
}

export function compactNumber(value: number): string {
  if (Math.abs(value) >= 10000) return `${(value / 1000).toFixed(value >= 100000 ? 0 : 1)}k`;
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1);
}

export function useChartId(prefix: string) {
  const id = useId();
  return `${prefix}-${id.replace(/[:]/g, '')}`;
}
