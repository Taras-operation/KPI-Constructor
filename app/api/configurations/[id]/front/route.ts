// app/api/configurations/[id]/front/route.ts
// FRONT — зведена таблиця з розрахунком % KPI і бонусу (F-18, F-21, F-22).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { buildFront } from '@/lib/front-data';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const bundle = await buildFront(id);
  if (!bundle) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  const { config, results } = bundle;
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  // Чи вже збережений цей період у HISTORY
  const savedCount = await prisma.historyRecord.count({
    where: { configurationId: id, period: config.period },
  });

  const bp = (config.bonusParameters ?? {}) as any;

  return NextResponse.json({
    id: config.id,
    period: config.period,
    status: config.status,
    department: config.department,
    currency: bp.currency ?? '$',
    bonusModel: config.bonusModel,
    saved: savedCount > 0,
    managers: results,
    metrics: config.metrics.map((cm) => ({
      metricId: cm.metricId,
      name: cm.metric.name,
      unit: cm.metric.unit,
      weight: Number(cm.weight),
    })),
  });
}
