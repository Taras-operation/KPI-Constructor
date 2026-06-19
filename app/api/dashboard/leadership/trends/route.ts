// app/api/dashboard/leadership/trends/route.ts
// Аналітика руководства (Phase 2): тренди по періодах, прогноз бонусного фонду, порівняння відділів.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const guard = await requireRole(['LEADERSHIP', 'OPERATIONS']);
  if ('error' in guard) return guard.error;

  const records = await prisma.historyRecord.findMany({
    where: { configuration: { status: { not: 'ARCHIVED' } } },
    include: { configuration: { select: { status: true, department: { select: { id: true, name: true } } } } },
    orderBy: { period: 'asc' },
  });

  // Агрегація по періодах
  const periodMap = new Map<string, { kpiSum: number; bonus: number; count: number }>();
  // Агрегація відділ × період
  const deptPeriod = new Map<string, Map<string, { kpiSum: number; bonus: number; count: number }>>();
  const deptNames = new Map<string, string>();

  for (const r of records) {
    const kpi = Number(r.kpiPercentage);
    const bonus = Number(r.bonusAmount);
    const p = r.period;
    const dId = r.configuration.department.id;
    deptNames.set(dId, r.configuration.department.name);

    const pm = periodMap.get(p) ?? { kpiSum: 0, bonus: 0, count: 0 };
    pm.kpiSum += kpi; pm.bonus += bonus; pm.count += 1;
    periodMap.set(p, pm);

    if (!deptPeriod.has(dId)) deptPeriod.set(dId, new Map());
    const dm = deptPeriod.get(dId)!;
    const dpm = dm.get(p) ?? { kpiSum: 0, bonus: 0, count: 0 };
    dpm.kpiSum += kpi; dpm.bonus += bonus; dpm.count += 1;
    dm.set(p, dpm);
  }

  const periods = Array.from(periodMap.keys()).sort();
  const series = periods.map((p) => {
    const v = periodMap.get(p)!;
    return {
      period: p,
      totalBonus: Math.round(v.bonus * 100) / 100,
      avgKpi: v.count ? Math.round((v.kpiSum / v.count) * 100) / 100 : 0,
      managerCount: v.count,
    };
  });

  // Лінійний прогноз бонусного фонду на наступний період
  let forecastBonus: number | null = null;
  if (series.length >= 2) {
    const last = series[series.length - 1].totalBonus;
    const prev = series[series.length - 2].totalBonus;
    forecastBonus = Math.max(0, Math.round((last + (last - prev)) * 100) / 100);
  } else if (series.length === 1) {
    forecastBonus = series[0].totalBonus;
  }

  // Порівняння відділів (по всіх періодах)
  const byDepartment = Array.from(deptPeriod.entries())
    .map(([dId, dm]) => {
      const pts = periods.map((p) => {
        const v = dm.get(p);
        return v ? { period: p, avgKpi: Math.round((v.kpiSum / v.count) * 100) / 100, totalBonus: Math.round(v.bonus * 100) / 100 } : { period: p, avgKpi: null, totalBonus: null };
      });
      const allKpi = Array.from(dm.values());
      const totalBonus = allKpi.reduce((s, v) => s + v.bonus, 0);
      const avgKpi = allKpi.length ? allKpi.reduce((s, v) => s + v.kpiSum / v.count, 0) / allKpi.length : 0;
      return {
        departmentId: dId,
        name: deptNames.get(dId) ?? dId,
        avgKpi: Math.round(avgKpi * 100) / 100,
        totalBonus: Math.round(totalBonus * 100) / 100,
        points: pts,
      };
    })
    .sort((a, b) => b.avgKpi - a.avgKpi);

  return NextResponse.json({ periods, series, forecastBonus, byDepartment });
}
