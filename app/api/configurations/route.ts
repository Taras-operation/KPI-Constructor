// app/api/configurations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { validateConfigInput, writeConfigChildren, type ConfigInput } from '@/lib/configuration';
import { logAudit } from '@/lib/audit';
import { parseBody, configurationCreateSchema } from '@/lib/validation';

// GET — список конфігурацій. OPERATIONS бачить усі; TEAM_LEAD — лише свої.
export async function GET(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const period = searchParams.get('period');

  const where: Prisma.KPIConfigurationWhereInput = {};
  if (status) where.status = status as any;
  if (period) where.period = period;
  if (guard.user.role === 'TEAM_LEAD') where.teamLeadId = guard.user.userId;

  const configs = await prisma.kPIConfiguration.findMany({
    where,
    include: {
      department: true,
      teamLead: { select: { id: true, name: true, email: true } },
      _count: { select: { metrics: true, managers: true } },
    },
    orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
  });

  return NextResponse.json(serialize(configs));
}

// POST — створення нової конфігурації (DRAFT). Тільки OPERATIONS (F-06..F-11).
export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  try {
    const parsed = await parseBody(request, configurationCreateSchema);
    if ('error' in parsed) return parsed.error;
    const { departmentId, teamLeadId, period, periodicity, bonusModel, bonusParameters, allowManagerInput } = parsed.data;
    const input: ConfigInput = {
      metrics: parsed.data.metrics,
      managers: parsed.data.managers,
      plans: parsed.data.plans ?? {},
    };

    // Обов'язкові для відділу метрики (F-07)
    const requiredMetrics = await prisma.metric.findMany({
      where: { status: 'ACTIVE', requiredForDepartments: { has: departmentId } },
      select: { id: true },
    });
    const validationError = validateConfigInput(input, requiredMetrics.map((m) => m.id));
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const config = await prisma.$transaction(async (tx) => {
      const cfg = await tx.kPIConfiguration.create({
        data: {
          departmentId,
          teamLeadId,
          period,
          periodicity: periodicity ?? 'MONTHLY',
          status: 'DRAFT',
          allowManagerInput: allowManagerInput ?? false,
          bonusModel,
          bonusParameters,
        },
      });
      await writeConfigChildren(tx, cfg.id, input);
      return cfg;
    });

    await logAudit({
      userId: guard.user.userId,
      action: 'CREATE',
      tableName: 'KPIConfiguration',
      recordId: config.id,
      newValues: { departmentId, teamLeadId, period, bonusModel },
    });

    return NextResponse.json(serialize(config), { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Для цього відділу вже існує конфігурація на цей період' },
        { status: 400 }
      );
    }
    console.error('Помилка при створенні конфігурації:', error);
    return NextResponse.json({ error: 'Помилка при створенні конфігурації' }, { status: 500 });
  }
}
