// components/FrontTable.tsx
// FRONT: внесення факту, авто-розрахунок % KPI і бонусу, збереження місяця в HISTORY.
'use client';

import { useCallback, useEffect, useState } from 'react';
import FactImport from './FactImport';

interface Props {
  configId: string;
  onClose: () => void;
}

interface FrontMetric { metricId: string; name: string; unit: string | null; weight: number }
interface FrontMetricResult extends FrontMetric { plan: number | null; fact: number | null; percentage: number | null }
interface FrontManager {
  id: string; name: string; grade: string;
  metrics: FrontMetricResult[]; kpiPercentage: number; bonusAmount: number;
}
interface Front {
  period: string; status: string; currency: string; saved: boolean;
  department: { name: string };
  managers: FrontManager[]; metrics: FrontMetric[];
}

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }
const GRADE: Record<string, string> = { JUNIOR: 'Jr', MIDDLE: 'Mid', SENIOR: 'Sr' };

export default function FrontTable({ configId, onClose }: Props) {
  const [front, setFront] = useState<Front | null>(null);
  const [facts, setFacts] = useState<Record<string, Record<string, string>>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch(`/api/configurations/${configId}/front`);
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка завантаження');
      const data: Front = await res.json();
      setFront(data);
      const f: Record<string, Record<string, string>> = {};
      data.managers.forEach((m) => {
        f[m.id] = {};
        m.metrics.forEach((mr) => { f[m.id][mr.metricId] = mr.fact != null ? String(mr.fact) : ''; });
      });
      setFacts(f);
    } catch (e: any) { setError(e.message); }
  }, [configId]);

  useEffect(() => { load(); }, [load]);

  function setFact(mgrId: string, metricId: string, v: string) {
    setFacts((p) => ({ ...p, [mgrId]: { ...(p[mgrId] || {}), [metricId]: v } }));
  }

  async function saveFacts() {
    if (!front) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const entries: any[] = [];
      front.managers.forEach((m) => {
        front.metrics.forEach((mt) => {
          const v = facts[m.id]?.[mt.metricId] ?? '';
          entries.push({ managerId: m.id, metricId: mt.metricId, factValue: v === '' ? null : Number(v) });
        });
      });
      const res = await fetch(`/api/configurations/${configId}/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка збереження факту');
      setInfo('Факт збережено, показники перераховано.');
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function saveMonth() {
    if (!confirm('Зберегти місяць у HISTORY? Після збереження дані стануть незмінними.')) return;
    setBusy(true); setError(''); setInfo('');
    try {
      const res = await fetch(`/api/configurations/${configId}/history`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comments }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка збереження місяця');
      setInfo('Місяць збережено в HISTORY.');
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">FRONT — поточний місяць</h3>
            {front && <p className="text-sm text-gray-500">{front.department.name} · період {fmtPeriod(front.period)}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700">✕</button>
        </div>

        <div className="px-6 py-4 overflow-auto flex-1">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-3 text-sm">{error}</div>}
          {info && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded mb-3 text-sm">{info}</div>}
          {front?.saved && (
            <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-2 rounded mb-3 text-sm">
              Місяць збережено в HISTORY — дані заблоковані від змін.
            </div>
          )}

          {front && !front.saved && (
            <div className="mb-4">
              <FactImport
                configId={configId}
                managers={front.managers.map((m) => ({ id: m.id, name: m.name }))}
                metrics={front.metrics.map((m) => ({ metricId: m.metricId, name: m.name }))}
                onImported={load}
              />
            </div>
          )}

          {!front ? (
            <p className="text-gray-500 text-sm">Завантаження...</p>
          ) : (
            <table className="text-sm border-collapse">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2 pr-3 font-medium sticky left-0 bg-white">Менеджер</th>
                  {front.metrics.map((mt) => (
                    <th key={mt.metricId} className="py-2 px-2 font-medium whitespace-nowrap text-center">
                      {mt.name}{mt.unit ? `, ${mt.unit}` : ''}<br /><span className="text-xs text-gray-400">вага {mt.weight}%</span>
                    </th>
                  ))}
                  <th className="py-2 px-2 font-medium text-center">% KPI</th>
                  <th className="py-2 px-2 font-medium text-center">Бонус</th>
                  <th className="py-2 px-2 font-medium">Коментар</th>
                </tr>
              </thead>
              <tbody>
                {front.managers.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100 align-top">
                    <td className="py-2 pr-3 whitespace-nowrap sticky left-0 bg-white">
                      <span className="text-gray-900 font-medium">{m.name}</span>{' '}
                      <span className="text-xs text-gray-400">{GRADE[m.grade] ?? m.grade}</span>
                    </td>
                    {m.metrics.map((mr) => (
                      <td key={mr.metricId} className="py-1.5 px-2 text-center">
                        <div className="text-xs text-gray-400 mb-0.5">план: {mr.plan ?? '—'}</div>
                        <input
                          type="number" step="any"
                          disabled={front.saved}
                          value={facts[m.id]?.[mr.metricId] ?? ''}
                          onChange={(e) => setFact(m.id, mr.metricId, e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-gray-900 text-center disabled:bg-gray-100"
                        />
                        <div className={`text-xs mt-0.5 ${mr.percentage == null ? 'text-gray-300' : mr.percentage >= 100 ? 'text-green-600' : 'text-gray-500'}`}>
                          {mr.percentage == null ? '—' : `${mr.percentage}%`}
                        </div>
                      </td>
                    ))}
                    <td className="py-1.5 px-2 text-center font-semibold text-gray-900">{m.kpiPercentage}%</td>
                    <td className="py-1.5 px-2 text-center font-semibold text-gray-900 whitespace-nowrap">{front.currency} {m.bonusAmount.toFixed(2)}</td>
                    <td className="py-1.5 px-2">
                      <input
                        disabled={front.saved}
                        value={comments[m.id] ?? ''}
                        onChange={(e) => setComments((p) => ({ ...p, [m.id]: e.target.value }))}
                        placeholder="..."
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-gray-900 disabled:bg-gray-100"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {front && !front.saved && (
          <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
            <button onClick={saveFacts} disabled={busy} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50">
              Зберегти факт
            </button>
            <button onClick={saveMonth} disabled={busy} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg">
              {busy ? 'Обробка...' : 'Зберегти місяць'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
