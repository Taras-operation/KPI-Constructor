// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

// GET — список користувачів з опційним фільтром по ролі / відділу. Тільки OPERATIONS.
export async function GET(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const role = searchParams.get('role');
  const departmentId = searchParams.get('departmentId');

  const where: Prisma.UserWhereInput = {};
  if (role) where.role = role as any;
  if (departmentId) where.departmentId = departmentId;

  const users = await prisma.user.findMany({
    where,
    select: { id: true, name: true, email: true, role: true, departmentId: true },
    orderBy: { name: 'asc' },
  });

  return NextResponse.json(users);
}
