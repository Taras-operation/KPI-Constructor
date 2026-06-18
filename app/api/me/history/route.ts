// app/api/me/history/route.ts
// Історія результатів поточного менеджера (F-26).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';

export async function GET() {
  const guard = await requireRole(['MANAGER']);
  if ('error' in guard) return guard.error;

  const records = await prisma.historyRecord.findMany({
    where: { manager: { userId: guard.user.userId } },
    include: {
      configuration: { select: { department: { select: { name: true } } } },
      metrics: { include: { metric: { select: { name: true, unit: true } } } },
    },
    orderBy: { period: 'desc' },
  });

  return NextResponse.json(serialize(records));
}
