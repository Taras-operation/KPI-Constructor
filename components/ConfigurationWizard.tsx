// components/ConfigurationWizard.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import { metricLabel } from '@/lib/format';
import { parseTable, analyzeBaseline, type BaselineResult } from '@/lib/baseline';
import Markdown from '@/components/Markdown';

const TREND_LABEL: Record<string, string> = { up: '↗', down: '↘', flat: '→' };

type Grade = 'JUNIOR' | 'MIDDLE' | 'SENIOR';
type BonusModel = 'LINEAR' | 'THRESHOLD' | 'MATRIX';

interface Department { id: string; name: string }
interface Lead { id: string; name: string | null; email: string }
interface Metric {
  id: string; name: string; unit: string | null;
  direction: string; requiredForDepartments: string[];
  usageCount?: number;
}

interface Props {
  initial?: any | null; // повна конфігурація для редагування
  onClose: (saved: boolean) => void;
  propose?: boolean; // D7: режим пропозиції змін тімлідом (на аппрув Operations)
}

const GRADES: Grade[] = ['JUNIOR', 'MIDDLE', 'SENIOR'];
const GRADE_LABELS: Record<Grade, string> = { JUNIOR: 'Junior', MIDDLE: 'Middle', SENIOR: 'Senior' };
const POPULAR_LIMIT = 10;
const DEFAULT_MATRIX: { from: number; mult: number }[] = [
  { from: 0, mult: 0 },
  { from: 70, mult: 0.5 },
  { from: 90, mult: 1 },
  { from: 100, mult: 1.2 },
];

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

  // D2: Baseline (крок 2). C: кілька файлів, для кожного — свій місяць
  const [slots, setSlots] = useState<{ month: string; text: string; name: string }[]>([
    { month: '', text: '', name: '' },
    { month: '', text: '', name: '' },
    { month: '', text: '', name: '' },
  ]);
  const [baselineUrl, setBaselineUrl] = useState('');
  const [baselineResult, setBaselineResult] = useState<BaselineResult | null>(null);
  const [baselineError, setBaselineError] = useState('');
  const [baselineBusy, setBaselineBusy] = useState(false);
  // підказки планів з Baseline: metricId -> grade -> медіана
  const [baselineSuggestions, setBaselineSuggestions] = useState<Record<string, Record<string, number>>>({});
  const [baselineAi, setBaselineAi] = useState('');
  const [baselineAiBusy, setBaselineAiBusy] = useState(false);

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
  const [matrix, setMatrix] = useState<{ from: number; mult: number }[]>(
    Array.isArray(bp.matrix) && bp.matrix.length ? bp.matrix : DEFAULT_MATRIX
  );

  // UI: пошук/популярність метрик, згортання, швидке створення (Wave 2)
  const [metricSearch, setMetricSearch] = useState('');
  const [showAllMetrics, setShowAllMetrics] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [quickDeptName, setQuickDeptName] = useState<string | null>(null);
  const [quickLead, setQuickLead] = useState<{ name: string; email: string; password: string } | null>(null);
  const [quickBusy, setQuickBusy] = useState(false);
  const [teamAiBusy, setTeamAiBusy] = useState(false);
  const [teamAiError, setTeamAiError] = useState('');

  const loadDepartments = () => fetch('/api/departments').then((r) => r.json()).then(setDepartments).catch(() => {});
  const loadLeads = () => fetch('/api/users?role=TEAM_LEAD').then((r) => r.json()).then(setLeads).catch(() => {});
  const loadMetrics = () => fetch('/api/metrics?status=ACTIVE&withUsage=1').then((r) => r.json()).then(setAllMetrics).catch(() => {});

  useEffect(() => {
    loadDepartments();
    loadLeads();
    fetch('/api/users?role=MANAGER').then((r) => r.json()).then(setManagerUsers).catch(() => {});
    loadMetrics();
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

  // Метрики, відсортовані за популярністю (L): найчастіше вживані — зверху
  const metricsByPopularity = useMemo(
    () => [...allMetrics].sort((a, b) => (b.usageCount ?? 0) - (a.usageCount ?? 0) || a.name.localeCompare(b.name)),
    [allMetrics]
  );
  // Доступні для додавання (не обрані), з урахуванням пошуку
  const availableMetrics = useMemo(() => {
    const q = metricSearch.trim().toLowerCase();
    return metricsByPopularity.filter((m) => !(m.id in weights) && (!q || m.name.toLowerCase().includes(q)));
  }, [metricsByPopularity, weights, metricSearch]);
  const searching = metricSearch.trim().length > 0;
  const visibleAvailable = searching || showAllMetrics ? availableMetrics : availableMetrics.slice(0, POPULAR_LIMIT);

  // A: швидке створення відділу / тімліда (тільки Operations)
  async function createDept() {
    const name = (quickDeptName ?? '').trim();
    if (!name) return;
    setQuickBusy(true); setError('');
    try {
      const res = await fetch('/api/departments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка створення відділу');
      await loadDepartments();
      setDepartmentId(d.id);
      setQuickDeptName(null);
    } catch (e: any) { setError(e.message); } finally { setQuickBusy(false); }
  }
  async function createLead() {
    if (!quickLead) return;
    const { name, email, password } = quickLead;
    if (!name.trim() || !email.trim() || password.length < 6) { setError('Тімлід: вкажіть імʼя, email і пароль (≥6 символів)'); return; }
    setQuickBusy(true); setError('');
    try {
      const res = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role: 'TEAM_LEAD', departmentId: departmentId || null }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка створення тімліда');
      await loadLeads();
      setTeamLeadId(d.id);
      setQuickLead(null);
    } catch (e: any) { setError(e.message); } finally { setQuickBusy(false); }
  }

  // G: додати відсутню метрику в банк прямо з кроку Baseline (Operations)
  async function addMetricToBank(name: string) {
    setBaselineError('');
    try {
      const res = await fetch('/api/metrics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, valueType: 'NUMBER', direction: 'MORE_IS_BETTER' }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка додавання метрики');
      await loadMetrics();
      setBaselineApprove((p) => ({ ...p, [d.id]: true }));
    } catch (e: any) { setBaselineError(e.message); }
  }

  // O: розпізнати список команди з файлу через AI
  async function teamFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setTeamAiError(''); setTeamAiBusy(true);
    try {
      const text = await readFileText(file);
      const res = await fetch('/api/ai/team', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка розпізнавання');
      const recognized = (d.team ?? []).map((m: any) => ({ name: m.name, grade: m.grade as Grade, userId: '', baseBonus: '' }));
      if (recognized.length === 0) { setTeamAiError('Не вдалося розпізнати жодного учасника.'); return; }
      setManagers((prev) => {
        const kept = prev.filter((m) => m.name.trim());
        return [...kept, ...recognized];
      });
    } catch (e: any) { setTeamAiError(e.message); } finally { setTeamAiBusy(false); e.target.value = ''; }
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
  function setSlot(i: number, patch: Partial<{ month: string; text: string; name: string }>) {
    setSlots((p) => p.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function addSlot() { setSlots((p) => [...p, { month: '', text: '', name: '' }]); }
  function removeSlot(i: number) { setSlots((p) => (p.length > 1 ? p.filter((_, idx) => idx !== i) : p)); }

  async function readFileText(file: File): Promise<string> {
    if (/\.(xlsx|xls)$/i.test(file.name)) {
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const aoa = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false, raw: false });
      return aoa.map((r) => r.map((c) => String(c ?? '')).join('\t')).join('\n');
    }
    return file.text();
  }
  async function slotFile(i: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setBaselineError('');
    try {
      const text = await readFileText(file);
      setSlot(i, { text, name: file.name });
    } catch { setBaselineError('Не вдалося прочитати файл.'); }
    e.target.value = '';
  }
  async function importGoogle() {
    if (!baselineUrl.trim()) return;
    setBaselineBusy(true); setBaselineError('');
    try {
      const res = await fetch('/api/baseline/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: baselineUrl }) });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка імпорту');
      setSlots((p) => {
        const empty = p.findIndex((s) => !s.text.trim());
        if (empty >= 0) return p.map((s, idx) => (idx === empty ? { ...s, text: d.text, name: 'Google-таблиця' } : s));
        return [...p, { month: '', text: d.text, name: 'Google-таблиця' }];
      });
      setBaselineUrl('');
    } catch (e: any) { setBaselineError(e.message); } finally { setBaselineBusy(false); }
  }

  // Зливає всі файли в одну таблицю: місяць слота стає колонкою period (C)
  function buildMergedTable() {
    const parsed = slots.filter((s) => s.text.trim()).map((s) => ({ month: s.month, t: parseTable(s.text) }));
    const metricCols: string[] = [];
    const seen = new Set<string>();
    parsed.forEach(({ t }) => t.headers.forEach((h) => {
      const hl = h.toLowerCase();
      if (hl !== 'period' && hl !== 'grade' && !seen.has(h)) { seen.add(h); metricCols.push(h); }
    }));
    const headers = ['period', 'grade', ...metricCols];
    const rows: string[][] = [];
    parsed.forEach(({ month, t }) => {
      const lower = t.headers.map((h) => h.toLowerCase());
      const pIdx = lower.indexOf('period');
      const gIdx = lower.indexOf('grade');
      const colOf: Record<string, number> = {};
      t.headers.forEach((h, i) => { colOf[h] = i; });
      t.rows.forEach((r) => {
        const period = month ? month.replace('-', '') : (pIdx >= 0 ? (r[pIdx] ?? '') : '');
        const grade = gIdx >= 0 ? (r[gIdx] ?? '') : '';
        rows.push([period, grade, ...metricCols.map((mc) => (colOf[mc] !== undefined ? (r[colOf[mc]] ?? '') : ''))]);
      });
    });
    return { headers, rows };
  }

  function runBaseline() {
    setBaselineError('');
    const used = slots.filter((s) => s.text.trim());
    if (used.length === 0) { setBaselineError('Завантажте хоча б один файл з даними.'); return; }
    const t = buildMergedTable();
    if (t.headers.length <= 2 || t.rows.length === 0) { setBaselineError('У файлах не знайдено даних з метриками.'); return; }
    const res = analyzeBaseline(t);
    setBaselineResult(res);
    const appr: Record<string, boolean> = {};
    res.metrics.forEach((m) => { const bm = matchBank(m.name); if (bm) appr[bm.id] = true; });
    setBaselineApprove(appr);
  }
  async function runBaselineAi() {
    if (!baselineResult) return;
    setBaselineAiBusy(true); setBaselineAi('');
    try {
      const res = await fetch('/api/ai/baseline', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: baselineResult.metrics }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка AI');
      setBaselineAi(d.text);
    } catch (e: any) { setBaselineAi(`⚠ ${e.message}`); } finally { setBaselineAiBusy(false); }
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
    if (bonusModel === 'MATRIX') {
      bonusParameters.matrix = matrix;
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

  // Валідація поточного кроку — блокує перехід «Далі» (B, M)
  function stepError(s: number): string | null {
    if (s === 1) {
      if (!departmentId || !teamLeadId || !monthInput) return 'Заповніть відділ, тімліда і період';
    }
    if (s === 3) {
      if (selectedMetricIds.length === 0) return 'Оберіть хоча б одну метрику';
      if (Math.abs(weightSum - 100) > 0.01) return 'Сума вагових коефіцієнтів має дорівнювати 100%';
    }
    return null;
  }

  function goNext() {
    const err = stepError(step);
    if (err) { setError(err); return; }
    setError('');
    setStep(step + 1);
  }

  const stepTitles = ['Загальне', 'Baseline', 'Метрики і ваги', 'Менеджери', 'Плани', 'Бонусна модель'];

  // F: згорнуте вікно — стан зберігається, бо компонент лишається змонтованим
  if (minimized) {
    return (
      <button
        onClick={() => setMinimized(false)}
        className="fixed bottom-4 right-4 z-50 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2"
      >
        <span>▢</span>
        {propose ? 'Пропозиція змін' : editing ? 'Редагування конфігурації' : 'Нова конфігурація'} — відновити
      </button>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-lg font-semibold text-gray-900">
              {propose ? 'Пропозиція змін (на погодження Operations)' : editing ? 'Редагування конфігурації' : 'Нова KPI-конфігурація'}
            </h3>
            <div className="flex items-center gap-3 -mt-1">
              <button onClick={() => setMinimized(true)} title="Згорнути (дані збережуться)" className="text-gray-400 hover:text-gray-700 text-lg leading-none">▢</button>
              <button onClick={() => onClose(false)} title="Закрити без збереження" className="text-gray-400 hover:text-gray-700 text-xl leading-none">✕</button>
            </div>
          </div>
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
                <div className="flex gap-2">
                  <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={selCls}>
                    <option value="">— оберіть —</option>
                    {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                  {!propose && (
                    <button type="button" onClick={() => setQuickDeptName(quickDeptName === null ? '' : null)} className="shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-blue-600 hover:border-blue-400">+ відділ</button>
                  )}
                </div>
                {quickDeptName !== null && (
                  <div className="flex gap-2 mt-2">
                    <input autoFocus value={quickDeptName} onChange={(e) => setQuickDeptName(e.target.value)} placeholder="Назва нового відділу" className={selCls} />
                    <button type="button" onClick={createDept} disabled={quickBusy} className="shrink-0 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Створити</button>
                    <button type="button" onClick={() => setQuickDeptName(null)} className="shrink-0 px-3 py-2 text-gray-500 text-sm">✕</button>
                  </div>
                )}
              </Field>
              <Field label="Тімлід *">
                <div className="flex gap-2">
                  <select value={teamLeadId} onChange={(e) => setTeamLeadId(e.target.value)} className={selCls}>
                    <option value="">— оберіть —</option>
                    {leads.map((l) => <option key={l.id} value={l.id}>{l.name || l.email}</option>)}
                  </select>
                  {!propose && (
                    <button type="button" onClick={() => setQuickLead(quickLead === null ? { name: '', email: '', password: '' } : null)} className="shrink-0 px-3 py-2 border border-gray-300 rounded-lg text-sm text-blue-600 hover:border-blue-400">+ тімлід</button>
                  )}
                </div>
                {quickLead !== null && (
                  <div className="mt-2 p-3 border border-gray-200 rounded-lg space-y-2">
                    <input value={quickLead.name} onChange={(e) => setQuickLead({ ...quickLead, name: e.target.value })} placeholder="Імʼя тімліда" className={selCls} />
                    <input value={quickLead.email} onChange={(e) => setQuickLead({ ...quickLead, email: e.target.value })} placeholder="Email" type="email" className={selCls} />
                    <input value={quickLead.password} onChange={(e) => setQuickLead({ ...quickLead, password: e.target.value })} placeholder="Пароль (≥6 символів)" type="text" className={selCls} />
                    <div className="flex gap-2">
                      <button type="button" onClick={createLead} disabled={quickBusy} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50">Створити тімліда</button>
                      <button type="button" onClick={() => setQuickLead(null)} className="px-3 py-2 text-gray-500 text-sm">Скасувати</button>
                    </div>
                  </div>
                )}
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
                Завантажте ретро-дані по місяцях окремими файлами: для кожного файлу вкажіть, за який місяць ці дані
                (PowerBI зазвичай не дає розбивку по місяцях — вивантажуйте по місяцю на файл). Колонки у файлі:{' '}
                <code className="bg-gray-100 px-1 rounded">grade</code> + метрики. Колонку{' '}
                <code className="bg-gray-100 px-1 rounded">period</code> додавати не обовʼязково — місяць візьметься з поля зліва.
                Крок необовʼязковий — можна пропустити і обрати метрики вручну.
              </p>

              <div className="space-y-2">
                {slots.map((s, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 border border-gray-200 rounded-lg p-2">
                    <input
                      type="month" value={s.month} onChange={(e) => setSlot(i, { month: e.target.value })}
                      title="Місяць, за який ці дані" className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900"
                    />
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 cursor-pointer hover:border-blue-400">
                      📄 Файл CSV / XLSX
                      <input type="file" accept=".csv,.xlsx,.xls,text/csv" onChange={(e) => slotFile(i, e)} className="hidden" />
                    </label>
                    <span className={`text-xs flex-1 min-w-0 truncate ${s.name ? 'text-green-600' : 'text-gray-400'}`}>
                      {s.name ? `✓ ${s.name}` : 'файл не обрано'}
                    </span>
                    {slots.length > 1 && (
                      <button type="button" onClick={() => removeSlot(i)} title="Прибрати" className="text-gray-400 hover:text-red-600 px-1">✕</button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={addSlot} className="text-sm text-blue-600 hover:text-blue-800">+ ще місяць / файл</button>
              </div>

              <div className="flex gap-2 items-center">
                <input value={baselineUrl} onChange={(e) => setBaselineUrl(e.target.value)} placeholder="або імпорт з Google-таблиці (посилання)" className={`flex-1 ${selCls}`} />
                <button type="button" onClick={importGoogle} disabled={baselineBusy} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:border-blue-400 disabled:opacity-50">Імпорт</button>
              </div>

              <button onClick={runBaseline} className="px-4 py-2 bg-gray-800 text-white rounded-lg text-sm">Аналізувати</button>

              {baselineError && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded text-sm">{baselineError}</div>}

              {baselineResult && (
                <div className="space-y-2 mt-2">
                  {baselineResult.metrics.length === 0 && <p className="text-gray-500 text-sm">Числових метрик не знайдено.</p>}
                  {baselineResult.metrics.map((m) => {
                    const bm = matchBank(m.name);
                    return (
                      <div key={m.name} className="border border-gray-200 rounded-lg p-3">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="flex items-center gap-2 text-sm">
                            {bm ? (
                              <input type="checkbox" checked={!!baselineApprove[bm.id]} onChange={(e) => setBaselineApprove((p) => ({ ...p, [bm.id]: e.target.checked }))} />
                            ) : <span className="w-4" />}
                            <span className="font-medium text-gray-900">{m.name}</span>
                            {!bm && (
                              <span className="text-xs text-amber-600 flex items-center gap-1.5">
                                немає в банку метрик
                                {!propose && (
                                  <button type="button" onClick={() => addMetricToBank(m.name)} className="underline font-medium hover:text-amber-800">+ додати в банк</button>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                            <span title="Середнє арифметичне всіх значень вибірки">сер. {m.mean ?? '—'}</span>
                            <span title="Медіана — серединне значення; стійкіша до викидів, ніж середнє">мед. {m.median ?? '—'}</span>
                            <span title="Стандартне відхилення (σ) — розкид значень. Менше = стабільніше. Орієнтир: σ/сер. (CV) < 0.3 — добре, > 0.6 — нестабільно (план краще ставити по медіані)">σ {m.stdDev ?? '—'}</span>
                            <span title="Мінімум і максимум за вибіркою — діапазон, у якому коливалися значення">мін–макс {m.min ?? '—'}…{m.max ?? '—'}</span>
                            {m.trend && <span title="Тренд за періодами: ↗ зростання, ↘ падіння, → стабільно">{TREND_LABEL[m.trend]}</span>}
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
                  <div className="flex flex-wrap gap-2">
                    <button onClick={applyBaseline} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm">
                      Застосувати обрані метрики до конфігурації
                    </button>
                    <button onClick={runBaselineAi} disabled={baselineAiBusy} className="px-4 py-2 border border-purple-300 text-purple-700 hover:bg-purple-50 disabled:opacity-50 rounded-lg text-sm">
                      {baselineAiBusy ? 'AI аналізує...' : '✦ AI-рекомендації'}
                    </button>
                  </div>
                  {baselineAi && (
                    <div className="border border-purple-200 bg-purple-50 rounded-lg p-3">
                      <Markdown text={baselineAi} />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Крок 3 — метрики і ваги */}
          {step === 3 && (
            <div>
              <div className={`mb-3 text-sm font-medium ${Math.abs(weightSum - 100) < 0.01 ? 'text-green-600' : 'text-red-600'}`}>
                Сума вагових коефіцієнтів: {weightSum.toFixed(2)}% / 100%
              </div>

              {/* Обрані метрики — плашки з вагою (K) */}
              {selectedMetrics.length > 0 ? (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedMetrics.map((m) => {
                    const required = requiredIds.has(m.id);
                    return (
                      <div key={m.id} className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-full pl-3 pr-1.5 py-1">
                        <span className="text-sm text-gray-800">{m.name}</span>
                        {required && <span className="text-[10px] text-amber-600 uppercase">обовʼязк.</span>}
                        <input
                          type="number" min="0" step="5"
                          value={weights[m.id]}
                          onChange={(e) => setWeights((p) => ({ ...p, [m.id]: e.target.value }))}
                          className="w-14 px-1.5 py-0.5 border border-gray-300 rounded text-sm text-right text-gray-900 bg-white"
                        />
                        <span className="text-xs text-gray-400">%</span>
                        <button type="button" onClick={() => toggleMetric(m.id)} title="Прибрати метрику" className="text-gray-400 hover:text-red-600 w-5 text-center">✕</button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 mb-4">Метрики ще не обрані — додайте зі списку нижче.</p>
              )}

              {/* Пошук + список доступних (I, L) */}
              <input
                value={metricSearch}
                onChange={(e) => setMetricSearch(e.target.value)}
                placeholder="Пошук метрик..."
                className={`${selCls} mb-2`}
              />
              <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-[38vh] overflow-y-auto">
                {visibleAvailable.length === 0 ? (
                  <p className="text-sm text-gray-400 px-3 py-3">{searching ? 'Нічого не знайдено.' : 'Усі метрики вже обрані.'}</p>
                ) : (
                  visibleAvailable.map((m) => {
                    const required = requiredIds.has(m.id);
                    return (
                      <button
                        key={m.id} type="button" onClick={() => toggleMetric(m.id)}
                        className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left hover:bg-blue-50 transition"
                      >
                        <span className="text-sm text-gray-900">
                          {m.name}
                          {required && <span className="ml-2 text-xs text-amber-600">обов&apos;язкова</span>}
                          {required && excludedReasons[m.id] && <span className="ml-2 text-xs text-red-600">знято: {excludedReasons[m.id]}</span>}
                        </span>
                        <span className="flex items-center gap-3 shrink-0">
                          {(m.usageCount ?? 0) > 0 && (
                            <span className="text-xs text-gray-400" title="Скільки конфігурацій використовують цю метрику">★ {m.usageCount}</span>
                          )}
                          <span className="text-blue-600 text-sm">+ додати</span>
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
              {!searching && availableMetrics.length > POPULAR_LIMIT && (
                <button type="button" onClick={() => setShowAllMetrics((v) => !v)} className="mt-2 text-sm text-blue-600 hover:text-blue-800">
                  {showAllMetrics ? '▲ Згорнути' : `▼ Ще ${availableMetrics.length - POPULAR_LIMIT} метрик`}
                </button>
              )}
              {!searching && !showAllMetrics && availableMetrics.length > POPULAR_LIMIT && (
                <p className="mt-1 text-xs text-gray-400">Показано {POPULAR_LIMIT} найпопулярніших метрик.</p>
              )}
            </div>
          )}

          {/* Крок 4 — менеджери */}
          {step === 4 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2 pb-3 mb-1 border-b border-gray-100">
                <label className={`inline-flex items-center gap-2 px-3 py-1.5 border border-purple-300 text-purple-700 rounded-lg text-sm cursor-pointer hover:bg-purple-50 ${teamAiBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                  {teamAiBusy ? 'AI розпізнає...' : '✦ Розпізнати команду з файлу'}
                  <input type="file" accept=".csv,.xlsx,.xls,.txt,text/csv,text/plain" onChange={teamFile} className="hidden" />
                </label>
                <span className="text-xs text-gray-400">AI витягне нікнейми і грейди; решту тімлід уточнить вручну.</span>
              </div>
              {teamAiError && <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-1.5 rounded text-sm">{teamAiError}</div>}
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
            <div className="flex gap-4">
              <div className="flex-1 overflow-x-auto">
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
              {baselineResult && selectedMetrics.length > 0 && (
                <aside className="w-60 shrink-0 border-l border-gray-100 pl-4 hidden lg:block">
                  <h4 className="text-sm font-medium text-gray-900 mb-2">Статистика Baseline</h4>
                  <div className="space-y-2">
                    {selectedMetrics.map((m) => {
                      const ba = baselineResult.metrics.find((x) => x.name.trim().toLowerCase() === m.name.trim().toLowerCase());
                      if (!ba) return null;
                      return (
                        <div key={m.id} className="text-xs text-gray-600 border border-gray-100 rounded p-2">
                          <div className="font-medium text-gray-800 mb-0.5">{m.name}</div>
                          <div>сер. {ba.mean ?? '—'} · мед. {ba.median ?? '—'}</div>
                          <div>σ {ba.stdDev ?? '—'} · мін–макс {ba.min ?? '—'}…{ba.max ?? '—'}</div>
                        </div>
                      );
                    })}
                  </div>
                </aside>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Матриця бонусу</label>
                  <p className="text-xs text-gray-500 mb-2">
                    Від % виконання KPI → множник базового бонусу. За замовчуванням: &lt;70% → ×0, 70–89% → ×0.5, 90–99% → ×1, 100%+ → ×1.2.
                  </p>
                  <table className="text-sm">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-1 pr-3 font-medium">Від % виконання</th>
                        <th className="py-1 pr-3 font-medium">Множник бонусу</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {matrix.map((z, i) => (
                        <tr key={i}>
                          <td className="py-1 pr-3 whitespace-nowrap">
                            <input
                              type="number" step="any" value={z.from}
                              onChange={(e) => setMatrix((p) => p.map((x, idx) => (idx === i ? { ...x, from: parseFloat(e.target.value) || 0 } : x)))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                            <span className="ml-1 text-gray-400">%</span>
                          </td>
                          <td className="py-1 pr-3 whitespace-nowrap">
                            <span className="text-gray-400 mr-1">×</span>
                            <input
                              type="number" step="any" value={z.mult}
                              onChange={(e) => setMatrix((p) => p.map((x, idx) => (idx === i ? { ...x, mult: parseFloat(e.target.value) || 0 } : x)))}
                              className="w-24 px-2 py-1 border border-gray-300 rounded text-gray-900"
                            />
                          </td>
                          <td className="py-1">
                            {matrix.length > 1 && (
                              <button type="button" onClick={() => setMatrix((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-600 px-2">✕</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex gap-4 mt-2">
                    <button type="button" onClick={() => setMatrix((p) => [...p, { from: 0, mult: 0 }])} className="text-sm text-blue-600 hover:text-blue-800">+ Додати зону</button>
                    <button type="button" onClick={() => setMatrix(DEFAULT_MATRIX)} className="text-sm text-gray-500 hover:text-gray-700">Скинути до стандартних</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button onClick={() => onClose(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">Скасувати</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => { setError(''); setStep(step - 1); }} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg">Назад</button>}
            {step < 6 && (
              <button
                onClick={goNext}
                title={stepError(step) ?? undefined}
                className={`px-4 py-2 rounded-lg text-white ${stepError(step) ? 'bg-gray-300 cursor-not-allowed' : 'bg-gray-800 hover:bg-gray-900'}`}
              >
                Далі
              </button>
            )}
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
