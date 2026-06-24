// lib/apply-config.ts
// Застосування запропонованої конфігурації (валідація + транзакційний перезапис).
// Спільне для resolve запиту на зміну і авто-застосування некритичних змін (D6).

import { prisma } from '@/lib/prisma';
import { validateConfigInput, writeConfigChildren, type ConfigInput } from '@/lib/configuration';

export async function applyConfigPayload(configurationId: string, p: any): Promise<string | null> {
  const current = await prisma.kPIConfiguration.findUnique({ where: { id: configurationId }, select: { departmentId: true } });
  if (!current) return 'Конфігурацію не знайдено';

  const departmentId = p.departmentId ?? current.departmentId;
  const input: ConfigInput = { metrics: p.metrics ?? [], managers: p.managers ?? [], plans: p.plans ?? {} };

  const requiredMetrics = await prisma.metric.findMany({
    where: { status: 'ACTIVE', requiredForDepartments: { has: departmentId } },
    select: { id: true },
  });
  const overrides = (p.requiredOverrides ?? []).filter((o: any) => o.reason?.trim());
  const justified = new Set<string>(overrides.map((o: any) => o.metricId));
  const validationError = validateConfigInput(input, requiredMetrics.map((m) => m.id), justified);
  if (validationError) return validationError;

  await prisma.$transaction(async (tx) => {
    await tx.kPIConfiguration.update({
      where: { id: configurationId },
      data: {
        ...(p.departmentId && { departmentId: p.departmentId }),
        ...(p.teamLeadId && { teamLeadId: p.teamLeadId }),
        ...(p.period && { period: p.period }),
        ...(p.periodicity && { periodicity: p.periodicity }),
        ...(p.bonusModel && { bonusModel: p.bonusModel }),
        ...(p.bonusParameters && { bonusParameters: p.bonusParameters }),
        ...(p.allowManagerInput !== undefined && { allowManagerInput: p.allowManagerInput }),
        requiredOverrides: overrides,
      },
    });
    await tx.configurationMetric.deleteMany({ where: { configurationId } });
    await tx.teamManager.deleteMany({ where: { configurationId } });
    await writeConfigChildren(tx, configurationId, input);
  });

  return null;
}
