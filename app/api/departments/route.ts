// app/api/departments/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';
import { parseBody, departmentCreateSchema } from '@/lib/validation';

// GET — список відділів. Доступний будь-якому авторизованому користувачу.
export async function GET() {
  const guard = await requireRole();
  if ('error' in guard) return guard.error;

  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
    include: { _count: { select: { users: true, configurations: true } } },
  });

  return NextResponse.json(departments);
}

// POST — створення відділу. Тільки OPERATIONS.
export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  try {
    const parsed = await parseBody(request, departmentCreateSchema);
    if ('error' in parsed) return parsed.error;
    const { name, description } = parsed.data;

    const department = await prisma.department.create({
      data: { name: name.trim(), description: description?.trim() || null },
    });

    await logAudit({ userId: guard.user.userId, action: 'CREATE', tableName: 'Department', recordId: department.id, newValues: { name: department.name } });

    return NextResponse.json(department, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Відділ з такою назвою вже існує' }, { status: 400 });
    }
    console.error('Помилка при створенні відділу:', error);
    return NextResponse.json({ error: 'Помилка при створенні відділу' }, { status: 500 });
  }
}
