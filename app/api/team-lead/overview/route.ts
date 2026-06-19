// app/api/team-lead/overview/route.ts
// Зведення по командах тімліда (для дашборду): розрахунок FRONT + агрегати.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { buildFront } from '@/lib/front-data';

export async function GET() {
  const guard = await requireRole(['TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const configs = await prisma.kPIConfiguration.findMany({
    where: { status: 'ACTIVE', teamLeadId: guard.user.userId },
    select: { id: true, period: true },
    orderBy: { period: 'desc' },
  });

  const teams = [];
  for (const c of configs) {
    const bundle = await buildFront(c.id);
    if (!bundle) continue;
    const { config, results } = bundle;
    const bp = (config.bonusParameters ?? {}) as any;
    const saved = await prisma.historyRecord.count({ where: { configurationId: c.id, period: config.period } });

    const withData = results.filter((r) => r.metrics.some((m) => m.fact != null));
    const avgKpi = withData.length
      ? Math.round((withData.reduce((s, r) => s + r.kpiPercentage, 0) / withData.length) * 100) / 100
      : 0;
    const totalBonus = Math.round(results.reduce((s, r) => s + r.bonusAmount, 0) * 100) / 100;
    const expectedCells = results.length * config.metrics.length;
    const filledCells = config.currentData.filter((d) => d.factValue !== null).length;

    teams.push({
      configId: c.id,
      period: config.period,
      department: config.department.name,
      currency: bp.currency ?? '$',
      saved: saved > 0,
      avgKpi,
      totalBonus,
      managerCount: results.length,
      missingCells: Math.max(0, expectedCells - filledCells),
      managers: results
        .map((r) => ({ id: r.id, name: r.name, grade: r.grade, kpiPercentage: r.kpiPercentage, bonusAmount: r.bonusAmount, hasData: r.metrics.some((m) => m.fact != null) }))
        .sort((a, b) => b.kpiPercentage - a.kpiPercentage),
    });
  }

  return NextResponse.json(teams);
}
