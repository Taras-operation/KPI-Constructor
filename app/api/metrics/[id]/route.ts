// app/api/metrics/[id]/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseBody, metricUpdateSchema } from '@/lib/validation';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Не авторизовано' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const metric = await prisma.metric.findUnique({
      where: { id },
    });

    if (!metric) {
      return NextResponse.json(
        { error: 'Метрика не знайдена' },
        { status: 404 }
      );
    }

    return NextResponse.json(metric);
  } catch (error) {
    console.error('Помилка при отриманні метрики:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні метрики' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'OPERATIONS') {
      return NextResponse.json(
        { error: 'Доступ заборонений' },
        { status: 403 }
      );
    }

    const { id } = await params;
    const parsed = await parseBody(request, metricUpdateSchema);
    if ('error' in parsed) return parsed.error;
    const data = parsed.data;

    const metric = await prisma.metric.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
        ...(data.valueType && { valueType: data.valueType }),
        ...(data.unit !== undefined && { unit: data.unit }),
        ...(data.direction && { direction: data.direction }),
        ...(data.requiredForDepartments && { requiredForDepartments: data.requiredForDepartments }),
        ...(data.status && { status: data.status }),
      },
    });

    await logAudit({
      userId: user.userId,
      action: data.status ? 'STATUS' : 'UPDATE',
      tableName: 'Metric',
      recordId: id,
      newValues: data,
    });

    return NextResponse.json(metric);
  } catch (error: any) {
    console.error('Помилка при оновленні метрики:', error);

    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Метрика не знайдена' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Помилка при оновленні метрики' },
      { status: 500 }
    );
  }
}

// Метрики не видаляються (ТЗ F-04, розд. 7 «Незмінний HISTORY») — лише архівуються
// через PUT { status: 'ARCHIVED' }. DELETE свідомо не реалізовано.
