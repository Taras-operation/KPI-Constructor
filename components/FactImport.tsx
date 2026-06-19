// components/FactImport.tsx
// Імпорт фактичних значень у FRONT з CSV/XLSX/Google-таблиці (основа API-інтеграцій).
// Формат: 1-ша колонка — ім'я менеджера, далі колонки = назви метрик.
'use client';

import { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseTable } from '@/lib/baseline';

interface Props {
  configId: string;
  managers: { id: string; name: string }[];
  metrics: { metricId: string; name: string }[];
  onImported: () => void;
}

export default function FactImport({ configId, managers, metrics, onImported }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: false });
        setText(aoa.map((r) => r.map((c) => String(c ?? '')).join('\t')).join('\n'));
      } else {
        setText(await file.text());
      }
    } catch { setErr('Не вдалося прочитати файл.'); }
    e.target.value = '';
  }

  async function importGoogle() {
    if (!url.trim()) return;
    setBusy(true); setErr('');
    try {
      const res = await fetch('/api/baseline/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка імпорту');
      setText(data.text);
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  async function doImport() {
    setErr(''); setMsg('');
    const t = parseTable(text);
    if (t.headers.length < 2 || t.rows.length === 0) { setErr('Потрібен заголовок (менеджер + метрики) і дані.'); return; }

    const mgrByName = new Map(managers.map((m) => [m.name.trim().toLowerCase(), m.id]));
    const metricByName = new Map(metrics.map((m) => [m.name.trim().toLowerCase(), m.metricId]));

    // Колонки метрик (усі, крім першої)
    const colMetric: (string | null)[] = t.headers.map((h, i) => (i === 0 ? null : metricByName.get(h.trim().toLowerCase()) ?? null));
    const unmatchedCols = t.headers.filter((_h, i) => i > 0 && !colMetric[i]);

    const entries: { managerId: string; metricId: string; factValue: number }[] = [];
    const unmatchedMgrs = new Set<string>();
    for (const row of t.rows) {
      const name = (row[0] ?? '').trim();
      if (!name) continue;
      const mgrId = mgrByName.get(name.toLowerCase());
      if (!mgrId) { unmatchedMgrs.add(name); continue; }
      for (let i = 1; i < t.headers.length; i++) {
        const metricId = colMetric[i];
        const raw = (row[i] ?? '').replace(',', '.').trim();
        if (!metricId || raw === '') continue;
        const val = Number(raw);
        if (!Number.isNaN(val)) entries.push({ managerId: mgrId, metricId, factValue: val });
      }
    }

    if (entries.length === 0) { setErr('Не знайдено співпадінь менеджерів/метрик з конфігурацією.'); return; }

    setBusy(true);
    try {
      const res = await fetch(`/api/configurations/${configId}/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка збереження');
      const warns: string[] = [];
      if (unmatchedMgrs.size) warns.push(`не знайдено менеджерів: ${[...unmatchedMgrs].join(', ')}`);
      if (unmatchedCols.length) warns.push(`пропущено колонки: ${unmatchedCols.join(', ')}`);
      setMsg(`Імпортовано ${entries.length} значень.${warns.length ? ' ' + warns.join('; ') : ''}`);
      setText('');
      onImported();
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-blue-600 hover:text-blue-800">
        ⬇ Імпортувати факт з таблиці
      </button>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-800">Імпорт факту (1-ша колонка — менеджер, далі — назви метрик)</h4>
        <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 text-sm">згорнути</button>
      </div>
      {err && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded mb-2 text-sm">{err}</div>}
      {msg && <div className="bg-green-50 border border-green-200 text-green-700 px-3 py-1.5 rounded mb-2 text-sm">{msg}</div>}

      <div className="flex flex-col sm:flex-row gap-2 mb-2">
        <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:border-blue-400 bg-white shrink-0">
          📄 CSV / XLSX
          <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={handleFile} className="hidden" />
        </label>
        <div className="flex-1 flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Посилання на Google-таблицю" className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-gray-900 text-sm" />
          <button onClick={importGoogle} disabled={busy} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white hover:border-blue-400 disabled:opacity-50">Імпорт</button>
        </div>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5}
        placeholder={'Менеджер\tFTD\tNet Revenue, $\nІван\t120\t5000'}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs" />
      <div className="flex justify-end mt-2">
        <button onClick={doImport} disabled={busy || !text.trim()} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-1.5 rounded-lg text-sm">
          {busy ? '...' : 'Імпортувати у факт'}
        </button>
      </div>
    </div>
  );
}
