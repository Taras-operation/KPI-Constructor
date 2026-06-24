// app/api/configurations/[id]/ai-analysis/route.ts
// AI-оцінка ефективності активної конфігурації (D5, точка 2). OPERATIONS.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { serialize } from '@/lib/serialize';
import { analyzeConfiguration, AINotConfiguredError } from '@/lib/ai';

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { id } = await params;
  const config = await prisma.kPIConfiguration.findUnique({
    where: { id },
    include: {
      department: { select: { name: true } },
      metrics: { include: { metric: { select: { name: true, unit: true, direction: true } } } },
      managers: { select: { id: true, name: true, grade: true, baseBonus: true } },
    },
  });
  if (!config) return NextResponse.json({ error: 'Конфігурацію не знайдено' }, { status: 404 });

  const history = await prisma.historyRecord.findMany({
    where: { configurationId: id },
    include: { manager: { select: { name: true, grade: true } }, metrics: { include: { metric: { select: { name: true } } } } },
    orderBy: { period: 'asc' },
  });

  // Компактна структура для промпту
  const data = serialize({
    department: config.department.name,
    period: config.period,
    periodicity: config.periodicity,
    bonusModel: config.bonusModel,
    bonusParameters: config.bonusParameters,
    metrics: config.metrics.map((m) => ({ name: m.metric.name, unit: m.metric.unit, direction: m.metric.direction, weight: m.weight })),
    managers: config.managers.map((m) => ({ name: m.name, grade: m.grade, baseBonus: m.baseBonus })),
    history: history.map((h) => ({
      period: h.period,
      manager: h.manager.name,
      grade: h.manager.grade,
      kpiPercentage: h.kpiPercentage,
      bonusAmount: h.bonusAmount,
      metrics: h.metrics.map((hm) => ({ name: hm.metric.name, plan: hm.planValue, fact: hm.factValue, percentage: hm.metricPercentage, weight: hm.weight })),
    })),
  });

  try {
    const text = await analyzeConfiguration(data);
    return NextResponse.json({ text, hasHistory: history.length > 0 });
  } catch (e: any) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error('AI config помилка:', e);
    return NextResponse.json({ error: 'Помилка AI-аналізу' }, { status: 502 });
  }
}
