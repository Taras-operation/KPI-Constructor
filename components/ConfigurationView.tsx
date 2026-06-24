// components/ConfigurationView.tsx
// Read-only перегляд конфігурації: метрики+ваги, менеджери, матриця планів, бонусна модель.
'use client';

import { metricLabel } from '@/lib/format';

interface Props {
  config: any;
}

const BONUS_LABELS: Record<string, string> = {
  LINEAR: 'Лінійна',
  THRESHOLD: 'Порогова',
  MATRIX: 'Матриця',
};
const GRADE_LABELS: Record<string, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };
const PERIODICITY_LABELS: Record<string, string> = { MONTHLY: 'Щомісячно', QUARTERLY: 'Щоквартально', SEMIANNUAL: 'Кожні 6 місяців' };

function fmtPeriod(p: string) {
  return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p;
}

export default function ConfigurationView({ config }: Props) {
  const metrics = config.metrics ?? [];
  const managers = config.managers ?? [];
  const bp = config.bonusParameters ?? {};

  // planValue за (managerId, metricId)
  const planMap: Record<string, Record<string, any>> = {};
  (config.currentData ?? []).forEach((cd: any) => {
    planMap[cd.managerId] = planMap[cd.managerId] || {};
    planMap[cd.managerId][cd.metricId] = cd.planValue;
  });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
        <Info label="Відділ" value={config.department?.name} />
        <Info label="Період" value={fmtPeriod(config.period)} />
        <Info label="Періодичність" value={PERIODICITY_LABELS[config.periodicity] ?? config.periodicity} />
        <Info label="Тімлід" value={config.teamLead?.name || config.teamLead?.email} />
        <Info label="Бонусна модель" value={BONUS_LABELS[config.bonusModel] ?? config.bonusModel} />
      </div>

      {/* Метрики + ваги */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Метрики і ваги</h4>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-1.5 pr-4 font-medium">Метрика</th>
              <th className="py-1.5 pr-4 font-medium">Напрямок</th>
              <th className="py-1.5 font-medium text-right">Вага</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {metrics.map((cm: any) => (
              <tr key={cm.id}>
                <td className="py-1.5 pr-4 text-gray-900">{cm.metric?.name}</td>
                <td className="py-1.5 pr-4 text-gray-500">
                  {cm.metric?.direction === 'LESS_IS_BETTER' ? 'менше = краще' : 'більше = краще'}
                </td>
                <td className="py-1.5 text-right text-gray-900">{Number(cm.weight)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Матриця планів */}
      <div>
        <h4 className="font-medium text-gray-900 mb-2">Плани (менеджер × метрика)</h4>
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 pr-4 font-medium">Менеджер</th>
                <th className="py-1.5 pr-4 font-medium">Грейд</th>
                <th className="py-1.5 pr-4 font-medium whitespace-nowrap">Баз. бонус</th>
                {metrics.map((cm: any) => (
                  <th key={cm.id} className="py-1.5 px-2 font-medium whitespace-nowrap">
                    {metricLabel(cm.metric?.name, cm.metric?.unit)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.map((mgr: any) => (
                <tr key={mgr.id} className="border-t border-gray-100">
                  <td className="py-1.5 pr-4 text-gray-900 whitespace-nowrap">{mgr.name}</td>
                  <td className="py-1.5 pr-4 text-gray-500">{GRADE_LABELS[mgr.grade] ?? mgr.grade}</td>
                  <td className="py-1.5 pr-4 text-gray-700 whitespace-nowrap">{bp.currency ?? '$'} {Number(mgr.baseBonus ?? 0)}</td>
                  {metrics.map((cm: any) => (
                    <td key={cm.id} className="py-1.5 px-2 text-gray-700">
                      {planMap[mgr.id]?.[cm.metric.id] ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Бонусна модель */}
      <div className="text-sm text-gray-700">
        <h4 className="font-medium text-gray-900 mb-2">Параметри бонусу</h4>
        <p className="text-gray-500">Базовий бонус задається індивідуально для кожного менеджера (див. колонку «Баз. бонус»).</p>
        {config.bonusModel === 'THRESHOLD' && (
          <p>Поріг: {bp.threshold}% · Макс. коефіцієнт: {bp.maxCoefficient}</p>
        )}
        {config.bonusModel === 'MATRIX' && (
          <p className="text-gray-500">Зони: &lt;70% → 0, 70–89% → 50%, 90–99% → 100%, 100%+ → 120%.</p>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-gray-900 font-medium">{value ?? '—'}</p>
    </div>
  );
}
