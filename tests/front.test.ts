import { describe, it, expect } from 'vitest';
import { computeFront, type FrontMetricInput, type FrontManagerInput, type FrontDataMap } from '@/lib/front';

const metrics: FrontMetricInput[] = [
  { metricId: 'm1', name: 'FTD', unit: '#', weight: 50, direction: 'MORE_IS_BETTER' },
  { metricId: 'm2', name: 'Cost per FTD', unit: '$', weight: 50, direction: 'LESS_IS_BETTER' },
];
const managers: FrontManagerInput[] = [{ id: 'mgr1', name: 'Іван', grade: 'MIDDLE', baseBonus: 1000 }];

describe('computeFront', () => {
  it('факт = план → 100% по кожній метриці і % KPI = 100', () => {
    const data: FrontDataMap = { mgr1: { m1: { plan: 100, fact: 100 }, m2: { plan: 50, fact: 50 } } };
    const [r] = computeFront(metrics, managers, data, 'LINEAR', {});
    expect(r.metrics[0].percentage).toBe(100);
    expect(r.metrics[1].percentage).toBe(100);
    expect(r.kpiPercentage).toBe(100);
    expect(r.bonusAmount).toBe(1000);
  });

  it('враховує напрямок метрики (LESS_IS_BETTER)', () => {
    // m1: 90/100=90% ; m2 (less): 50/40=125%  → (90*50 + 125*50)/100 = 107.5
    const data: FrontDataMap = { mgr1: { m1: { plan: 100, fact: 90 }, m2: { plan: 50, fact: 40 } } };
    const [r] = computeFront(metrics, managers, data, 'LINEAR', {});
    expect(r.metrics[0].percentage).toBe(90);
    expect(r.metrics[1].percentage).toBe(125);
    expect(r.kpiPercentage).toBe(107.5);
  });

  it('метрика без факту → percentage null і виключена з % KPI', () => {
    const data: FrontDataMap = { mgr1: { m1: { plan: 100, fact: 80 }, m2: { plan: 50, fact: null } } };
    const [r] = computeFront(metrics, managers, data, 'LINEAR', {});
    expect(r.metrics[1].percentage).toBeNull();
    // лише m1 (80%), нормалізується по його вазі → 80
    expect(r.kpiPercentage).toBe(80);
  });

  it('зовсім без даних → % KPI = 0, бонус = 0', () => {
    const [r] = computeFront(metrics, managers, {}, 'MATRIX', {});
    expect(r.kpiPercentage).toBe(0);
    expect(r.bonusAmount).toBe(0);
  });
});
