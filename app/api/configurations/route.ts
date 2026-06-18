// app/api/configurations/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { validateConfigInput, writeConfigChildren, type ConfigInput } from '@/lib/configuration';

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
    const body = await request.json();
    const { departmentId, teamLeadId, period, bonusModel, bonusParameters } = body;
    const input: ConfigInput = {
      metrics: body.metrics ?? [],
      managers: body.managers ?? [],
      plans: body.plans ?? {},
    };

    if (!departmentId || !teamLeadId || !period) {
      return NextResponse.json({ error: 'Відділ, тімлід і період обов\'язкові' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(period)) {
      return NextResponse.json({ error: 'Період має бути у форматі YYYYMM' }, { status: 400 });
    }
    if (!bonusModel || !['LINEAR', 'THRESHOLD', 'MATRIX'].includes(bonusModel)) {
      return NextResponse.json({ error: 'Невірна бонусна модель' }, { status: 400 });
    }
    if (!bonusParameters || typeof bonusParameters.baseBonus !== 'number') {
      return NextResponse.json({ error: 'Вкажіть базовий бонус' }, { status: 400 });
    }

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
          status: 'DRAFT',
          bonusModel,
          bonusParameters,
        },
      });
      await writeConfigChildren(tx, cfg.id, input);
      return cfg;
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
