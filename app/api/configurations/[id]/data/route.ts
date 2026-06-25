// app/api/configurations/[id]/data/route.ts
// DATA — внесення фактичних значень (F-20). Доступно OPERATIONS і тімліду-власнику;
// менеджеру — лише по своїх рядках і якщо дозволено (allowManagerInput, F-27).
// Лише поки конфігурація ACTIVE.

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { parseBody, dataSchema } from '@/lib/validation';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'MANAGER']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({
    where: { id },
    include: { metrics: { select: { metricId: true } }, managers: { select: { id: true, userId: true } } },
  });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  // Менеджер: лише якщо дозволено і лише по власних рядках.
  let allowedManagerIds: Set<string> | null = null;
  if (guard.user.role === 'MANAGER') {
    if (!config.allowManagerInput) {
      return NextResponse.json({ error: 'Внесення факту менеджером не дозволено для цієї конфігурації' }, { status: 403 });
    }
    allowedManagerIds = new Set(
      config.managers.filter((m) => m.userId === guard.user.userId).map((m) => m.id)
    );
    if (allowedManagerIds.size === 0) {
      return NextResponse.json({ error: 'Ви не привʼязані до цієї команди' }, { status: 403 });
    }
  }

  if (config.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Вносити факт можна лише в активну конфігурацію' }, { status: 400 });
  }

  const parsed = await parseBody(request, dataSchema);
  if ('error' in parsed) return parsed.error;
  const { entries, period } = parsed.data;
  const selectedPeriod = period ?? config.period; // W: місяць факту

  // Незмінність HISTORY: якщо цей місяць уже збережено — факт редагувати не можна.
  const saved = await prisma.historyRecord.count({ where: { configurationId: id, period: selectedPeriod } });
  if (saved > 0) {
    return NextResponse.json({ error: 'Місяць збережено в HISTORY — дані заблоковані' }, { status: 400 });
  }

  const validMetrics = new Set(config.metrics.map((m) => m.metricId));
  const validManagers = allowedManagerIds ?? new Set(config.managers.map((m) => m.id));

  const ops = entries
    .filter((e) => validMetrics.has(e.metricId) && validManagers.has(e.managerId))
    .map((e) => {
      const fact =
        e.factValue === null || e.factValue === '' ? null : new Prisma.Decimal(e.factValue);
      return prisma.factRecord.upsert({
        where: {
          configurationId_managerId_metricId_period: {
            configurationId: id,
            managerId: e.managerId,
            metricId: e.metricId,
            period: selectedPeriod,
          },
        },
        update: { factValue: fact, updatedBy: guard.user.userId },
        create: {
          configurationId: id,
          managerId: e.managerId,
          metricId: e.metricId,
          period: selectedPeriod,
          factValue: fact,
          updatedBy: guard.user.userId,
        },
      });
    });

  if (ops.length > 0) {
    await prisma.$transaction(ops);
  }
  return NextResponse.json({ message: 'Факт збережено', count: ops.length });
}
