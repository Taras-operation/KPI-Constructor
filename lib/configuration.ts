// lib/configuration.ts
// Валідація та запис вкладених даних KPI-конфігурації (метрики, менеджери, плани).

import { Prisma, ManagerGrade } from '@prisma/client';
import { validateWeights } from '@/lib/kpi-calculations';

export interface ConfigMetricInput {
  metricId: string;
  weight: number;
}

export interface ConfigManagerInput {
  name: string;
  grade: ManagerGrade;
  userId?: string | null; // опційна прив'язка до акаунта менеджера
}

// plans[managerIndex][metricId] = планове значення
export type ConfigPlansInput = Record<number, Record<string, number | string | null>>;

export interface ConfigInput {
  metrics: ConfigMetricInput[];
  managers: ConfigManagerInput[];
  plans?: ConfigPlansInput;
}

/**
 * Перевіряє вкладені дані конфігурації.
 * requiredMetricIds — обов'язкові для відділу метрики (мають бути включені).
 * Повертає текст помилки або null, якщо все валідно.
 */
export function validateConfigInput(input: ConfigInput, requiredMetricIds: string[]): string | null {
  if (!input.metrics || input.metrics.length === 0) {
    return 'Потрібно обрати хоча б одну метрику';
  }
  if (!input.managers || input.managers.length === 0) {
    return 'Потрібно додати хоча б одного менеджера';
  }

  const weights = input.metrics.map((m) => Number(m.weight));
  if (weights.some((w) => Number.isNaN(w) || w < 0)) {
    return 'Ваги метрик мають бути невід\'ємними числами';
  }
  if (!validateWeights(weights)) {
    return 'Сума ваг метрик повинна дорівнювати 100%';
  }

  const selectedIds = new Set(input.metrics.map((m) => m.metricId));
  const missing = requiredMetricIds.filter((id) => !selectedIds.has(id));
  if (missing.length > 0) {
    return 'Не включені обов\'язкові для відділу метрики';
  }

  if (input.managers.some((m) => !m.name || !m.name.trim())) {
    return 'У кожного менеджера має бути ім\'я';
  }

  // Розд. 9: не дозволяємо порожні планові значення для активних менеджерів.
  for (let idx = 0; idx < input.managers.length; idx++) {
    const mgrPlans = input.plans?.[idx] ?? {};
    for (const metric of input.metrics) {
      const v = mgrPlans[metric.metricId];
      if (v === undefined || v === null || String(v).trim() === '') {
        return `Заповніть планові значення для всіх менеджерів і метрик (немає плану: ${input.managers[idx].name})`;
      }
    }
  }

  return null;
}

/**
 * Створює вкладені записи конфігурації в межах транзакції.
 * Викликати ПІСЛЯ створення самої KPIConfiguration.
 */
export async function writeConfigChildren(
  tx: Prisma.TransactionClient,
  configurationId: string,
  input: ConfigInput
): Promise<void> {
  await tx.configurationMetric.createMany({
    data: input.metrics.map((m) => ({
      configurationId,
      metricId: m.metricId,
      weight: new Prisma.Decimal(m.weight),
    })),
  });

  const planRows: Prisma.CurrentDataCreateManyInput[] = [];

  for (let idx = 0; idx < input.managers.length; idx++) {
    const mgr = input.managers[idx];
    const created = await tx.teamManager.create({
      data: { configurationId, name: mgr.name.trim(), grade: mgr.grade, userId: mgr.userId || null },
    });

    const mgrPlans = input.plans?.[idx];
    if (mgrPlans) {
      for (const metric of input.metrics) {
        const raw = mgrPlans[metric.metricId];
        if (raw !== undefined && raw !== null && raw !== '') {
          planRows.push({
            configurationId,
            managerId: created.id,
            metricId: metric.metricId,
            planValue: new Prisma.Decimal(raw),
          });
        }
      }
    }
  }

  if (planRows.length > 0) {
    await tx.currentData.createMany({ data: planRows });
  }
}
