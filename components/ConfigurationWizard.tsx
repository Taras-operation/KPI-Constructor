// components/ConfigurationWizard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { metricLabel } from '@/lib/format';

type Grade = 'JUNIOR' | 'MIDDLE' | 'SENIOR';
type BonusModel = 'LINEAR' | 'THRESHOLD' | 'MATRIX';

interface Department { id: string; name: string }
interface Lead { id: string; name: string | null; email: string }
interface Metric {
  id: string; name: string; unit: string | null;
  direction: string; requiredForDepartments: string[];
}

interface Props {
  initial?: any | null; // повна конфігурація для редагування
  onClose: (saved: boolean) => void;
}

const GRADES: Grade[] = ['JUNIOR', 'MIDDLE', 'SENIOR'];
const GRADE_LABELS: Record<Grade, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };

function periodToMonthInput(period: string): string {
  return period && period.length === 6 ? `${period.slice(0, 4)}-${period.slice(4)}` : '';
}

export default function ConfigurationWizard({ initial, onClose }: Props) {
  const editing = !!initial;
  const [step, setStep] = useState(1);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [departments, setDepartments] = useState<Department[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [managerUsers, setManagerUsers] = useState<Lead[]>([]);
  const [allMetrics, setAllMetrics] = useState<Metric[]>([]);
  const [benchmarks, setBenchmarks] = useState<Record<string, any>>({});

  // Крок 1
  const [departmentId, setDepartmentId] = useState(initial?.departmentId ?? '');
  const [teamLeadId, setTeamLeadId] = useState(initial?.teamLeadId ?? '');
  const [monthInput, setMonthInput] = useState(periodToMonthInput(initial?.period ?? ''));

  // Крок 2: вибрані метрики -> вага
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    initial?.metrics?.forEach((cm: any) => { w[cm.metricId] = String(cm.weight); });
    return w;
  });

  // Крок 3: менеджери (з базовим бонусом — D4)
  const [managers, setManagers] = useState<{ name: string; grade: Grade; userId: string; baseBonus: string }[]>(
    initial?.managers?.map((m: any) => ({ name: m.name, grade: m.grade, userId: m.userId ?? '', baseBonus: m.baseBonus != null ? String(m.baseBonus) : '' }))
      ?? [{ name: '', grade: 'MIDDLE', userId: '', baseBonus: '' }]
  );

  // Крок 4: плани plans[mgrIndex][metricId]
  const [plans, setPlans] = useState<Record<number, Record<string, string>>>(() => {
    if (!initial) return {};
    const idxByManagerId: Record<string, number> = {};
    initial.managers?.forEach((m: any, i: number) => { idxByManagerId[m.id] = i; });
    const p: Record<number, Record<string, string>> = {};
    initial.currentData?.forEach((cd: any) => {
      const idx = idxByManagerId[cd.managerId];
      if (idx === undefined || cd.planValue === null) return;
      p[idx] = p[idx] || {};
      p[idx][cd.metricId] = String(cd.planValue);
    });
    return p;
  });

  // Крок 5: бонусна модель
  const bp = initial?.bonusParameters ?? {};
  const [allowManagerInput, setAllowManagerInput] = useState<boolean>(initial?.allowManagerInput ?? false);
  const [bonusModel, setBonusModel] = useState<BonusModel>(initial?.bonusModel ?? 'LINEAR');
  const [currency, setCurrency] = useState<string>(bp.currency ?? '$');
  const [threshold, setThreshold] = useState<string>(bp.threshold != null ? String(bp.threshold) : '80');
  const [maxCoefficient, setMaxCoefficient] = useState<string>(bp.maxCoefficient != null ? String(bp.maxCoefficient) : '1.2');

  useEffect(() => {
    fetch('/api/departments').then((r) => r.json()).then(setDepartments).catch(() => {});
    fetch('/api/users?role=TEAM_LEAD').then((r) => r.json()).then(setLeads).catch(() => {});
    fetch('/api/users?role=MANAGER').then((r) => r.json()).then(setManagerUsers).catch(() => {});
    fetch('/api/metrics?status=ACTIVE').then((r) => r.json()).then(setAllMetrics).catch(() => {});
  }, []);

  // Бенчмарки з HISTORY для обраного відділу
  useEffect(() => {
    if (!departmentId) { setBenchmarks({}); return; }
    fetch(`/api/benchmarks?departmentId=${departmentId}`)
      .then((r) => r.json())
      .then((d) => setBenchmarks(d.benchmarks ?? {}))
      .catch(() => setBenchmarks({}));
  }, [departmentId]);

  const requiredIds = useMemo(
    () => new Set(allMetrics.filter((m) => m.requiredForDepartments.includes(departmentId)).map((m) => m.id)),
    [allMetrics, departmentId]
  );

  // Автовибір обов'язкових метрик при зміні відділу
  useEffect(() => {
    if (!departmentId) return;
    setWeights((prev) => {
      const next = { ...prev };
      requiredIds.forEach((id) => { if (!(id in next)) next[id] = ''; });
      return next;
    });
  }, [departmentId, requiredIds]);

  const selectedMetricIds = Object.keys(weights);
  const selectedMetrics = allMetrics.filter((m) => selectedMetricIds.includes(m.id));
  const weightSum = selectedMetricIds.reduce((s, id) => s + (parseFloat(weights[id]) || 0), 0);

  function toggleMetric(id: string) {
    if (requiredIds.has(id)) return; // заблоковано
    setWeights((prev) => {
      const next = { ...prev };
      if (id in next) delete next[id];
      else next[id] = '';
      return next;
    });
  }

  function setManager(i: number, patch: Partial<{ name: string; grade: Grade; userId: string; baseBonus: string }>) {
    setManagers((prev) => prev.map((m, idx) => (idx === i ? { ...m, ...patch } : m)));
  }
  function addManager() {
    setManagers((prev) => [...prev, { name: '', grade: 'MIDDLE', userId: '', baseBonus: '' }]);
  }
  function removeManager(i: number) {
    setManagers((prev) => prev.filter((_, idx) => idx !== i));
    setPlans((prev) => {
      const next: Record<number, Record<string, string>> = {};
      Object.keys(prev).map(Number).filter((k) => k !== i).forEach((k) => {
        next[k > i ? k - 1 : k] = prev[k];
      });
      return next;
    });
  }
  function setPlan(mgrIdx: number, metricId: string, value: string) {
    setPlans((prev) => ({ ...prev, [mgrIdx]: { ...(prev[mgrIdx] || {}), [metricId]: value } }));
  }

  async function handleSave() {
    setError('');
    // Клієнтська валідація
    if (!departmentId || !teamLeadId || !monthInput) { setError('Заповніть відділ, тімліда і період'); setStep(1); return; }
    if (selectedMetricIds.length === 0) { setError('Оберіть хоча б одну метрику'); setStep(2); return; }
    if (Math.abs(weightSum - 100) > 0.01) { setError('Сума ваг має дорівнювати 100%'); setStep(2); return; }
    if (managers.length === 0 || managers.some((m) => !m.name.trim())) { setError('Додайте менеджерів з іменами'); setStep(3); return; }
    if (managers.some((m) => m.baseBonus === '' || isNaN(parseFloat(m.baseBonus)) || parseFloat(m.baseBonus) < 0)) {
      setError('Вкажіть базовий бонус (>= 0) для кожного менеджера'); setStep(3); return;
    }

    const period = monthInput.replace('-', '');
    const bonusParameters: any = { currency };
    if (bonusModel === 'THRESHOLD') {
      bonusParameters.threshold = parseFloat(threshold);
      bonusParameters.maxCoefficient = parseFloat(maxCoefficient);
    }

    const body = {
      departmentId,
      teamLeadId,
      period,
      bonusModel,
      bonusParameters,
      allowManagerInput,
      metrics: selectedMetricIds.map((id) => ({ metricId: id, weight: parseFloat(weights[id]) || 0 })),
      managers: managers.map((m) => ({ name: m.name.trim(), grade: m.grade, userId: m.userId || null, baseBonus: parseFloat(m.baseBonus) })),
      plans,
    };

    setSaving(true);
    try {
      const url = editing ? `/api/configurations/${initial.id}` : '/api/configurations';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка збереження');
      onClose(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const stepTitles = ['Загальне', 'Метрики і ваги', 'Менеджери', 'Плани', 'Бонусна модель'];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {editing ? 'Редагування конфігурації' : 'Нова KPI-конфігурація'}
          </h3>
          <div className="flex gap-2 mt-3 text-xs">
            {stepTitles.map((t, i) => (
              <button
                key={t}
                onClick={() => setStep(i + 1)}
                className={`px-2 py-1 rounded-full ${step === i + 1 ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}
              >
                {i + 1}. {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 overflow-y-auto flex-1">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>
          )}

          {/* Крок 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <Field label="Відділ *">
                <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={selCls}>
                  <option value="">— оберіть —</option>
                  {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </Field>
              <Field label="Тімлід *">
                <select value={teamLeadId} onChange={(e) => setTeamLeadId(e.target.value)} className={selCls}>
                  <option value="">— оберіть —</option>
                  {leads.map((l) => <option key={l.id} value={l.id}>{l.name || l.email}</option>)}
                </select>
              </Field>
              <Field label="Період *">
                <input type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} className={selCls} />
              </Field>
            </div>
          )}

          {/* Крок 2 */}
          {step === 2 && (
            <div>
              <div className={`mb-3 text-sm font-medium ${Math.abs(weightSum - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                Сума ваг: {weightSum.toFixed(2)}% / 100%
              </div>
              <div className="space-y-1 max-h-[50vh] overflow-y-auto">
                {allMetrics.map((m) => {
                  const selected = m.id in weights;
                  const required = requiredIds.has(m.id);
                  return (
                    <div key={m.id} className="flex items-center gap-3 py-1.5 border-b border-gray-50">
                      <input type="checkbox" checked={selected} disabled={required} onChange={() => toggleMetric(m.id)} />
                      <span className="flex-1 text-sm text-gray-900">
                        {m.name}
                        {required && <span className="ml-2 text-xs text-amber-600">обов&apos;язкова</span>}
                      </span>
                      {selected && (
                        <div className="flex items-center gap-1">
                          <input
                            type="number" min="0" step="0.1"
                            value={weights[m.id]}
                            onChange={(e) => setWeights((p) => ({ ...p, [m.id]: e.target.value }))}
                            className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-gray-900"
                          />
                          <span className="text-sm text-gray-400">%</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Крок 3 */}
          {step === 3 && (
            <div className="space-y-2">
              {managers.map((m, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    value={m.name} placeholder="Ім'я менеджера"
                    onChange={(e) => setManager(i, { name: e.target.value })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                  <select value={m.grade} onChange={(e) => setManager(i, { grade: e.target.value as Grade })} className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900">
                    {GRADES.map((g) => <option key={g} value={g}>{GRADE_LABELS[g]}</option>)}
                  </select>
                  <input
                    type="number" step="any" min="0"
                    value={m.baseBonus}
                    onChange={(e) => setManager(i, { baseBonus: e.target.value })}
                    placeholder="базовий бонус"
                    title="Базовий бонус менеджера"
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  />
                  <select
                    value={m.userId}
                    onChange={(e) => setManager(i, { userId: e.target.value })}
                    title="Прив'язати до акаунта менеджера (для його дашборду)"
                    className="px-3 py-2 border border-gray-300 rounded-lg text-gray-900 max-w-[12rem]"
                  >
                    <option value="">— без акаунта —</option>
                    {managerUsers.map((u) => <option key={u.id} value={u.id}>{u.name || u.email}</option>)}
                  </select>
                  <button onClick={() => removeManager(i)} className="text-gray-400 hover:text-red-600 px-2">✕</button>
                </div>
              ))}
              <button onClick={addManager} className="text-blue-600 hover:text-blue-800 text-sm mt-2">+ Додати менеджера</button>

              <label className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-100 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={allowManagerInput} onChange={(e) => setAllowManagerInput(e.target.checked)} />
                Дозволити менеджерам самостійно вносити факт (по своїх рядках)
              </label>
            </div>
          )}

          {/* Крок 4 */}
          {step === 4 && (
            <div className="overflow-x-auto">
              {selectedMetrics.length === 0 || managers.length === 0 ? (
                <p className="text-gray-500 text-sm">Спочатку оберіть метрики і додайте менеджерів.</p>
              ) : (
                <>
                {Object.keys(benchmarks).length > 0 && (
                  <p className="text-xs text-gray-500 mb-3">
                    «Норма» — медіана факту з HISTORY по грейду менеджера.
                    <span className="text-amber-600"> Жовтим</span> підсвічені плани з відхиленням &gt;25%.
                  </p>
                )}
                <table className="text-sm">
                  <thead>
                    <tr className="text-left text-gray-500">
                      <th className="py-2 pr-4 font-medium">Менеджер</th>
                      {selectedMetrics.map((m) => (
                        <th key={m.id} className="py-2 px-2 font-medium whitespace-nowrap">{metricLabel(m.name, m.unit)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {managers.map((mgr, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="py-2 pr-4 text-gray-900 whitespace-nowrap">
                          {mgr.name || `Менеджер ${i + 1}`}
                          <span className="text-xs text-gray-400 ml-1">{GRADE_LABELS[mgr.grade]}</span>
                        </td>
                        {selectedMetrics.map((m) => {
                          const bench = benchmarks[m.id];
                          const norm = bench ? (bench.byGrade?.[mgr.grade]?.median ?? bench.overall?.median ?? null) : null;
                          const val = parseFloat(plans[i]?.[m.id] ?? '');
                          const deviates = norm != null && norm !== 0 && !isNaN(val) && Math.abs(val - norm) / Math.abs(norm) > 0.25;
                          return (
                            <td key={m.id} className="py-1 px-2 align-top">
                              <input
                                type="number" step="any"
                                value={plans[i]?.[m.id] ?? ''}
                                onChange={(e) => setPlan(i, m.id, e.target.value)}
                                title={deviates ? 'Значне відхилення від історичної норми (>25%)' : undefined}
                                className={`w-24 px-2 py-1 border rounded text-gray-900 ${deviates ? 'border-amber-400 bg-amber-50' : 'border-gray-300'}`}
                              />
                              {norm != null && (
                                <div className={`text-xs mt-0.5 ${deviates ? 'text-amber-600' : 'text-gray-400'}`}>
                                  норма: {norm}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
                </>
              )}
            </div>
          )}

          {/* Крок 5 */}
          {step === 5 && (
            <div className="space-y-4">
              <Field label="Модель бонусу *">
                <select value={bonusModel} onChange={(e) => setBonusModel(e.target.value as BonusModel)} className={selCls}>
                  <option value="LINEAR">Лінійна</option>
                  <option value="THRESHOLD">Порогова</option>
                  <option value="MATRIX">Матриця</option>
                </select>
              </Field>
              <Field label="Валюта">
                <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={selCls}>
                  <option value="$">$</option>
                  <option value="€">€</option>
                </select>
              </Field>
              <p className="text-xs text-gray-500">Базовий бонус задається окремо для кожного менеджера на кроці «Менеджери».</p>
              {bonusModel === 'THRESHOLD' && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Поріг, %">
                    <input type="number" step="any" value={threshold} onChange={(e) => setThreshold(e.target.value)} className={selCls} />
                  </Field>
                  <Field label="Макс. коефіцієнт">
                    <input type="number" step="any" value={maxCoefficient} onChange={(e) => setMaxCoefficient(e.target.value)} className={selCls} />
                  </Field>
                </div>
              )}
              {bonusModel === 'MATRIX' && (
                <p className="text-xs text-gray-500">Матриця: &lt;70% → 0, 70–89% → 50%, 90–99% → 100%, 100%+ → 120% базового бонусу.</p>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={() => onClose(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Скасувати</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg">Назад</button>}
            {step < 5 && <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Далі</button>}
            {step === 5 && (
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg">
                {saving ? 'Збереження...' : 'Зберегти чернетку'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const selCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500';

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
