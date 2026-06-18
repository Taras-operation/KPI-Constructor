// app/api/users/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseBody, userCreateSchema } from '@/lib/validation';

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

// POST — створення користувача з будь-якою роллю (Q-04). Тільки OPERATIONS.
export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  try {
    const parsed = await parseBody(request, userCreateSchema);
    if ('error' in parsed) return parsed.error;
    const { email, password, name, role, departmentId } = parsed.data;

    const passwordHash = await hashPassword(password);
    const user = await prisma.user.create({
      data: { email, passwordHash, name, role, departmentId: departmentId || null },
      select: { id: true, name: true, email: true, role: true, departmentId: true },
    });

    await logAudit({ userId: guard.user.userId, action: 'CREATE', tableName: 'User', recordId: user.id, newValues: { email, role } });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Користувач з таким email вже існує' }, { status: 400 });
    }
    console.error('Помилка при створенні користувача:', error);
    return NextResponse.json({ error: 'Помилка при створенні користувача' }, { status: 500 });
  }
}
