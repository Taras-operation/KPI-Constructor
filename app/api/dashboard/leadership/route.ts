// app/api/dashboard/leadership/route.ts
// Зведений дашборд по відділах (F-28..F-30). Джерело — незмінний HISTORY.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

function quarterToPeriods(q: string): string[] | null {
  const m = /^(\d{4})Q([1-4])$/.exec(q);
  if (!m) return null;
  const year = m[1];
  const start = (Number(m[2]) - 1) * 3 + 1;
  return [start, start + 1, start + 2].map((mm) => `${year}${String(mm).padStart(2, '0')}`);
}

export async function GET(request: NextRequest) {
  const guard = await requireRole(['LEADERSHIP', 'OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const periodParam = searchParams.get('period');
  const quarterParam = searchParams.get('quarter');

  // Доступні періоди для фільтра
  const distinct = await prisma.historyRecord.findMany({
    select: { period: true },
    distinct: ['period'],
    orderBy: { period: 'desc' },
  });
  const availablePeriods = distinct.map((d) => d.period);

  let periods: string[] | null = null;
  if (quarterParam) periods = quarterToPeriods(quarterParam);
  else if (periodParam) periods = [periodParam];
  else if (availablePeriods.length) periods = [availablePeriods[0]];

  if (!periods || periods.length === 0) {
    return NextResponse.json({ period: null, availablePeriods, departments: [] });
  }

  const records = await prisma.historyRecord.findMany({
    where: { period: { in: periods } },
    include: {
      manager: { select: { name: true, grade: true } },
      configuration: { select: { departmentId: true, bonusParameters: true, department: { select: { name: true } } } },
    },
  });

  // Агрегація по відділу
  const byDept = new Map<string, any>();
  for (const r of records) {
    const deptId = r.configuration.departmentId;
    if (!byDept.has(deptId)) {
      const bp = (r.configuration.bonusParameters ?? {}) as any;
      byDept.set(deptId, {
        departmentId: deptId,
        name: r.configuration.department.name,
        currency: bp.currency ?? '$',
        kpiSum: 0,
        totalBonus: 0,
        managers: [] as any[],
      });
    }
    const d = byDept.get(deptId);
    const kpi = Number(r.kpiPercentage);
    const bonus = Number(r.bonusAmount);
    d.kpiSum += kpi;
    d.totalBonus += bonus;
    d.managers.push({ name: r.manager.name, grade: r.manager.grade, period: r.period, kpi, bonus });
  }

  const departments = Array.from(byDept.values())
    .map((d) => ({
      departmentId: d.departmentId,
      name: d.name,
      currency: d.currency,
      managerCount: d.managers.length,
      avgKpi: d.managers.length ? Math.round((d.kpiSum / d.managers.length) * 100) / 100 : 0,
      totalBonus: Math.round(d.totalBonus * 100) / 100,
      managers: d.managers,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({
    period: quarterParam || periods.join(','),
    availablePeriods,
    departments,
  });
}
