// lib/stats.ts
// Прості статистичні утиліти для бенчмарків.

/** Середнє арифметичне (порожній → null). */
export function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((s, v) => s + v, 0) / values.length) * 100) / 100;
}

/** Стандартне відхилення (популяційне). < 2 значень → null. */
export function stdDev(values: number[]): number | null {
  if (values.length < 2) return null;
  const m = values.reduce((s, v) => s + v, 0) / values.length;
  const variance = values.reduce((s, v) => s + (v - m) ** 2, 0) / values.length;
  return Math.round(Math.sqrt(variance) * 100) / 100;
}

/** Медіана масиву чисел (порожній → null). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const m = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  return Math.round(m * 100) / 100;
}

/** Коефіцієнт варіації (std/mean). null якщо < 2 значень або mean = 0. */
export function coefficientOfVariation(values: number[]): number | null {
  if (values.length < 2) return null;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  if (mean === 0) return null;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
  return Math.round((Math.sqrt(variance) / Math.abs(mean)) * 100) / 100;
}
