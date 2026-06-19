// lib/format.ts
// Спільні утиліти форматування для UI.

/** Назва метрики + одиниця, без дублювання (назва часто вже містить одиницю). */
export function metricLabel(name: string, unit: string | null | undefined): string {
  if (!unit) return name;
  return name.toLowerCase().includes(unit.toLowerCase()) ? name : `${name}, ${unit}`;
}
