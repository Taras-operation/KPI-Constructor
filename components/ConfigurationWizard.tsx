// components/ConfigurationWizard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { metricLabel } from '@/lib/format';
import { parseTable, analyzeBaseline, type BaselineResult } from '@/lib/baseline';

const TREND_LABEL: Record<string, string> = { up: '↗', down: '↘', flat: '→' };

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
  propose?: boolean; // D7: режим пропозиції змін тімлідом (на аппрув Operations)
}

const GRADES: Grade[] = ['JUNIOR', 'MIDDLE', 'SENIOR'];
const GRADE_LABELS: Record<Grade, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };

function periodToMonthInput(period: string): string {
  return period && period.length === 6 ? `${period.slice(0, 4)}-${period.slice(4)}` : '';
}

export default function ConfigurationWizard({ initial, onClose, propose = false }: Props) {
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
  const [periodicity, setPeriodicity] = useState<string>(initial?.periodicity ?? 'MONTHLY');

  // Крок 2: вибрані метрики -> вага
  const [weights, setWeights] = useState<Record<string, string>>(() => {
    const w: Record<string, string> = {};
    initial?.metrics?.forEach((cm: any) => { w[cm.metricId] = String(cm.weight); });
    return w;
  });

  // D3: зняті обов'язкові метрики -> обґрунтування
  const [excludedReasons, setExcludedReasons] = useState<Record<string, string>>(() => {
    const r: Record<string, string> = {};
    (initial?.requiredOverrides ?? []).forEach((o: any) => { r[o.metricId] = o.reason; });
    return r;
  });

  // D2: Baseline (крок 2)
  const [baselineText, setBaselineText] = useState('');
  const [baselineUrl, setBaselineUrl] = useState('');
  const [baselineResult, setBaselineResult] = useState<BaselineResult | null>(null);
  const [baselineError, setBaselineError] = useState('');
  const [baselineBusy, setBaselineBusy] = useState(false);
  // підказки планів з Baseline: metricId -> grade -> медіана
  const [baselineSuggestions, setBaselineSuggestions] = useState<Record<string, Record<string, number>>>({});

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

  // Автовибір обов'язкових метрик при зміні відділу (крім свідомо знятих)
  useEffect(() => {
    if (!departmentId) return;
    setWeights((prev) => {
      const next = { ...prev };
      requiredIds.forEach((id) => { if (!(id in next) && !(id in excludedReasons)) next[id] = ''; });
      return next;
    });
  }, [departmentId, requiredIds, excludedReasons]);

  const selectedMetricIds = Object.keys(weights);
  const selectedMetrics = allMetrics.filter((m) => selectedMetricIds.includes(m.id));
  const weightSum = selectedMetricIds.reduce((s, id) => s + (parseFloat(weights[id]) || 0), 0);

  function toggleMetric(id: string) {
    const required = requiredIds.has(id);
    const selected = id in weights;

    if (required && selected) {
      // D3: зняти обов'язкову можна лише з обґрунтуванням
      const reason = window.prompt('Обґрунтування зняття обов\'язкової метрики (видно керівництву):');
      if (!reason || !reason.trim()) return;
      setExcludedReasons((p) => ({ ...p, [id]: reason.trim() }));
      setWeights((prev) => { const next = { ...prev }; delete next[id]; return next; });
      return;
    }
    if (required && !selected) {
      // повертаємо обов'язкову — прибираємо обґрунтування
      setExcludedReasons((p) => { const n = { ...p }; delete n[id]; return n; });
      setWeights((prev) => ({ ...prev, [id]: '' }));
      return;
    }
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

  // --- D2: Baseline ---
  const [baselineApprove, setBaselineApprove] = useState<Record<string, boolean>>({});
  function matchBank(name: string): Metric | undefined {
    return allMetrics.find((am) => am.name.trim().toLowerCase() === name.trim().toLowerCase());
  }
  async function baselineFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBaselineError('');
    try {
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
        const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: false });
        setBaselineText(aoa.map((r) => r.map((c) => String(c ?? '')).join('\t')).join('\n'));
      } else setBaselineText(await file.text());
    } catch { setBaselineError('Не вдалося прочитати файл.'); }
    e.target.value = '';
  }
  async function baselineGoogle() {
    if (!baselineUrl.trim()) return;
    setBaselineBusy(true); setBaselineError('');
    try {
      const res = await fetch('/api/baseline/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: baselineUrl }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка імпорту');
      setBaselineText(d.text);
    } catch (e: any) { setBaselineError(e.message); } finally { setBaselineBusy(false); }
  }
  function runBaseline() {
    setBaselineError('');
    const t = parseTable(baselineText);
    if (t.headers.length === 0 || t.rows.length === 0) { setBaselineError('Вставте дані з заголовком і рядками.'); return; }
    const res = analyzeBaseline(t);
    setBaselineResult(res);
    const appr: Record<string, boolean> = {};
    res.metrics.forEach((m) => { const bm = matchBank(m.name); if (bm) appr[bm.id] = true; });
    setBaselineApprove(appr);
  }
  function applyBaseline() {
    if (!baselineResult) return;
    const sugg = { ...baselineSuggestions };
    setWeights((prev) => {
      const next = { ...prev };
      baselineResult.metrics.forEach((m) => {
        const bm = matchBank(m.name);
        if (bm && baselineApprove[bm.id]) {
          if (!(bm.id in next)) next[bm.id] = '';
          const g: Record<string, number> = {};
          Object.entries(m.byGrade).forEach(([grade, v]: any) => { if (v.median != null) g[grade] = v.median; });
          sugg[bm.id] = g;
        }
      });
      return next;
    });
    // зняти можливі обґрунтування для повернених метрик
    setExcludedReasons((prev) => {
      const n = { ...prev };
      baselineResult.metrics.forEach((m) => { const bm = matchBank(m.name); if (bm && baselineApprove[bm.id]) delete n[bm.id]; });
      return n;
    });
    setBaselineSuggestions(sugg);
    setStep(3);
  }
  function fillPlansFromBaseline() {
    setPlans((prev) => {
      const next: Record<number, Record<string, string>> = { ...prev };
      managers.forEach((mgr, i) => {
        selectedMetricIds.forEach((mid) => {
          const val = baselineSuggestions[mid]?.[mgr.grade];
          if (val != null && (next[i]?.[mid] ?? '') === '') {
            next[i] = { ...(next[i] || {}), [mid]: String(val) };
          }
        });
      });
      return next;
    });
  }

  async function handleSave() {
    setError('');
    // Клієнтська валідація
    if (!departmentId || !teamLeadId || !monthInput) { setError('Заповніть відділ, тімліда і період'); setStep(1); return; }
    if (selectedMetricIds.length === 0) { setError('Оберіть хоча б одну метрику'); setStep(3); return; }
    if (Math.abs(weightSum - 100) > 0.01) { setError('Сума ваг має дорівнювати 100%'); setStep(3); return; }
    if (managers.length === 0 || managers.some((m) => !m.name.trim())) { setError('Додайте менеджерів з іменами'); setStep(4); return; }
    if (managers.some((m) => m.baseBonus === '' || isNaN(parseFloat(m.baseBonus)) || parseFloat(m.baseBonus) < 0)) {
      setError('Вкажіть базовий бонус (>= 0) для кожного менеджера'); setStep(4); return;
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
      periodicity,
      bonusModel,
      bonusParameters,
      allowManagerInput,
      metrics: selectedMetricIds.map((id) => ({ metricId: id, weight: parseFloat(weights[id]) || 0 })),
      managers: managers.map((m) => ({ name: m.name.trim(), grade: m.grade, userId: m.userId || null, baseBonus: parseFloat(m.baseBonus) })),
      plans,
      requiredOverrides: Object.entries(excludedReasons)
        .filter(([id]) => requiredIds.has(id) && !(id in weights))
        .map(([metricId, reason]) => ({ metricId, name: allMetrics.find((m) => m.id === metricId)?.name, reason })),
    };

    setSaving(true);
    try {
      const url = propose
        ? `/api/configurations/${initial.id}/change-request`
        : editing ? `/api/configurations/${initial.id}` : '/api/configurations';
      const method = propose ? 'POST' : editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(propose ? { ...body, summary: 'Зміни конфігурації від тімліда' } : body),
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

  const stepTitles = ['Загальне', 'Baseline', 'Метрики і ваги', 'Менеджери', 'Плани', 'Бонусна модель'];

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            {propose ? 'Пропозиція змін (на погодження Operations)' : editing ? 'Редагування конфігурації' : 'Нова KPI-конфігурація'}
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
              <Field label="Періодичність *">
                <select value={periodicity} onChange={(e) => setPeriodicity(e.target.value)} className={selCls}>
                  <option value="MONTHLY">Щомісячно</option>
                  <option value="QUARTERLY">Щоквартально</option>
                  <option value="SEMIANNUAL">Кожні 6 місяців</option>
                </select>
              </Field>
              <Field label="Стартовий період *">
                <input type="month" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} className={selCls} />
              </Field>
            </div>
          )}

          {/* Крок 2 — Baseline Analyzer */}
          {step === 2 && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">
                Завантажте ретро-дані (колонки <code className="bg-gray-100 px-1 rounded">period</code>,{' '}
                <code className="bg-gray-100 px-1 rounded">grade</code> + метрики). Система порахує статистику і запропонує метрики.
                Крок необов&apos;язковий — можна пропустити і обрати метрики вручну.
              </p>

              <div className="flex flex-col sm:flex-row gap-2">
                <label className="inline-flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:border-blue-400 shrink-0">
                  📄 CSV / XLSX
                  <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={baselineFile} className="hidden" />
                </label>
                <div className="flex-1 flex gap-2">
                  <input value={baselineUrl} onChange={(e) => setBaselineUrl(e.target.value)} placeholder="Посилання на Google-таблицю" className={`flex-1 ${selCls}`} />
                  <button onClick={baselineGoogle} disabled={baselineBusy} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 disabled:opacity-50">Імпорт</button>
                </div>
              </div>
              <textarea value={baselineText} onChange={(e) => setBaselineText(e.target.value)} rows={5}
                placeholder={'period\tgrade\tFTD, #\n202401\tJUNIOR\t100'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 font-mono text-xs outline-none focus:ring-2 focus:ring-blue-500" />
              <button onClick={runBaseline} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">Аналізувати</button>

              {baselineError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{baselineError}</div>}

              {baselineResult && (
                <div className="space-y-2 mt-2">
                  {baselineResult.metrics.length === 0 && <p className="text-gray-500 text-sm">Числових метрик не знайдено.</p>}
                  {baselineResult.metrics.map((m) => {
                    const bm = matchBank(m.name);
                    return (
                      <div key={m.name} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="flex items-center gap-2 text-sm">
                            {bm ? (
                              <input type="checkbox" checked={!!baselineApprove[bm.id]} onChange={(e) => setBaselineApprove((p) => ({ ...p, [bm.id]: e.target.checked }))} />
                            ) : <span className="w-4" />}
                            <span className="font-medium text-gray-900">{m.name}</span>
                            {!bm && <span className="text-xs text-amber-600">немає в банку метрик — додайте у розділі «Банк метрик»</span>}
                          </label>
                          <span className="text-xs text-gray-500 whitespace-nowrap">
                            сер. {m.mean ?? '—'} · σ {m.stdDev ?? '—'} {m.trend && `· ${TREND_LABEL[m.trend]}`}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-gray-600">
                          {Object.entries(m.byGrade).map(([g, v]: any) => (
                            <span key={g} className="px-2 py-0.5 bg-gray-50 border border-gray-200 rounded-full">{g}: медіана {v.median ?? '—'}</span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={applyBaseline} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm">
                    Застосувати обрані метрики до конфігурації
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Крок 3 — метрики і ваги */}
          {step === 3 && (
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
                      <input type="checkbox" checked={selected} onChange={() => toggleMetric(m.id)} />
                      <span className="flex-1 text-sm text-gray-900">
                        {m.name}
                        {required && <span className="ml-2 text-xs text-amber-600">обов&apos;язкова</span>}
                        {required && !selected && excludedReasons[m.id] && (
                          <span className="ml-2 text-xs text-red-600">знято: {excludedReasons[m.id]}</span>
                        )}
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

          {/* Крок 4 — менеджери */}
          {step === 4 && (
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

          {/* Крок 5 — плани */}
          {step === 5 && (
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
                {Object.keys(baselineSuggestions).length > 0 && (
                  <button onClick={fillPlansFromBaseline} className="mb-3 text-sm text-blue-600 hover:text-blue-800">
                    ⬇ Підставити плани з Baseline (медіана по грейду)
                  </button>
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

          {/* Крок 6 — бонусна модель */}
          {step === 6 && (
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
            {step < 6 && <button onClick={() => setStep(step + 1)} className="px-4 py-2 bg-gray-800 text-white rounded-lg">Далі</button>}
            {step === 6 && (
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium rounded-lg">
                {saving ? 'Збереження...' : propose ? 'Надіслати на погодження' : 'Зберегти чернетку'}
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
