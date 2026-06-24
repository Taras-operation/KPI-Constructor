// lib/change-classify.ts
// D6: критичні зміни (метрики/ваги/плани/бонусна модель/менеджери/обґрунтування) вимагають
// аппруву Operations; некритичні (напр. лише allowManagerInput) — тімлід застосовує сам.

type CurrentConfig = {
  metrics: { metricId: string; weight: any }[];
  managers: { id: string; name: string; grade: string; baseBonus: any }[];
  currentData: { managerId: string; metricId: string; planValue: any }[];
  bonusModel: string;
  bonusParameters: any;
  requiredOverrides: any;
};

function num(v: any): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

// Канонічний "критичний відбиток" — все, що вважається критичним.
function fingerprintCurrent(c: CurrentConfig): string {
  const metrics = c.metrics.map((m) => [m.metricId, num(m.weight)] as const).sort((a, b) => a[0].localeCompare(b[0]));
  const nameById: Record<string, string> = {};
  c.managers.forEach((m) => { nameById[m.id] = m.name; });
  const managers = c.managers.map((m) => [m.name, m.grade, num(m.baseBonus)] as const).sort((a, b) => a[0].localeCompare(b[0]));
  const plans: [string, string, number | null][] = c.currentData
    .map((d) => [nameById[d.managerId] ?? d.managerId, d.metricId, num(d.planValue)] as [string, string, number | null])
    .filter((p) => p[2] !== null)
    .sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  const bp = c.bonusParameters ?? {};
  const overrides = (Array.isArray(c.requiredOverrides) ? c.requiredOverrides : []).map((o: any) => o.metricId).sort();
  return JSON.stringify({ metrics, managers, plans, bonusModel: c.bonusModel, bp: { t: num(bp.threshold), mc: num(bp.maxCoefficient), cur: bp.currency ?? '$' }, overrides });
}

function fingerprintPayload(p: any): string {
  const metrics = (p.metrics ?? []).map((m: any) => [m.metricId, num(m.weight)] as const).sort((a: any, b: any) => a[0].localeCompare(b[0]));
  const managersArr = p.managers ?? [];
  const managers = managersArr.map((m: any) => [m.name?.trim() ?? '', m.grade, num(m.baseBonus)] as const).sort((a: any, b: any) => a[0].localeCompare(b[0]));
  const plans: [string, string, number | null][] = [];
  managersArr.forEach((m: any, idx: number) => {
    const cells = p.plans?.[idx] ?? {};
    Object.entries(cells).forEach(([metricId, v]) => {
      const n = num(v);
      if (n !== null) plans.push([m.name?.trim() ?? '', metricId, n]);
    });
  });
  plans.sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]));
  const bp = p.bonusParameters ?? {};
  const overrides = (p.requiredOverrides ?? []).map((o: any) => o.metricId).sort();
  return JSON.stringify({ metrics, managers, plans, bonusModel: p.bonusModel, bp: { t: num(bp.threshold), mc: num(bp.maxCoefficient), cur: bp.currency ?? '$' }, overrides });
}

/** true, якщо зміна критична (відрізняється критичний відбиток). */
export function isCriticalChange(current: CurrentConfig, payload: any): boolean {
  return fingerprintCurrent(current) !== fingerprintPayload(payload);
}
