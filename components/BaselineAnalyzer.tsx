// components/BaselineAnalyzer.tsx
'use client';

import { useState } from 'react';
import { parseTable, analyzeBaseline, recommendedPlan, type BaselineResult } from '@/lib/baseline';

const SAMPLE = `period\tgrade\tFTD\tCost per FTD
202401\tJUNIOR\t100\t12
202401\tSENIOR\t200\t8
202402\tJUNIOR\t120\t11
202402\tSENIOR\t220\t9`;

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const GRADE_LABEL: Record<string, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };

function stability(cv: number | null): { label: string; cls: string } {
  if (cv == null) return { label: '—', cls: 'text-gray-400' };
  if (cv < 0.3) return { label: `стабільна (CV ${cv})`, cls: 'text-green-600' };
  if (cv < 0.6) return { label: `помірна (CV ${cv})`, cls: 'text-amber-600' };
  return { label: `нестабільна (CV ${cv})`, cls: 'text-red-600' };
}

export default function BaselineAnalyzer() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<BaselineResult | null>(null);
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const content = await file.text();
      setText(content);
    } catch {
      setError('Не вдалося прочитати файл.');
    }
  }

  async function importSheet() {
    if (!url.trim()) return;
    setImporting(true);
    setError('');
    try {
      const res = await fetch('/api/baseline/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка імпорту');
      setText(data.text);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  function analyze() {
    setError('');
    try {
      const parsed = parseTable(text);
      if (parsed.headers.length === 0 || parsed.rows.length === 0) {
        setError('Вставте таблицю з заголовком і хоча б одним рядком даних.');
        setResult(null);
        return;
      }
      setResult(analyzeBaseline(parsed));
    } catch {
      setError('Не вдалося розібрати дані.');
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Baseline Analyzer</h2>
      <p className="text-sm text-gray-500 mb-4">
        Вставте сирі ретро-дані (TSV/CSV) з колонками <code className="bg-gray-100 px-1 rounded">period</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">grade</code> та метриками. Інструмент рахує медіани по грейдах,
        стабільність, сезональність і рекомендовані плани.
      </p>

      {/* Джерела даних: файл або Google-таблиця */}
      <div className="flex flex-col sm:flex-row gap-3 mb-3">
        <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:border-blue-400 shrink-0">
          📄 Завантажити CSV
          <input type="file" accept=".csv,text/csv" onChange={handleFile} className="hidden" />
        </label>
        <div className="flex-1 flex gap-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Посилання на Google-таблицю (доступ «за посиланням»)"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button onClick={importSheet} disabled={importing} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 disabled:opacity-50 whitespace-nowrap">
            {importing ? 'Завантаження...' : 'Імпорт'}
          </button>
        </div>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={SAMPLE}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500"
      />
      <div className="flex items-center gap-3 mt-3">
        <button onClick={analyze} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">
          Аналізувати
        </button>
        <button onClick={() => setText(SAMPLE)} className="text-sm text-gray-500 hover:text-gray-800">
          Вставити приклад
        </button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-500">Місяць для плану:</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-gray-900">
            <option value="">без сезонності</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mt-4 text-sm">{error}</div>}

      {result && (
        <div className="mt-6 space-y-5">
          {result.warnings.map((w, i) => (
            <div key={i} className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded text-sm">{w}</div>
          ))}

          {result.metrics.length === 0 ? (
            <p className="text-gray-500 text-sm">Не знайдено числових метрик у даних.</p>
          ) : (
            result.metrics.map((m) => (
              <div key={m.name} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-baseline justify-between mb-3">
                  <h3 className="font-semibold text-gray-900">{m.name}</h3>
                  <span className={`text-xs ${stability(m.cv).cls}`}>{stability(m.cv).label} · {m.samples} значень</span>
                </div>

                {/* Рекомендовані плани по грейдах */}
                {result.grades.length > 0 && (
                  <table className="text-sm mb-3">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 pr-6 font-medium">Грейд</th>
                        <th className="py-1 pr-6 font-medium text-right">Медіана</th>
                        <th className="py-1 font-medium text-right">Рекомендований план{month ? ` (міс. ${month})` : ''}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.grades.filter((g) => m.byGrade[g]).map((g) => (
                        <tr key={g} className="border-t border-gray-100">
                          <td className="py-1 pr-6 text-gray-900">{GRADE_LABEL[g] ?? g}</td>
                          <td className="py-1 pr-6 text-right text-gray-600">{m.byGrade[g].median ?? '—'} <span className="text-xs text-gray-400">×{m.byGrade[g].count}</span></td>
                          <td className="py-1 text-right font-medium text-blue-700">{recommendedPlan(m, g, month || undefined) ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}

                {/* Сезональність */}
                {m.seasonality.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Сезональність (індекс місяця = середнє місяця / середнє за весь період):</p>
                    <div className="flex flex-wrap gap-1.5">
                      {m.seasonality.map((s) => (
                        <span key={s.month} className={`text-xs px-2 py-0.5 rounded-full border ${s.index >= 1 ? 'border-green-300 text-green-700 bg-green-50' : 'border-gray-200 text-gray-600 bg-gray-50'}`}>
                          {s.month}: {s.index}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
