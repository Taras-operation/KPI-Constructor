// app/api/configurations/[id]/history/route.ts
// HISTORY — збереження місяця (F-23) і перегляд архіву. Після збереження дані незмінні.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { buildFront } from '@/lib/front-data';
import { logAudit } from '@/lib/audit';
import { parseBody, historySaveSchema } from '@/lib/validation';

// GET — збережені записи HISTORY для конфігурації.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({ where: { id }, select: { teamLeadId: true } });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  const records = await prisma.historyRecord.findMany({
    where: { configurationId: id },
    include: { manager: { select: { name: true, grade: true } }, metrics: { include: { metric: true } } },
    orderBy: [{ period: 'desc' }, { savedAt: 'desc' }],
  });

  return NextResponse.json(serialize(records));
}

// POST — зберегти місяць у HISTORY (F-23). OPERATIONS або тімлід-власник.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const bundle = await buildFront(id);
  if (!bundle) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  const { config, results } = bundle;
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }
  if (config.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Зберегти місяць можна лише для активної конфігурації' }, { status: 400 });
  }

  const already = await prisma.historyRecord.count({ where: { configurationId: id, period: config.period } });
  if (already > 0) {
    return NextResponse.json({ error: 'Цей місяць вже збережено в HISTORY (дані незмінні)' }, { status: 400 });
  }

  const parsed = await parseBody(request, historySaveSchema);
  if ('error' in parsed) return parsed.error;
  const { comments } = parsed.data;

  await prisma.$transaction(
    results.map((mgr) =>
      prisma.historyRecord.create({
        data: {
          configurationId: id,
          managerId: mgr.id,
          period: config.period,
          kpiPercentage: new Prisma.Decimal(mgr.kpiPercentage),
          bonusAmount: new Prisma.Decimal(mgr.bonusAmount),
          comment: comments?.[mgr.id] ?? null,
          metrics: {
            create: mgr.metrics.map((m) => ({
              metricId: m.metricId,
              planValue: m.plan != null ? new Prisma.Decimal(m.plan) : null,
              factValue: m.fact != null ? new Prisma.Decimal(m.fact) : null,
              metricPercentage: new Prisma.Decimal(m.percentage ?? 0),
              weight: new Prisma.Decimal(m.weight),
            })),
          },
        },
      })
    )
  );

  await logAudit({
    userId: guard.user.userId,
    action: 'CREATE',
    tableName: 'HistoryRecord',
    recordId: id,
    newValues: { period: config.period, records: results.length },
  });

  return NextResponse.json({ message: 'Місяць збережено в HISTORY', records: results.length }, { status: 201 });
}
