export type FitMode = 'width' | 'page' | 'original';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 8;
const ZOOM_STEP = 1.25;

export function clampPageIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return Math.max(0, Math.min(index, count - 1));
}

export function nextZoom(current: number, direction: 1 | -1): number {
  const raw = direction === 1 ? current * ZOOM_STEP : current / ZOOM_STEP;
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, raw));
}
