// lib/baseline.ts
// Baseline Analyzer (Phase 2, ТЗ розд. 4): аналіз сирих ретро-даних —
// медіани по грейдах, стабільність (CV), сезональність, рекомендовані плани.
// Чисті функції без залежностей від БД.

import { median, coefficientOfVariation } from '@/lib/stats';

export interface ParsedTable {
  headers: string[];
  rows: string[][];
}

/** Парсить вставлену таблицю (TSV / CSV / ;). Перший рядок — заголовки. */
export function parseTable(text: string): ParsedTable {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { headers: [], rows: [] };

  const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
  const split = (l: string) => l.split(delimiter).map((c) => c.trim());

  const headers = split(lines[0]);
  const rows = lines.slice(1).map(split);
  return { headers, rows };
}

export interface MetricAnalysis {
  name: string;
  samples: number;
  cv: number | null; // коефіцієнт варіації (стабільність): менше = стабільніше
  byGrade: Record<string, { median: number | null; count: number }>;
  seasonality: { month: string; index: number; samples: number }[];
}

export interface BaselineResult {
  metrics: MetricAnalysis[];
  grades: string[];
  warnings: string[];
}

const KNOWN_GRADES = ['JUNIOR', 'MIDDLE', 'SENIOR'];

function monthOf(period: string): string | null {
  const p = period.trim();
  if (/^\d{6}$/.test(p)) return p.slice(4, 6); // YYYYMM
  if (/^\d{4}-\d{2}$/.test(p)) return p.slice(5, 7); // YYYY-MM
  if (/^\d{1,2}$/.test(p)) return p.padStart(2, '0'); // просто номер місяця
  return null;
}

/**
 * Аналізує таблицю. Очікувані колонки: period, grade + одна або більше метрик.
 * Назви period/grade шукаються нечутливо до регістру.
 */
export function analyzeBaseline(
  table: ParsedTable,
  opts?: { periodCol?: string; gradeCol?: string }
): BaselineResult {
  const warnings: string[] = [];
  const headers = table.headers;
  const lower = headers.map((h) => h.toLowerCase());

  const periodCol = (opts?.periodCol ?? 'period').toLowerCase();
  const gradeCol = (opts?.gradeCol ?? 'grade').toLowerCase();
  const periodIdx = lower.indexOf(periodCol);
  const gradeIdx = lower.indexOf(gradeCol);

  if (gradeIdx === -1) warnings.push(`Не знайдено колонку «${gradeCol}» — медіани по грейдах недоступні.`);
  if (periodIdx === -1) warnings.push(`Не знайдено колонку «${periodCol}» — сезональність недоступна.`);

  const metricCols = headers
    .map((h, i) => ({ name: h, i }))
    .filter((c) => c.i !== periodIdx && c.i !== gradeIdx);

  const gradesSeen = new Set<string>();
  const metrics: MetricAnalysis[] = [];

  for (const col of metricCols) {
    const all: number[] = [];
    const byGradeVals: Record<string, number[]> = {};
    const byMonthVals: Record<string, number[]> = {};

    for (const row of table.rows) {
      const raw = row[col.i];
      if (raw === undefined || raw === '') continue;
      const value = Number(raw.replace(',', '.'));
      if (Number.isNaN(value)) continue;

      all.push(value);

      if (gradeIdx !== -1) {
        const g = (row[gradeIdx] ?? '').toUpperCase();
        if (g) {
          gradesSeen.add(g);
          (byGradeVals[g] = byGradeVals[g] || []).push(value);
        }
      }
      if (periodIdx !== -1) {
        const mo = monthOf(row[periodIdx] ?? '');
        if (mo) (byMonthVals[mo] = byMonthVals[mo] || []).push(value);
      }
    }

    if (all.length === 0) continue;

    const byGrade: Record<string, { median: number | null; count: number }> = {};
    for (const [g, vals] of Object.entries(byGradeVals)) {
      byGrade[g] = { median: median(vals), count: vals.length };
    }

    const allMean = all.reduce((s, v) => s + v, 0) / all.length;
    const seasonality = Object.entries(byMonthVals)
      .map(([month, vals]) => {
        const monthMean = vals.reduce((s, v) => s + v, 0) / vals.length;
        return { month, index: allMean ? Math.round((monthMean / allMean) * 100) / 100 : 0, samples: vals.length };
      })
      .sort((a, b) => a.month.localeCompare(b.month));

    metrics.push({
      name: col.name,
      samples: all.length,
      cv: coefficientOfVariation(all),
      byGrade,
      seasonality: seasonality.length > 1 ? seasonality : [],
    });
  }

  // Грейди в стабільному порядку (відомі спочатку)
  const grades = [
    ...KNOWN_GRADES.filter((g) => gradesSeen.has(g)),
    ...[...gradesSeen].filter((g) => !KNOWN_GRADES.includes(g)).sort(),
  ];

  return { metrics, grades, warnings };
}

/** Рекомендований план = медіана по грейду × сезонний індекс місяця (якщо є). */
export function recommendedPlan(
  m: MetricAnalysis,
  grade: string,
  month?: string
): number | null {
  const gm = m.byGrade[grade]?.median;
  if (gm == null) return null;
  if (!month) return gm;
  const s = m.seasonality.find((x) => x.month === month);
  if (!s) return gm;
  return Math.round(gm * s.index * 100) / 100;
}
