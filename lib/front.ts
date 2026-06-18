// lib/front.ts
// Розрахунок FRONT: % виконання по метриках, зважений % KPI і бонус для кожного менеджера.

import { BonusModel, MetricDirection } from '@prisma/client';
import {
  calculateMetricPercentage,
  calculateManagerKPI,
  calculateBonus,
} from '@/lib/kpi-calculations';

export interface FrontMetricInput {
  metricId: string;
  name: string;
  unit: string | null;
  weight: number;
  direction: MetricDirection;
}

export interface FrontManagerInput {
  id: string;
  name: string;
  grade: string;
}

// data[managerId][metricId] = { plan, fact }
export type FrontDataMap = Record<string, Record<string, { plan: number | null; fact: number | null }>>;

export interface FrontMetricResult {
  metricId: string;
  name: string;
  unit: string | null;
  weight: number;
  direction: MetricDirection;
  plan: number | null;
  fact: number | null;
  percentage: number | null;
}

export interface FrontManagerResult {
  id: string;
  name: string;
  grade: string;
  metrics: FrontMetricResult[];
  kpiPercentage: number;
  bonusAmount: number;
}

export function computeFront(
  metrics: FrontMetricInput[],
  managers: FrontManagerInput[],
  data: FrontDataMap,
  bonusModel: BonusModel,
  bonusParameters: { baseBonus: number; threshold?: number; maxCoefficient?: number }
): FrontManagerResult[] {
  return managers.map((mgr) => {
    const cells = data[mgr.id] ?? {};

    const metricResults: FrontMetricResult[] = metrics.map((m) => {
      const cell = cells[m.metricId] ?? { plan: null, fact: null };
      const hasBoth = cell.plan != null && cell.fact != null;
      const percentage = hasBoth
        ? calculateMetricPercentage(cell.fact as number, cell.plan as number, m.direction)
        : null;
      return {
        metricId: m.metricId,
        name: m.name,
        unit: m.unit,
        weight: m.weight,
        direction: m.direction,
        plan: cell.plan,
        fact: cell.fact,
        percentage,
      };
    });

    // % KPI рахуємо лише по метриках з заповненими план+факт.
    const kpiInput = metricResults
      .filter((r) => r.plan != null && r.fact != null)
      .map((r) => ({
        metricId: r.metricId,
        weight: r.weight,
        planValue: r.plan as number,
        factValue: r.fact as number,
        direction: r.direction,
      }));

    const kpiPercentage = kpiInput.length > 0 ? calculateManagerKPI(kpiInput) : 0;
    const bonusAmount = calculateBonus(kpiPercentage, bonusModel, bonusParameters);

    return {
      id: mgr.id,
      name: mgr.name,
      grade: mgr.grade,
      metrics: metricResults,
      kpiPercentage,
      bonusAmount,
    };
  });
}
