// components/ManagerDashboard.tsx
'use client';

import { useEffect, useState } from 'react';

interface MetricResult {
  metricId: string; name: string; unit: string | null; weight: number;
  plan: number | null; fact: number | null; percentage: number | null;
}
interface KpiCard {
  configId: string; period: string; department: string; currency: string;
  manager: { name: string; grade: string; metrics: MetricResult[]; kpiPercentage: number; bonusAmount: number };
}
interface HistoryRec {
  id: string; period: string; kpiPercentage: number; bonusAmount: number; comment: string | null;
  configuration: { department: { name: string } };
  metrics: { metric: { name: string; unit: string | null }; planValue: number | null; factValue: number | null; metricPercentage: number; weight: number }[];
}

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function ManagerDashboard() {
  const [cards, setCards] = useState<KpiCard[]>([]);
  const [history, setHistory] = useState<HistoryRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/me/kpi').then((r) => r.json()),
      fetch('/api/me/history').then((r) => r.json()),
    ])
      .then(([k, h]) => { setCards(k); setHistory(h); })
      .catch(() => setError('Не вдалося завантажити дані'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><p className="text-gray-500 text-sm">Завантаження...</p></Card>;
  if (error) return <Card><p className="text-red-600 text-sm">{error}</p></Card>;

  return (
    <div className="space-y-6">
      {cards.length === 0 ? (
        <Card><p className="text-gray-500 text-sm">У вас поки немає активних KPI-конфігурацій. Зверніться до Operations для прив&apos;язки акаунта.</p></Card>
      ) : (
        cards.map((c) => (
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
                    <td className="py-1.5 px-2 text-right text-gray-700">{m.fact ?? '—'}</td>
                    <td className={`py-1.5 px-2 text-right ${m.percentage == null ? 'text-gray-300' : m.percentage >= 100 ? 'text-green-600' : 'text-gray-700'}`}>
                      {m.percentage == null ? '—' : `${m.percentage}%`}
                    </td>
                    <td className="py-1.5 px-2 text-right text-gray-400">{m.weight}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))
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
