// app/api/departments/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { logAudit } from '@/lib/audit';

// PUT — оновлення відділу. Тільки OPERATIONS.
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;

  try {
    const { name, description } = await request.json();

    const department = await prisma.department.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
      },
    });

    return NextResponse.json(department);
  } catch (error: any) {
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Відділ з такою назвою вже існує' }, { status: 400 });
    }
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Відділ не знайдено' }, { status: 404 });
    }
    console.error('Помилка при оновленні відділу:', error);
    return NextResponse.json({ error: 'Помилка при оновленні відділу' }, { status: 500 });
  }
}

// DELETE — видалення відділу. Тільки OPERATIONS.
// Блокуємо видалення, якщо до відділу прив'язані конфігурації (захист HISTORY).
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;

  try {
    const configCount = await prisma.kPIConfiguration.count({ where: { departmentId: id } });
    if (configCount > 0) {
      return NextResponse.json(
        { error: 'Не можна видалити відділ з існуючими конфігураціями' },
        { status: 400 }
      );
    }

    await prisma.department.delete({ where: { id } });
    await logAudit({ userId: guard.user.userId, action: 'DELETE', tableName: 'Department', recordId: id });
    return NextResponse.json({ message: 'Відділ видалено' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Відділ не знайдено' }, { status: 404 });
    }
    console.error('Помилка при видаленні відділу:', error);
    return NextResponse.json({ error: 'Помилка при видаленні відділу' }, { status: 500 });
  }
}
