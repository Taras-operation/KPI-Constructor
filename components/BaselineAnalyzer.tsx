// components/BaselineAnalyzer.tsx
'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseTable, analyzeBaseline, recommendedPlan, type BaselineResult } from '@/lib/baseline';

const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
const GRADE_LABEL: Record<string, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };

const SAMPLE_HEADERS = ['period', 'grade', 'FTD', 'Cost per FTD'];
const SAMPLE_ROWS = [
  ['202401', 'JUNIOR', '100', '12'],
  ['202401', 'SENIOR', '200', '8'],
  ['202402', 'JUNIOR', '120', '11'],
  ['202402', 'SENIOR', '220', '9'],
];

function stability(cv: number | null): { label: string; cls: string } {
  if (cv == null) return { label: '—', cls: 'text-gray-400' };
  if (cv < 0.3) return { label: `стабільна (CV ${cv})`, cls: 'text-green-600' };
  if (cv < 0.6) return { label: `помірна (CV ${cv})`, cls: 'text-amber-600' };
  return { label: `нестабільна (CV ${cv})`, cls: 'text-red-600' };
}

// Привести рядки до довжини заголовків.
function normalize(headers: string[], rows: string[][]): string[][] {
  return rows.map((r) => {
    const out = headers.map((_, i) => (r[i] ?? '').toString());
    return out;
  });
}

export default function BaselineAnalyzer() {
  const [headers, setHeaders] = useState<string[]>(['period', 'grade', 'FTD']);
  const [rows, setRows] = useState<string[][]>([['', '', '']]);
  const [result, setResult] = useState<BaselineResult | null>(null);
  const [month, setMonth] = useState('');
  const [error, setError] = useState('');
  const [url, setUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  function setGrid(h: string[], r: string[][]) {
    const safeHeaders = h.length ? h : ['period', 'grade'];
    setHeaders(safeHeaders);
    setRows(normalize(safeHeaders, r.length ? r : [safeHeaders.map(() => '')]));
    setResult(null);
  }

  // --- Редагування сітки ---
  function setHeader(i: number, v: string) { setHeaders((h) => h.map((x, idx) => (idx === i ? v : x))); }
  function setCell(ri: number, ci: number, v: string) {
    setRows((rs) => rs.map((r, idx) => (idx === ri ? r.map((c, cidx) => (cidx === ci ? v : c)) : r)));
  }
  function addColumn() { setHeaders((h) => [...h, `Метрика ${h.length - 1}`]); setRows((rs) => rs.map((r) => [...r, ''])); }
  function removeColumn(i: number) {
    if (headers.length <= 2) return;
    setHeaders((h) => h.filter((_, idx) => idx !== i));
    setRows((rs) => rs.map((r) => r.filter((_, idx) => idx !== i)));
  }
  function addRow() { setRows((rs) => [...rs, headers.map(() => '')]); }
  function removeRow(i: number) { setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, idx) => idx !== i))); }

  // --- Імпорт ---
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const buf = await file.arrayBuffer();
        const wb = XLSX.read(buf, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, raw: false });
        if (aoa.length === 0) { setError('Порожній аркуш.'); return; }
        setGrid(aoa[0].map((x) => String(x ?? '')), aoa.slice(1).map((r) => r.map((c) => String(c ?? ''))));
      } else {
        const t = parseTable(await file.text());
        setGrid(t.headers, t.rows);
      }
    } catch {
      setError('Не вдалося прочитати файл.');
    }
    e.target.value = '';
  }

  async function importSheet() {
    if (!url.trim()) return;
    setImporting(true); setError('');
    try {
      const res = await fetch('/api/baseline/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка імпорту');
      const t = parseTable(data.text);
      setGrid(t.headers, t.rows);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setImporting(false);
    }
  }

  function applyPaste() {
    const t = parseTable(pasteText);
    if (t.headers.length === 0) { setError('Порожній текст.'); return; }
    setGrid(t.headers, t.rows);
    setPasteOpen(false);
    setPasteText('');
  }

  function reset() {
    if (rows.some((r) => r.some((c) => c.trim() !== '')) && !confirm('Очистити всю таблицю?')) return;
    setHeaders(['period', 'grade', 'FTD']);
    setRows([['', '', '']]);
    setResult(null);
    setError('');
    setUrl('');
    setPasteText('');
  }

  function analyze() {
    setError('');
    const filled = rows.filter((r) => r.some((c) => c.trim() !== ''));
    if (filled.length === 0) { setError('Заповніть хоча б один рядок.'); setResult(null); return; }
    setResult(analyzeBaseline({ headers, rows: filled }));
  }

  const inp = 'px-2 py-1 border border-gray-300 rounded text-gray-900 text-sm outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Baseline Analyzer</h2>
      <p className="text-sm text-gray-500 mb-4">
        Заповніть таблицю або імпортуйте дані. Колонки <code className="bg-gray-100 px-1 rounded">period</code>,{' '}
        <code className="bg-gray-100 px-1 rounded">grade</code> + метрики. Інструмент рахує медіани по грейдах,
        стабільність, сезональність і рекомендовані плани.
      </p>

      {/* Джерела */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:border-blue-400 shrink-0">
          📄 Файл CSV / XLSX
          <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleFile} className="hidden" />
        </label>
        <div className="flex-1 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)}
            placeholder="Посилання на Google-таблицю (доступ «за посиланням»)" className={`flex-1 ${inp}`} />
          <button onClick={importSheet} disabled={importing} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 disabled:opacity-50 whitespace-nowrap">
            {importing ? '...' : 'Імпорт'}
          </button>
        </div>
      </div>

      {/* Редагована таблиця */}
      <div className="overflow-x-auto border border-gray-200 rounded-lg">
        <table className="text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="w-8"></th>
              {headers.map((h, ci) => (
                <th key={ci} className="p-1.5">
                  <div className="flex items-center gap-1">
                    <input value={h} onChange={(e) => setHeader(ci, e.target.value)} className={`w-28 ${inp} font-medium`} />
                    {headers.length > 2 && (
                      <button onClick={() => removeColumn(ci)} title="Видалити колонку" className="text-gray-300 hover:text-red-600 text-xs">✕</button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-1.5">
                <button onClick={addColumn} className="text-blue-600 hover:text-blue-800 text-xs whitespace-nowrap">+ колонка</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} className="border-t border-gray-100">
                <td className="text-center">
                  <button onClick={() => removeRow(ri)} title="Видалити рядок" className="text-gray-300 hover:text-red-600 text-xs">✕</button>
                </td>
                {headers.map((_, ci) => (
                  <td key={ci} className="p-1">
                    <input value={r[ci] ?? ''} onChange={(e) => setCell(ri, ci, e.target.value)} className={`w-28 ${inp}`} />
                  </td>
                ))}
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 mt-3">
        <button onClick={addRow} className="text-blue-600 hover:text-blue-800 text-sm">+ рядок</button>
        <button onClick={() => setPasteOpen((v) => !v)} className="text-gray-500 hover:text-gray-800 text-sm">Вставити текстом</button>
        <button onClick={() => setGrid(SAMPLE_HEADERS, SAMPLE_ROWS)} className="text-gray-500 hover:text-gray-800 text-sm">Приклад</button>
        <button onClick={reset} className="text-gray-500 hover:text-red-600 text-sm">Очистити</button>
        <div className="ml-auto flex items-center gap-2 text-sm">
          <span className="text-gray-500">Місяць для плану:</span>
          <select value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1 border border-gray-300 rounded text-gray-900">
            <option value="">без сезонності</option>
            {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <button onClick={analyze} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">
          Аналізувати
        </button>
      </div>

      {pasteOpen && (
        <div className="mt-3">
          <textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} rows={6}
            placeholder={'period\tgrade\tFTD\n202401\tJUNIOR\t100'}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500" />
          <button onClick={applyPaste} className="mt-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400">
            Розібрати в таблицю
          </button>
        </div>
      )}

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

                {m.seasonality.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Сезональність (індекс = середнє місяця / середнє за весь період):</p>
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
