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

export async function buildFront(id: string): Promise<FrontBundle | null> {
  const config = await loadConfigForFront(id);
  if (!config) return null;

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
  for (const cd of config.currentData) {
    data[cd.managerId] = data[cd.managerId] || {};
    data[cd.managerId][cd.metricId] = {
      plan: cd.planValue != null ? Number(cd.planValue) : null,
      fact: cd.factValue != null ? Number(cd.factValue) : null,
    };
  }

  const bp = (config.bonusParameters ?? {}) as any;
  const results = computeFront(metrics, managers, data, config.bonusModel, {
    threshold: bp.threshold != null ? Number(bp.threshold) : undefined,
    maxCoefficient: bp.maxCoefficient != null ? Number(bp.maxCoefficient) : undefined,
  });

  return { config, results };
}
