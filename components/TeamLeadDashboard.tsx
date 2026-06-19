// components/TeamLeadDashboard.tsx
'use client';

import { useEffect, useState } from 'react';

interface Mgr { id: string; name: string; grade: string; kpiPercentage: number; bonusAmount: number; hasData: boolean }
interface Team {
  configId: string; period: string; department: string; currency: string; saved: boolean;
  avgKpi: number; totalBonus: number; managerCount: number; missingCells: number; managers: Mgr[];
}

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }
const GRADE: Record<string, string> = { JUNIOR: 'Jr', MIDDLE: 'Mid', SENIOR: 'Sr' };

function zone(m: Mgr): { label: string; cls: string; bar: string } {
  if (!m.hasData) return { label: 'немає даних', cls: 'bg-gray-100 text-gray-500', bar: 'bg-gray-300' };
  if (m.kpiPercentage >= 100) return { label: 'перевиконав', cls: 'bg-green-100 text-green-700', bar: 'bg-green-500' };
  if (m.kpiPercentage >= 70) return { label: 'в нормі', cls: 'bg-blue-100 text-blue-700', bar: 'bg-blue-500' };
  return { label: 'просів', cls: 'bg-red-100 text-red-700', bar: 'bg-red-500' };
}

export default function TeamLeadDashboard() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/team-lead/overview').then((r) => r.json()).then((d) => Array.isArray(d) && setTeams(d)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) return <Card><p className="text-gray-500 text-sm">Завантаження...</p></Card>;
  if (teams.length === 0) return <Card><p className="text-gray-500 text-sm">Немає активних конфігурацій. Дані зʼявляться після активації Operations.</p></Card>;

  return (
    <div className="space-y-6">
      {teams.map((t) => {
        const withData = t.managers.filter((m) => m.hasData);
        const best = withData[0];
        const worst = withData.length > 1 ? withData[withData.length - 1] : null;
        return (
          <Card key={t.configId}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">{t.department} · {fmtPeriod(t.period)}</h2>
              {t.saved && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">місяць збережено</span>}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <Stat label="Середній % KPI" value={`${t.avgKpi}%`} />
              <Stat label="Бонусний фонд" value={`${t.currency} ${t.totalBonus.toFixed(2)}`} />
              <Stat label="Менеджерів" value={String(t.managerCount)} />
              <Stat label="Не внесено" value={String(t.missingCells)} warn={t.missingCells > 0} />
            </div>

            {withData.length > 0 && (best || worst) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-5">
                {best && (
                  <div className="border border-green-200 bg-green-50 rounded-lg p-3">
                    <p className="text-xs text-green-700 mb-0.5">🏆 Найкращий результат</p>
                    <p className="text-gray-900 font-medium">{best.name} <span className="text-gray-500 text-sm">— {best.kpiPercentage}%</span></p>
                  </div>
                )}
                {worst && (
                  <div className="border border-red-200 bg-red-50 rounded-lg p-3">
                    <p className="text-xs text-red-700 mb-0.5">⚠ Потребує уваги</p>
                    <p className="text-gray-900 font-medium">{worst.name} <span className="text-gray-500 text-sm">— {worst.kpiPercentage}%</span></p>
                  </div>
                )}
              </div>
            )}

            {/* Лідерборд менеджерів */}
            <div className="space-y-1.5">
              {t.managers.map((m) => {
                const z = zone(m);
                return (
                  <div key={m.id} className="flex items-center gap-3 text-sm">
                    <span className="w-40 shrink-0 truncate text-gray-900">{m.name} <span className="text-xs text-gray-400">{GRADE[m.grade] ?? m.grade}</span></span>
                    <div className="flex-1 bg-gray-100 rounded h-5 relative min-w-[120px]">
                      <div className={`h-5 rounded ${z.bar}`} style={{ width: `${Math.min(m.kpiPercentage, 120) / 1.2}%` }} />
                      <span className="absolute inset-y-0 left-2 flex items-center text-xs font-medium text-gray-700">{m.hasData ? `${m.kpiPercentage}%` : '—'}</span>
                    </div>
                    <span className={`w-28 text-center text-xs px-2 py-0.5 rounded-full shrink-0 ${z.cls}`}>{z.label}</span>
                    <span className="w-24 text-right text-gray-700 shrink-0">{t.currency} {m.bonusAmount.toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-white rounded-lg shadow p-6">{children}</div>;
}
function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${warn ? 'bg-amber-50' : 'bg-gray-50'}`}>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-2xl font-bold ${warn ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
    </div>
  );
}
