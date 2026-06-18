// app/api/configurations/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { validateConfigInput, writeConfigChildren, type ConfigInput } from '@/lib/configuration';
import { logAudit } from '@/lib/audit';

const EDITABLE_STATUSES = ['DRAFT', 'ON_CORRECTION'];

async function loadFull(id: string) {
  return prisma.kPIConfiguration.findUnique({
    where: { id },
    include: {
      department: true,
      teamLead: { select: { id: true, name: true, email: true } },
      metrics: { include: { metric: true } },
      managers: { orderBy: { createdAt: 'asc' } },
      currentData: true,
    },
  });
}

// GET — повна конфігурація. OPERATIONS будь-яку; TEAM_LEAD лише свою.
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await loadFull(id);
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  return NextResponse.json(serialize(config));
}

// PUT — оновлення конфігурації (лише DRAFT / ON_CORRECTION). Тільки OPERATIONS.
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const existing = await prisma.kPIConfiguration.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    return NextResponse.json({ error: 'Редагувати можна лише чернетку або конфігурацію на коригуванні' }, { status: 400 });
  }

  try {
    const body = await request.json();
    const departmentId = body.departmentId ?? existing.departmentId;
    const input: ConfigInput = {
      metrics: body.metrics ?? [],
      managers: body.managers ?? [],
      plans: body.plans ?? {},
    };

    if (body.bonusModel && !['LINEAR', 'THRESHOLD', 'MATRIX'].includes(body.bonusModel)) {
      return NextResponse.json({ error: 'Невірна бонусна модель' }, { status: 400 });
    }

    const requiredMetrics = await prisma.metric.findMany({
      where: { status: 'ACTIVE', requiredForDepartments: { has: departmentId } },
      select: { id: true },
    });
    const validationError = validateConfigInput(input, requiredMetrics.map((m) => m.id));
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.kPIConfiguration.update({
        where: { id },
        data: {
          departmentId,
          ...(body.teamLeadId && { teamLeadId: body.teamLeadId }),
          ...(body.period && { period: body.period }),
          ...(body.bonusModel && { bonusModel: body.bonusModel }),
          ...(body.bonusParameters && { bonusParameters: body.bonusParameters }),
        },
      });
      // Перезаписуємо вкладені дані (каскад видаляє CurrentData разом з менеджерами).
      await tx.configurationMetric.deleteMany({ where: { configurationId: id } });
      await tx.teamManager.deleteMany({ where: { configurationId: id } });
      await writeConfigChildren(tx, id, input);
    });

    await logAudit({ userId: guard.user.userId, action: 'UPDATE', tableName: 'KPIConfiguration', recordId: id });

    const updated = await loadFull(id);
    return NextResponse.json(serialize(updated));
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Для цього відділу вже існує конфігурація на цей період' },
        { status: 400 }
      );
    }
    console.error('Помилка при оновленні конфігурації:', error);
    return NextResponse.json({ error: 'Помилка при оновленні конфігурації' }, { status: 500 });
  }
}

// DELETE — видалення лише чернетки. Тільки OPERATIONS.
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const existing = await prisma.kPIConfiguration.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (existing.status !== 'DRAFT') {
    return NextResponse.json({ error: 'Видалити можна лише чернетку' }, { status: 400 });
  }

  await prisma.kPIConfiguration.delete({ where: { id } });
  await logAudit({ userId: guard.user.userId, action: 'DELETE', tableName: 'KPIConfiguration', recordId: id });
  return NextResponse.json({ message: 'Конфігурацію видалено' });
}
