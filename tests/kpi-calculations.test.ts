import { describe, it, expect } from 'vitest';
import {
  calculateMetricPercentage,
  calculateManagerKPI,
  calculateBonus,
  validateWeights,
} from '@/lib/kpi-calculations';

describe('calculateMetricPercentage', () => {
  it('MORE_IS_BETTER: факт/план × 100', () => {
    expect(calculateMetricPercentage(90, 100, 'MORE_IS_BETTER')).toBe(90);
    expect(calculateMetricPercentage(120, 100, 'MORE_IS_BETTER')).toBe(120);
  });

  it('LESS_IS_BETTER: план/факт × 100', () => {
    expect(calculateMetricPercentage(80, 100, 'LESS_IS_BETTER')).toBe(125);
    expect(calculateMetricPercentage(100, 100, 'LESS_IS_BETTER')).toBe(100);
  });

  it('план = 0 → 0 (без ділення на нуль)', () => {
    expect(calculateMetricPercentage(50, 0, 'MORE_IS_BETTER')).toBe(0);
  });
});

describe('calculateManagerKPI', () => {
  it('зважений % з прикладу ТЗ (40%×90 + 60%×80 = 84)', () => {
    const kpi = calculateManagerKPI([
      { metricId: 'a', weight: 40, planValue: 100, factValue: 90, direction: 'MORE_IS_BETTER' },
      { metricId: 'b', weight: 60, planValue: 100, factValue: 80, direction: 'MORE_IS_BETTER' },
    ]);
    expect(kpi).toBe(84);
  });

  it('нормалізує, якщо сума ваг != 100', () => {
    const kpi = calculateManagerKPI([
      { metricId: 'a', weight: 20, planValue: 100, factValue: 90, direction: 'MORE_IS_BETTER' },
      { metricId: 'b', weight: 30, planValue: 100, factValue: 80, direction: 'MORE_IS_BETTER' },
    ]);
    expect(kpi).toBe(84); // (90*20+80*30)/50
  });
});

describe('calculateBonus', () => {
  it('LINEAR: пропорційно % KPI', () => {
    expect(calculateBonus(85, 'LINEAR', { baseBonus: 1000 })).toBe(850);
    expect(calculateBonus(100, 'LINEAR', { baseBonus: 1000 })).toBe(1000);
  });

  it('THRESHOLD: нижче порогу → 0', () => {
    expect(calculateBonus(75, 'THRESHOLD', { baseBonus: 1000, threshold: 80, maxCoefficient: 1.2 })).toBe(0);
  });

  it('THRESHOLD: вище порогу → base × kpi/100 × коеф', () => {
    expect(calculateBonus(90, 'THRESHOLD', { baseBonus: 1000, threshold: 80, maxCoefficient: 1.2 })).toBe(1080);
  });

  it('MATRIX: чотири зони', () => {
    expect(calculateBonus(65, 'MATRIX', { baseBonus: 1000 })).toBe(0);
    expect(calculateBonus(80, 'MATRIX', { baseBonus: 1000 })).toBe(500);
    expect(calculateBonus(95, 'MATRIX', { baseBonus: 1000 })).toBe(1000);
    expect(calculateBonus(110, 'MATRIX', { baseBonus: 1000 })).toBe(1200);
  });
});

describe('validateWeights', () => {
  it('сума = 100 → true', () => {
    expect(validateWeights([40, 60])).toBe(true);
    expect(validateWeights([25, 25, 25, 25])).toBe(true);
  });
  it('сума != 100 → false', () => {
    expect(validateWeights([50, 40])).toBe(false);
    expect(validateWeights([])).toBe(false);
  });
});
