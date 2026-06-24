// app/api/change-requests/[id]/resolve/route.ts
// D7/D6: Operations аппрувить або відхиляє запит тімліда на зміну конфігурації.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { parseBody, resolveSchema } from '@/lib/validation';
import { applyConfigPayload } from '@/lib/apply-config';
import { logAudit } from '@/lib/audit';
import { notifyUser } from '@/lib/telegram';

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
    notifyUser(cr.requestedById, '❌ Ваш запит на зміну конфігурації відхилено Operations.');
    return NextResponse.json(serialize(updated));
  }

  // APPROVE — застосовуємо запропоновану конфігурацію
  const p = cr.payload as any;
  const err = await applyConfigPayload(cr.configurationId, p);
  if (err) {
    return NextResponse.json({ error: `Зміни не валідні: ${err}` }, { status: 400 });
  }
  await prisma.configChangeRequest.update({
    where: { id },
    data: { status: 'APPROVED', resolvedById: guard.user.userId, resolvedAt: new Date() },
  });

  await logAudit({ userId: guard.user.userId, action: 'APPROVE', tableName: 'ConfigChangeRequest', recordId: id, newValues: { configurationId: cr.configurationId } });
  notifyUser(cr.requestedById, '✅ Ваш запит на зміну конфігурації схвалено й застосовано.');

  const updated = await prisma.configChangeRequest.findUnique({ where: { id } });
  return NextResponse.json(serialize(updated));
}
