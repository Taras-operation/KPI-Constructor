// components/ManagerDashboard.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';

interface MetricResult {
  metricId: string; name: string; unit: string | null; weight: number;
  plan: number | null; fact: number | null; percentage: number | null;
}
interface KpiCard {
  configId: string; period: string; department: string; currency: string;
  allowManagerInput: boolean; saved: boolean;
  manager: { id: string; name: string; grade: string; metrics: MetricResult[]; kpiPercentage: number; bonusAmount: number };
}
interface HistoryRec {
  id: string; period: string; kpiPercentage: number; bonusAmount: number; comment: string | null;
  configuration: { department: { name: string } };
}

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function ManagerDashboard() {
  const [cards, setCards] = useState<KpiCard[]>([]);
  const [history, setHistory] = useState<HistoryRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  // Редагований факт: facts[configId][metricId]
  const [facts, setFacts] = useState<Record<string, Record<string, string>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [info, setInfo] = useState('');

  const load = useCallback(async () => {
    setError(''); setInfo('');
    try {
      const [k, h] = await Promise.all([
        fetch('/api/me/kpi').then((r) => r.json()),
        fetch('/api/me/history').then((r) => r.json()),
      ]);
      setCards(k);
      setHistory(h);
      const f: Record<string, Record<string, string>> = {};
      (k as KpiCard[]).forEach((c) => {
        f[c.configId] = {};
        c.manager.metrics.forEach((m) => { f[c.configId][m.metricId] = m.fact != null ? String(m.fact) : ''; });
      });
      setFacts(f);
    } catch {
      setError('Не вдалося завантажити дані');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function setFact(configId: string, metricId: string, v: string) {
    setFacts((p) => ({ ...p, [configId]: { ...(p[configId] || {}), [metricId]: v } }));
  }

  async function saveFacts(c: KpiCard) {
    setSavingId(c.configId); setError(''); setInfo('');
    try {
      const entries = c.manager.metrics.map((m) => ({
        managerId: c.manager.id,
        metricId: m.metricId,
        factValue: (facts[c.configId]?.[m.metricId] ?? '') === '' ? null : Number(facts[c.configId][m.metricId]),
      }));
      const res = await fetch(`/api/configurations/${c.configId}/data`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка збереження');
      setInfo('Факт збережено, показники перераховано.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingId(null);
    }
  }

  if (loading) return <Card><p className="text-gray-500 text-sm">Завантаження...</p></Card>;
  if (error && cards.length === 0) return <Card><p className="text-red-600 text-sm">{error}</p></Card>;

  return (
    <div className="space-y-6">
      {error && <Card><p className="text-red-600 text-sm">{error}</p></Card>}
      {info && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-2 rounded-lg text-sm">{info}</div>}

      {cards.length === 0 ? (
        <Card><p className="text-gray-500 text-sm">У вас поки немає активних KPI-конфігурацій. Зверніться до Operations для прив&apos;язки акаунта.</p></Card>
      ) : (
        cards.map((c) => {
          const editable = c.allowManagerInput && !c.saved;
          return (
            <Card key={c.configId}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{c.department} · {fmtPeriod(c.period)}</h2>
                  <p className="text-sm text-gray-500">{c.manager.name} ({c.manager.grade})</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-gray-900">{c.manager.kpiPercentage}%</p>
                  <p className="text-sm text-green-700 font-medium">Бонус: {c.currency} {c.manager.bonusAmount.toFixed(2)}</p>
                </div>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 border-b border-gray-200">
                    <th className="py-1.5 pr-4 font-medium">Метрика</th>
                    <th className="py-1.5 px-2 font-medium text-right">План</th>
                    <th className="py-1.5 px-2 font-medium text-right">Факт</th>
                    <th className="py-1.5 px-2 font-medium text-right">%</th>
                    <th className="py-1.5 px-2 font-medium text-right">Вага</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {c.manager.metrics.map((m) => (
                    <tr key={m.metricId}>
                      <td className="py-1.5 pr-4 text-gray-900">{m.name}{m.unit ? `, ${m.unit}` : ''}</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{m.plan ?? '—'}</td>
                      <td className="py-1.5 px-2 text-right">
                        {editable ? (
                          <input
                            type="number" step="any"
                            value={facts[c.configId]?.[m.metricId] ?? ''}
                            onChange={(e) => setFact(c.configId, m.metricId, e.target.value)}
                            className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900 text-right"
                          />
                        ) : (
                          <span className="text-gray-700">{m.fact ?? '—'}</span>
                        )}
                      </td>
                      <td className={`py-1.5 px-2 text-right ${m.percentage == null ? 'text-gray-300' : m.percentage >= 100 ? 'text-green-600' : 'text-gray-700'}`}>
                        {m.percentage == null ? '—' : `${m.percentage}%`}
                      </td>
                      <td className="py-1.5 px-2 text-right text-gray-400">{m.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {editable && (
                <div className="flex justify-end mt-4">
                  <button onClick={() => saveFacts(c)} disabled={savingId === c.configId}
                    className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-lg transition">
                    {savingId === c.configId ? 'Збереження...' : 'Зберегти факт'}
                  </button>
                </div>
              )}
              {c.saved && <p className="text-xs text-blue-600 mt-3">Місяць збережено — дані заблоковані.</p>}
            </Card>
          );
        })
      )}

      {history.length > 0 && (
        <Card>
          <button onClick={() => setShowHistory((v) => !v)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
            {showHistory ? '▾' : '▸'} Моя історія ({history.length})
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {history.map((h) => (
                <div key={h.id} className="flex items-center justify-between border-b border-gray-100 py-2 text-sm">
                  <span className="text-gray-700">{h.configuration.department.name} · {fmtPeriod(h.period)}</span>
                  <span className="text-gray-900 font-medium">{h.kpiPercentage}% · {h.bonusAmount.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg shadow p-6">{children}</div>;
}
