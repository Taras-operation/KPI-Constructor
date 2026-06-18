// components/LeadershipDashboard.tsx
'use client';

import { Fragment, useEffect, useState } from 'react';

interface MgrRow { name: string; grade: string; period: string; kpi: number; bonus: number }
interface DeptRow {
  departmentId: string; name: string; currency: string;
  managerCount: number; avgKpi: number; totalBonus: number; managers: MgrRow[];
}
interface Data { period: string | null; availablePeriods: string[]; departments: DeptRow[] }

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function LeadershipDashboard() {
  const [data, setData] = useState<Data | null>(null);
  const [period, setPeriod] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    const qs = period ? `?period=${period}` : '';
    fetch(`/api/dashboard/leadership${qs}`)
      .then((r) => r.json())
      .then((d: Data) => { setData(d); if (!period && d.period && !d.period.includes(',')) setPeriod(d.period); })
      .catch(() => setError('Не вдалося завантажити дашборд'))
      .finally(() => setLoading(false));
  }, [period]);

  const grandBonus = data?.departments.reduce((s, d) => s + d.totalBonus, 0) ?? 0;
  const grandManagers = data?.departments.reduce((s, d) => s + d.managerCount, 0) ?? 0;

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Зведений дашборд</h2>
        <select value={period} onChange={(e) => setPeriod(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
          {data?.availablePeriods.length === 0 && <option value="">Немає даних</option>}
          {data?.availablePeriods.map((p) => <option key={p} value={p}>{fmtPeriod(p)}</option>)}
        </select>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : !data || data.departments.length === 0 ? (
        <p className="text-gray-500 text-sm">Немає збережених результатів за обраний період.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <Stat label="Менеджерів" value={String(grandManagers)} />
            <Stat label="Бонусний фонд" value={grandBonus.toFixed(2)} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Відділ</th>
                <th className="py-2 px-2 font-medium text-right">Менеджерів</th>
                <th className="py-2 px-2 font-medium text-right">Середній % KPI</th>
                <th className="py-2 px-2 font-medium text-right">Сума бонусів</th>
                <th className="py-2 pl-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.departments.map((d) => (
                <Fragment key={d.departmentId}>
                  <tr>
                    <td className="py-2 pr-4 text-gray-900 font-medium">{d.name}</td>
                    <td className="py-2 px-2 text-right text-gray-700">{d.managerCount}</td>
                    <td className="py-2 px-2 text-right text-gray-900 font-semibold">{d.avgKpi}%</td>
                    <td className="py-2 px-2 text-right text-gray-900">{d.currency} {d.totalBonus.toFixed(2)}</td>
                    <td className="py-2 pl-2 text-right">
                      <button onClick={() => setExpanded(expanded === d.departmentId ? null : d.departmentId)} className="text-blue-600 hover:text-blue-800 text-xs">
                        {expanded === d.departmentId ? 'Згорнути' : 'Деталі'}
                      </button>
                    </td>
                  </tr>
                  {expanded === d.departmentId && d.managers.map((m, i) => (
                    <tr key={d.departmentId + i} className="bg-gray-50">
                      <td className="py-1.5 pr-4 pl-6 text-gray-600">{m.name} <span className="text-xs text-gray-400">{m.grade}</span></td>
                      <td></td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{m.kpi}%</td>
                      <td className="py-1.5 px-2 text-right text-gray-700">{d.currency} {m.bonus.toFixed(2)}</td>
                      <td></td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  );
}
