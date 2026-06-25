// app/api/configurations/[id]/front/route.ts
// FRONT — зведена таблиця з розрахунком % KPI і бонусу (F-18, F-21, F-22).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { buildFront, periodsFrom } from '@/lib/front-data';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const periodParam = new URL(request.url).searchParams.get('period') ?? undefined;
  const bundle = await buildFront(id, periodParam);
  if (!bundle) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  const { config, results, selectedPeriod } = bundle;
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  // W: усі періоди від старту і які з них уже збережені в HISTORY
  const periods = periodsFrom(config.period, config.periodicity);
  const savedRows = await prisma.historyRecord.findMany({
    where: { configurationId: id },
    distinct: ['period'],
    select: { period: true },
  });
  const savedPeriods = savedRows.map((r) => r.period);

  const bp = (config.bonusParameters ?? {}) as any;

  return NextResponse.json({
    id: config.id,
    period: selectedPeriod,
    startPeriod: config.period,
    periodicity: config.periodicity,
    periods,
    savedPeriods,
    status: config.status,
    department: config.department,
    currency: bp.currency ?? '$',
    bonusModel: config.bonusModel,
    saved: savedPeriods.includes(selectedPeriod),
    managers: results,
    metrics: config.metrics.map((cm) => ({
      metricId: cm.metricId,
      name: cm.metric.name,
      unit: cm.metric.unit,
      weight: Number(cm.weight),
    })),
  });
}
