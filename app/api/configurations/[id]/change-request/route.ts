// app/api/configurations/[id]/change-request/route.ts
// D7: тімлід пропонує зміни конфігурації -> запит на аппрув Operations.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { parseBody, changeRequestSchema } from '@/lib/validation';
import { logAudit } from '@/lib/audit';
import { isCriticalChange } from '@/lib/change-classify';
import { applyConfigPayload } from '@/lib/apply-config';

// GET — список запитів на зміну для конфігурації (OPERATIONS або власник-тімлід).
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({ where: { id }, select: { teamLeadId: true } });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (guard.user.role === 'TEAM_LEAD' && config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }

  const requests = await prisma.configChangeRequest.findMany({
    where: { configurationId: id },
    include: { requestedBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(serialize(requests));
}

// POST — створити запит на зміну (тільки власник-тімлід, конфігурація ACTIVE).
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({
    where: { id },
    include: {
      metrics: { select: { metricId: true, weight: true } },
      managers: { select: { id: true, name: true, grade: true, baseBonus: true } },
      currentData: { select: { managerId: true, metricId: true, planValue: true } },
    },
  });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });
  if (config.teamLeadId !== guard.user.userId) {
    return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
  }
  if (config.status !== 'ACTIVE') {
    return NextResponse.json({ error: 'Пропонувати зміни можна лише для активної конфігурації' }, { status: 400 });
  }

  const parsed = await parseBody(request, changeRequestSchema);
  if ('error' in parsed) return parsed.error;
  const { summary, ...payload } = parsed.data;

  const critical = isCriticalChange(config, payload);

  // D6: некритичні зміни тімлід застосовує сам (Operations лише сповіщається).
  if (!critical) {
    const err = await applyConfigPayload(id, payload);
    if (err) return NextResponse.json({ error: err }, { status: 400 });
    const cr = await prisma.configChangeRequest.create({
      data: {
        configurationId: id,
        requestedById: guard.user.userId,
        summary: summary?.trim() || 'Некритична зміна (застосовано тімлідом)',
        payload: payload as any,
        critical: false,
        status: 'APPROVED',
        resolvedById: guard.user.userId,
        resolvedAt: new Date(),
      },
    });
    await logAudit({ userId: guard.user.userId, action: 'UPDATE', tableName: 'KPIConfiguration', recordId: id, newValues: { nonCriticalChange: true } });
    return NextResponse.json(serialize({ ...cr, applied: true }), { status: 200 });
  }

  // Критичні зміни — на аппрув Operations (уникаємо дублів незакритих).
  const open = await prisma.configChangeRequest.count({ where: { configurationId: id, status: 'PENDING' } });
  if (open > 0) {
    return NextResponse.json({ error: 'Вже є запит на зміну, що очікує розгляду' }, { status: 400 });
  }

  const cr = await prisma.configChangeRequest.create({
    data: {
      configurationId: id,
      requestedById: guard.user.userId,
      summary: summary?.trim() || 'Запропоновані зміни конфігурації',
      payload: payload as any,
      critical: true,
      status: 'PENDING',
    },
  });

  await logAudit({ userId: guard.user.userId, action: 'CREATE', tableName: 'ConfigChangeRequest', recordId: cr.id, newValues: { configurationId: id } });

  return NextResponse.json(serialize(cr), { status: 201 });
}
