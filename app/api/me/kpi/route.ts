// app/api/me/kpi/route.ts
// KPI поточного менеджера по активних конфігураціях (F-25).

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';
import { buildFront } from '@/lib/front-data';

export async function GET() {
  const guard = await requireRole(['MANAGER']);
  if ('error' in guard) return guard.error;

  // Прив'язки менеджера до активних конфігурацій
  const myManagers = await prisma.teamManager.findMany({
    where: { userId: guard.user.userId, configuration: { status: 'ACTIVE' } },
    select: { id: true, configurationId: true },
  });

  const byConfig = new Map<string, Set<string>>();
  for (const m of myManagers) {
    if (!byConfig.has(m.configurationId)) byConfig.set(m.configurationId, new Set());
    byConfig.get(m.configurationId)!.add(m.id);
  }

  const result = [];
  for (const [configId, managerIds] of byConfig) {
    const bundle = await buildFront(configId);
    if (!bundle) continue;
    const { config, results } = bundle;
    const mine = results.filter((r) => managerIds.has(r.id));
    const bp = (config.bonusParameters ?? {}) as any;
    const savedCount = await prisma.historyRecord.count({ where: { configurationId: configId, period: config.period } });
    for (const m of mine) {
      result.push({
        configId,
        period: config.period,
        department: config.department.name,
        currency: bp.currency ?? '$',
        bonusModel: config.bonusModel,
        allowManagerInput: config.allowManagerInput,
        saved: savedCount > 0,
        manager: m,
      });
    }
  }

  return NextResponse.json(result);
}
