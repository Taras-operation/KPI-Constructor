// app/api/benchmarks/route.ts
// Авто-бенчмарки з HISTORY (Phase 2): історична норма факту по метриці і грейду для відділу.

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { median, coefficientOfVariation } from '@/lib/stats';

export async function GET(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { searchParams } = new URL(request.url);
  const departmentId = searchParams.get('departmentId');
  if (!departmentId) {
    return NextResponse.json({ error: 'departmentId обовʼязковий' }, { status: 400 });
  }

  // Усі збережені результати по метриках для цього відділу.
  const rows = await prisma.historyMetric.findMany({
    where: {
      factValue: { not: null },
      historyRecord: { configuration: { departmentId } },
    },
    select: {
      metricId: true,
      factValue: true,
      historyRecord: { select: { manager: { select: { grade: true } }, period: true } },
    },
  });

  // Групуємо: metricId -> grade -> [fact]; + overall
  const byMetric: Record<string, { all: number[]; byGrade: Record<string, number[]>; periods: Set<string> }> = {};
  for (const r of rows) {
    const fact = Number(r.factValue);
    const grade = r.historyRecord.manager.grade;
    if (!byMetric[r.metricId]) byMetric[r.metricId] = { all: [], byGrade: {}, periods: new Set() };
    const b = byMetric[r.metricId];
    b.all.push(fact);
    (b.byGrade[grade] = b.byGrade[grade] || []).push(fact);
    b.periods.add(r.historyRecord.period);
  }

  const benchmarks: Record<string, any> = {};
  for (const [metricId, b] of Object.entries(byMetric)) {
    const byGrade: Record<string, { median: number | null; samples: number }> = {};
    for (const [grade, vals] of Object.entries(b.byGrade)) {
      byGrade[grade] = { median: median(vals), samples: vals.length };
    }
    benchmarks[metricId] = {
      overall: { median: median(b.all), samples: b.all.length, cv: coefficientOfVariation(b.all) },
      byGrade,
      periods: b.periods.size,
    };
  }

  return NextResponse.json({ departmentId, benchmarks });
}
