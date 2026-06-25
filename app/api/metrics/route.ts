// app/api/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { parseBody, metricCreateSchema } from '@/lib/validation';

// GET — банк метрик з фільтрами (F-01): status, valueType, department.
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || (user.role !== 'OPERATIONS' && user.role !== 'TEAM_LEAD')) {
      return NextResponse.json(
        { error: 'Доступ заборонений' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const valueType = searchParams.get('valueType');
    const department = searchParams.get('department');
    const withUsage = searchParams.get('withUsage');

    const where: Prisma.MetricWhereInput = {};
    if (status) where.status = status as any;
    if (valueType) where.valueType = valueType as any;
    if (department) where.requiredForDepartments = { has: department };

    const metrics = await prisma.metric.findMany({
      where,
      orderBy: { name: 'asc' },
      ...(withUsage ? { include: { _count: { select: { configurationMetrics: true } } } } : {}),
    });

    // Популярність — скільки разів метрику використано в конфігураціях (L)
    const result = withUsage
      ? metrics.map((m: any) => { const { _count, ...rest } = m; return { ...rest, usageCount: _count?.configurationMetrics ?? 0 }; })
      : metrics;

    return NextResponse.json(result);
  } catch (error) {
    console.error('Помилка при отриманні метрик:', error);
    return NextResponse.json(
      { error: 'Помилка при отриманні метрик' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'OPERATIONS') {
      return NextResponse.json(
        { error: 'Доступ заборонений' },
        { status: 403 }
      );
    }

    const parsed = await parseBody(request, metricCreateSchema);
    if ('error' in parsed) return parsed.error;
    const { name, description, valueType, unit, direction, requiredForDepartments } = parsed.data;

    const metric = await prisma.metric.create({
      data: {
        name,
        description,
        valueType,
        unit,
        direction,
        requiredForDepartments: requiredForDepartments || [],
      },
    });

    await logAudit({ userId: user.userId, action: 'CREATE', tableName: 'Metric', recordId: metric.id, newValues: { name } });

    return NextResponse.json(metric, { status: 201 });
  } catch (error: any) {
    console.error('Помилка при створенні метрики:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'Метрика з такою назвою вже існує' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Помилка при створенні метрики' },
      { status: 500 }
    );
  }
}
