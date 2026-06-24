// app/api/change-requests/route.ts
// Список запитів на зміну (для Operations). За замовчуванням — PENDING.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';

export async function GET(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') ?? 'PENDING';

  const requests = await prisma.configChangeRequest.findMany({
    where: status === 'ALL' ? {} : { status: status as any },
    include: {
      requestedBy: { select: { name: true, email: true } },
      configuration: { select: { department: { select: { name: true } }, period: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(serialize(requests));
}
