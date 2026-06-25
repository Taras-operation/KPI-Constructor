// lib/front-data.ts
// Завантаження і нормалізація даних конфігурації для розрахунку FRONT.

import { prisma } from '@/lib/prisma';
import {
  computeFront,
  type FrontDataMap,
  type FrontMetricInput,
  type FrontManagerInput,
  type FrontManagerResult,
} from '@/lib/front';

export interface FrontBundle {
  config: NonNullable<Awaited<ReturnType<typeof loadConfigForFront>>>;
  results: FrontManagerResult[];
  selectedPeriod: string;
}

// W: перелік періодів від стартового до поточного місяця з кроком за періодичністю.
export function periodsFrom(start: string, periodicity: string): string[] {
  if (!/^\d{6}$/.test(start)) return [start];
  const step = periodicity === 'QUARTERLY' ? 3 : periodicity === 'SEMIANNUAL' ? 6 : 1;
  let y = parseInt(start.slice(0, 4), 10);
  let m = parseInt(start.slice(4, 6), 10); // 1-12
  const now = new Date();
  const curY = now.getFullYear();
  const curM = now.getMonth() + 1;
  const result: string[] = [];
  for (let i = 0; i < 240; i++) {
    result.push(`${y}${String(m).padStart(2, '0')}`);
    if (y > curY || (y === curY && m >= curM)) break;
    m += step;
    while (m > 12) { m -= 12; y++; }
  }
  return result;
}

function loadConfigForFront(id: string) {
  return prisma.kPIConfiguration.findUnique({
    where: { id },
    include: {
      department: true,
      teamLead: { select: { id: true, name: true, email: true } },
      metrics: { include: { metric: true } },
      managers: { orderBy: { createdAt: 'asc' } },
      currentData: true,
    },
  });
}

export async function buildFront(id: string, period?: string): Promise<FrontBundle | null> {
  const config = await loadConfigForFront(id);
  if (!config) return null;

  const selectedPeriod = period && /^\d{6}$/.test(period) ? period : config.period;

  // W: факт за обраний період — з FactRecord (план лишається в CurrentData)
  const factRows = await prisma.factRecord.findMany({
    where: { configurationId: id, period: selectedPeriod },
  });
  const factMap: Record<string, Record<string, number | null>> = {};
  for (const f of factRows) {
    (factMap[f.managerId] = factMap[f.managerId] || {})[f.metricId] = f.factValue != null ? Number(f.factValue) : null;
  }

  const metrics: FrontMetricInput[] = config.metrics.map((cm) => ({
    metricId: cm.metricId,
    name: cm.metric.name,
    unit: cm.metric.unit,
    weight: Number(cm.weight),
    direction: cm.metric.direction,
  }));

  const managers: FrontManagerInput[] = config.managers.map((m) => ({
    id: m.id,
    name: m.name,
    grade: m.grade,
    baseBonus: Number(m.baseBonus),
  }));

  const data: FrontDataMap = {};
  const cell = (mgr: string, met: string) => {
    data[mgr] = data[mgr] || {};
    data[mgr][met] = data[mgr][met] || { plan: null, fact: null };
    return data[mgr][met];
  };
  for (const cd of config.currentData) {
    cell(cd.managerId, cd.metricId).plan = cd.planValue != null ? Number(cd.planValue) : null;
  }
  for (const f of factRows) {
    cell(f.managerId, f.metricId).fact = f.factValue != null ? Number(f.factValue) : null;
  }

  const bp = (config.bonusParameters ?? {}) as any;
  const results = computeFront(metrics, managers, data, config.bonusModel, {
    threshold: bp.threshold != null ? Number(bp.threshold) : undefined,
    maxCoefficient: bp.maxCoefficient != null ? Number(bp.maxCoefficient) : undefined,
    matrix: Array.isArray(bp.matrix) ? bp.matrix : undefined,
  });

  return { config, results, selectedPeriod };
}
