// app/api/change-requests/[id]/resolve/route.ts
// D7/D6: Operations аппрувить або відхиляє запит тімліда на зміну конфігурації.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { parseBody, resolveSchema } from '@/lib/validation';
import { validateConfigInput, writeConfigChildren, type ConfigInput } from '@/lib/configuration';
import { logAudit } from '@/lib/audit';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const parsed = await parseBody(request, resolveSchema);
  if ('error' in parsed) return parsed.error;
  const { action } = parsed.data;

  const cr = await prisma.configChangeRequest.findUnique({ where: { id } });
  if (!cr) return NextResponse.json({ error: 'Запит не знайдено' }, { status: 404 });
  if (cr.status !== 'PENDING') {
    return NextResponse.json({ error: 'Запит вже розглянуто' }, { status: 400 });
  }

  if (action === 'REJECT') {
    const updated = await prisma.configChangeRequest.update({
      where: { id },
      data: { status: 'REJECTED', resolvedById: guard.user.userId, resolvedAt: new Date() },
    });
    await logAudit({ userId: guard.user.userId, action: 'UPDATE', tableName: 'ConfigChangeRequest', recordId: id, newValues: { status: 'REJECTED' } });
    return NextResponse.json(serialize(updated));
  }

  // APPROVE — застосовуємо запропоновану конфігурацію
  const p = cr.payload as any;
  const departmentId = p.departmentId ?? (await prisma.kPIConfiguration.findUnique({ where: { id: cr.configurationId }, select: { departmentId: true } }))?.departmentId;
  const input: ConfigInput = { metrics: p.metrics ?? [], managers: p.managers ?? [], plans: p.plans ?? {} };

  const requiredMetrics = await prisma.metric.findMany({
    where: { status: 'ACTIVE', requiredForDepartments: { has: departmentId } },
    select: { id: true },
  });
  const overrides = (p.requiredOverrides ?? []).filter((o: any) => o.reason?.trim());
  const justified = new Set<string>(overrides.map((o: any) => o.metricId));
  const validationError = validateConfigInput(input, requiredMetrics.map((m) => m.id), justified);
  if (validationError) {
    return NextResponse.json({ error: `Зміни не валідні: ${validationError}` }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.kPIConfiguration.update({
      where: { id: cr.configurationId },
      data: {
        ...(p.departmentId && { departmentId: p.departmentId }),
        ...(p.teamLeadId && { teamLeadId: p.teamLeadId }),
        ...(p.period && { period: p.period }),
        ...(p.periodicity && { periodicity: p.periodicity }),
        ...(p.bonusModel && { bonusModel: p.bonusModel }),
        ...(p.bonusParameters && { bonusParameters: p.bonusParameters }),
        ...(p.allowManagerInput !== undefined && { allowManagerInput: p.allowManagerInput }),
        requiredOverrides: overrides,
      },
    });
    await tx.configurationMetric.deleteMany({ where: { configurationId: cr.configurationId } });
    await tx.teamManager.deleteMany({ where: { configurationId: cr.configurationId } });
    await writeConfigChildren(tx, cr.configurationId, input);
    await tx.configChangeRequest.update({
      where: { id },
      data: { status: 'APPROVED', resolvedById: guard.user.userId, resolvedAt: new Date() },
    });
  });

  await logAudit({ userId: guard.user.userId, action: 'APPROVE', tableName: 'ConfigChangeRequest', recordId: id, newValues: { configurationId: cr.configurationId } });

  const updated = await prisma.configChangeRequest.findUnique({ where: { id } });
  return NextResponse.json(serialize(updated));
}
