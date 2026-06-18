// lib/kpi-calculations.ts

import { Decimal } from '@prisma/client/runtime/library';
import { BonusModel, MetricDirection } from '@prisma/client';

interface MetricData {
  metricId: string;
  weight: number;
  planValue: number;
  factValue: number;
  direction: MetricDirection;
}

/**
 * Расчет % выполнения по одной метрике
 */
export function calculateMetricPercentage(
  factValue: number,
  planValue: number,
  direction: MetricDirection
): number {
  if (!planValue || planValue === 0) return 0;

  let percentage: number;

  if (direction === 'LESS_IS_BETTER') {
    // Для метрик типа Cost per FTD (менше = краще)
    // % = (План / Факт) × 100
    percentage = (planValue / factValue) * 100;
  } else {
    // Для обычных метрик (більше = краще)
    // % = (Факт / План) × 100
    percentage = (factValue / planValue) * 100;
  }

  // Обрезаем до 2 знаков после запятой
  return Math.round(percentage * 100) / 100;
}

/**
 * Расчет взвешенного % KPI менеджера
 */
export function calculateManagerKPI(metrics: MetricData[]): number {
  let totalWeightedPercentage = 0;
  let totalWeight = 0;

  for (const metric of metrics) {
    const metricPercentage = calculateMetricPercentage(
      metric.factValue,
      metric.planValue,
      metric.direction
    );

    // Зважений внесок: (% метрики × вага / 100)
    totalWeightedPercentage += (metricPercentage * metric.weight) / 100;
    totalWeight += metric.weight;
  }

  // Якщо сума ваг не 100%, нормалізуємо
  if (totalWeight > 0 && totalWeight !== 100) {
    totalWeightedPercentage = (totalWeightedPercentage / totalWeight) * 100;
  }

  return Math.round(totalWeightedPercentage * 100) / 100;
}

interface BonusParameters {
  baseBonus: number;
  threshold?: number;
  maxCoefficient?: number;
}

/**
 * Расчет бонуса на основе модели
 */
export function calculateBonus(
  kpiPercentage: number,
  bonusModel: BonusModel,
  parameters: BonusParameters
): number {
  const { baseBonus } = parameters;

  switch (bonusModel) {
    case 'LINEAR': {
      // Бонус = Базовий бонус × (% KPI / 100)
      return (baseBonus * kpiPercentage) / 100;
    }

    case 'THRESHOLD': {
      const threshold = parameters.threshold || 80;
      const maxCoeff = parameters.maxCoefficient || 1.2;

      if (kpiPercentage < threshold) {
        return 0;
      }

      // Лінійне зростання від порогу до максимуму
      return (baseBonus * (kpiPercentage / 100)) * maxCoeff;
    }

    case 'MATRIX': {
      // Чотири зони
      if (kpiPercentage < 70) {
        return 0; // Зона провалу
      } else if (kpiPercentage < 90) {
        return baseBonus * 0.5; // Зона часткового виконання
      } else if (kpiPercentage < 100) {
        return baseBonus; // Зона виконання плану
      } else {
        return baseBonus * 1.2; // Зона перевиконання
      }
    }

    default:
      return 0;
  }
}

/**
 * Валідація сумы ваг (повинна бути 100)
 */
export function validateWeights(weights: number[]): boolean {
  const sum = weights.reduce((acc, w) => acc + w, 0);
  return Math.abs(sum - 100) < 0.01; // Допускаємо невелику похибку
}

/**
 * Форматування грошей
 */
export function formatCurrency(value: number | Decimal, currency: string = '$'): string {
  const num = typeof value === 'object' ? parseFloat(value.toString()) : value;
  return `${currency} ${num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/**
 * Форматування відсотків
 */
export function formatPercentage(value: number | Decimal): string {
  const num = typeof value === 'object' ? parseFloat(value.toString()) : value;
  return `${num.toFixed(2)}%`;
}
