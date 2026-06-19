// components/LeadershipTrends.tsx
'use client';

import { useEffect, useState } from 'react';

interface SeriesPoint { period: string; totalBonus: number; avgKpi: number; managerCount: number }
interface DeptRow {
  departmentId: string; name: string; avgKpi: number; totalBonus: number;
  points: { period: string; avgKpi: number | null; totalBonus: number | null }[];
}
interface Data { periods: string[]; series: SeriesPoint[]; forecastBonus: number | null; byDepartment: DeptRow[] }

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function LeadershipTrends() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/leadership/trends')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><p className="text-gray-500 text-sm">Завантаження...</p></Card>;
  if (!data || data.series.length === 0) {
    return <Card><h2 className="text-xl font-semibold text-gray-900 mb-2">Аналітика</h2>
      <p className="text-gray-500 text-sm">Поки немає збережених періодів для трендів.</p></Card>;
  }

  const maxBonus = Math.max(...data.series.map((s) => s.totalBonus), 1);
  const lastBonus = data.series[data.series.length - 1].totalBonus;
  const delta = data.forecastBonus != null ? data.forecastBonus - lastBonus : 0;

  return (
    <Card>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Аналітика і тренди</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Stat label="Періодів у HISTORY" value={String(data.series.length)} />
        <Stat label="Останній бонусний фонд" value={lastBonus.toFixed(2)} />
        <Stat
          label="Прогноз наступного"
          value={data.forecastBonus != null ? data.forecastBonus.toFixed(2) : '—'}
          hint={data.forecastBonus != null ? `${delta >= 0 ? '+' : ''}${delta.toFixed(2)} до останнього` : undefined}
          hintColor={delta >= 0 ? 'text-green-600' : 'text-red-600'}
        />
      </div>

      {/* Бонусний фонд по періодах */}
      <h3 className="text-sm font-medium text-gray-700 mb-2">Бонусний фонд по періодах</h3>
      <div className="space-y-1.5 mb-6">
        {data.series.map((s) => (
          <div key={s.period} className="flex items-center gap-3 text-sm">
            <span className="w-16 text-gray-500 shrink-0">{fmtPeriod(s.period)}</span>
            <div className="flex-1 bg-gray-100 rounded h-5 relative">
              <div className="bg-blue-500 h-5 rounded" style={{ width: `${(s.totalBonus / maxBonus) * 100}%` }} />
            </div>
            <span className="w-24 text-right text-gray-700 shrink-0">{s.totalBonus.toFixed(2)}</span>
            <span className="w-16 text-right text-gray-400 shrink-0">{s.avgKpi}%</span>
          </div>
        ))}
      </div>

      {/* Порівняння відділів */}
      <h3 className="text-sm font-medium text-gray-700 mb-2">Порівняння відділів (за весь час)</h3>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-500 border-b border-gray-200">
            <th className="py-2 pr-4 font-medium">Відділ</th>
            <th className="py-2 px-2 font-medium text-right">Середній % KPI</th>
            <th className="py-2 px-2 font-medium text-right">Сумарні бонуси</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {data.byDepartment.map((d) => (
            <tr key={d.departmentId}>
              <td className="py-2 pr-4 text-gray-900 font-medium">{d.name}</td>
              <td className="py-2 px-2 text-right text-gray-900">{d.avgKpi}%</td>
              <td className="py-2 px-2 text-right text-gray-700">{d.totalBonus.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg shadow p-6">{children}</div>;
}

function Stat({ label, value, hint, hintColor }: { label: string; value: string; hint?: string; hintColor?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {hint && <p className={`text-xs mt-0.5 ${hintColor ?? 'text-gray-400'}`}>{hint}</p>}
    </div>
  );
}
