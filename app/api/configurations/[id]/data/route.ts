// app/api/configurations/[id]/data/route.ts
// DATA — внесення фактичних значень (F-20). Доступно OPERATIONS і тімліду-власнику,
// лише поки конфігурація ACTIVE.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

interface Entry {
  managerId: string;
  metricId: string;
  factValue: number | string | null;
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({
    where: { id },
    include: { metrics: { select: { metricId: true } }, managers: { select: { id: true } } },
  });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }
  if (config.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Вносити факт можна лише в активну конфігурацію' }, { status: 400 });
  }

  // Незмінність HISTORY: якщо період уже збережено — факт редагувати не можна.
  const saved = await prisma.historyRecord.count({ where: { configurationId: id, period: config.period } });
  if (saved > 0) {
    return NextResponse.json({ error: 'Місяць збережено в HISTORY — дані заблоковані' }, { status: 400 });
  }

  const { entries } = (await request.json()) as { entries: Entry[] };
  if (!Array.isArray(entries)) {
    return NextResponse.json({ error: 'Невірний формат даних' }, { status: 400 });
  }

  const validMetrics = new Set(config.metrics.map((m) => m.metricId));
  const validManagers = new Set(config.managers.map((m) => m.id));

  const ops = entries
    .filter((e) => validMetrics.has(e.metricId) && validManagers.has(e.managerId))
    .map((e) => {
      const fact =
        e.factValue === null || e.factValue === '' ? null : new Prisma.Decimal(e.factValue);
      return prisma.currentData.upsert({
        where: {
          configurationId_managerId_metricId: {
            configurationId: id,
            managerId: e.managerId,
            metricId: e.metricId,
          },
        },
        update: { factValue: fact, updatedBy: guard.user.userId },
        create: {
          configurationId: id,
          managerId: e.managerId,
          metricId: e.metricId,
          factValue: fact,
          updatedBy: guard.user.userId,
        },
      });
    });

  await prisma.$transaction(ops);
  return NextResponse.json({ message: 'Факт збережено', count: ops.length });
}
