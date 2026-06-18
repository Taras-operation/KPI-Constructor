// app/api/metrics/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'OPERATIONS') {
      return NextResponse.json(
        { error: 'Доступ заборонений' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const metrics = await prisma.metric.findMany({
      where: status
        ? { status: status as any }
        : undefined,
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(metrics);
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

    const {
      name,
      description,
      valueType,
      unit,
      direction,
      requiredForDepartments,
    } = await request.json();

    if (!name || !valueType || !direction) {
      return NextResponse.json(
        { error: 'Обов\'язкові поля не заповнені' },
        { status: 400 }
      );
    }

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
