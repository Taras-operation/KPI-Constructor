// app/api/configurations/[id]/status/route.ts
// Переходи статусної моделі конфігурації (ТЗ розд. 8.4).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';

type Action = 'SEND_FOR_APPROVAL' | 'ACTIVATE' | 'ARCHIVE' | 'APPROVE' | 'REQUEST_CORRECTION';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const { action, comment } = (await request.json()) as { action: Action; comment?: string };

  const config = await prisma.kPIConfiguration.findUnique({ where: { id } });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  const isOps = guard.user.role === 'OPERATIONS';
  const isOwnerLead = guard.user.role === 'TEAM_LEAD' && config.teamLeadId === guard.user.userId;

  let data: any = null;

  switch (action) {
    // --- Operations ---
    case 'SEND_FOR_APPROVAL': // F-12
      if (!isOps) return forbidden();
      if (!['DRAFT', 'ON_CORRECTION'].includes(config.status)) return badStatus();
      data = { status: 'ON_APPROVAL', approvedById: null, approvedAt: null };
      break;

    case 'ACTIVATE': // F-14 — після погодження тімліда
      if (!isOps) return forbidden();
      if (config.status !== 'ON_APPROVAL') return badStatus();
      if (!config.approvedAt) {
        return NextResponse.json({ error: 'Конфігурацію ще не погодив тімлід' }, { status: 400 });
      }
      data = { status: 'ACTIVE' };
      break;

    case 'ARCHIVE':
      if (!isOps) return forbidden();
      if (config.status !== 'ACTIVE') return badStatus();
      data = { status: 'ARCHIVED' };
      break;

    // --- Team Lead (Етап 4) ---
    case 'APPROVE': // F-16 — номінальне погодження
      if (!isOwnerLead) return forbidden();
      if (config.status !== 'ON_APPROVAL') return badStatus();
      data = { approvedById: guard.user.userId, approvedAt: new Date(), teamLeadComment: comment ?? config.teamLeadComment };
      break;

    case 'REQUEST_CORRECTION': // F-17 — коментар і повернення на коригування
      if (!isOwnerLead) return forbidden();
      if (config.status !== 'ON_APPROVAL') return badStatus();
      data = { status: 'ON_CORRECTION', teamLeadComment: comment ?? null, approvedById: null, approvedAt: null };
      break;

    default:
      return NextResponse.json({ error: 'Невідома дія' }, { status: 400 });
  }

  const updated = await prisma.kPIConfiguration.update({ where: { id }, data });
  return NextResponse.json(serialize(updated));
}

function forbidden() {
  return NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 });
}
function badStatus() {
  return NextResponse.json({ error: 'Дія недоступна для поточного статусу' }, { status: 400 });
}
