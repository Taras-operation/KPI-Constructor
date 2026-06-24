// components/ConfigurationsManager.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfigurationWizard from './ConfigurationWizard';

interface ConfigRow {
  id: string;
  period: string;
  status: 'DRAFT' | 'ON_APPROVAL' | 'ACTIVE' | 'ON_CORRECTION' | 'ARCHIVED';
  teamLeadComment: string | null;
  approvedAt: string | null;
  department: { name: string };
  teamLead: { name: string | null; email: string };
  _count: { metrics: number; managers: number };
}

const STATUS: Record<ConfigRow['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Чернетка', cls: 'bg-gray-100 text-gray-600' },
  ON_APPROVAL: { label: 'На погодженні', cls: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: 'Активна', cls: 'bg-green-100 text-green-700' },
  ON_CORRECTION: { label: 'На коригуванні', cls: 'bg-orange-100 text-orange-700' },
  ARCHIVED: { label: 'Архівна', cls: 'bg-gray-100 text-gray-400' },
};

function fmtPeriod(p: string) {
  return p.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p;
}

export default function ConfigurationsManager() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wizardOpen, setWizardOpen] = useState(false);
  const [editInitial, setEditInitial] = useState<any | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [ai, setAi] = useState<{ open: boolean; busy: boolean; text: string; dept: string }>({ open: false, busy: false, text: '', dept: '' });

  async function runAi(c: ConfigRow) {
    setAi({ open: true, busy: true, text: '', dept: c.department.name });
    try {
      const res = await fetch(`/api/configurations/${c.id}/ai-analysis`, { method: 'POST' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Помилка AI');
      setAi({ open: true, busy: false, text: d.text, dept: c.department.name });
    } catch (e: any) {
      setAi({ open: true, busy: false, text: `⚠ ${e.message}`, dept: c.department.name });
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/configurations');
      if (!res.ok) throw new Error('Не вдалося завантажити конфігурації');
      setRows(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function action(id: string, act: string) {
    setError('');
    try {
      const res = await fetch(`/api/configurations/${id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: act }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка');
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function remove(id: string) {
    if (!confirm('Видалити чернетку?')) return;
    setError('');
    try {
      const res = await fetch(`/api/configurations/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка');
      await load();
    } catch (e: any) { setError(e.message); }
  }

  async function openEdit(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/configurations/${id}`);
      if (!res.ok) throw new Error('Не вдалося завантажити конфігурацію');
      setEditInitial(await res.json());
      setWizardOpen(true);
    } catch (e: any) { setError(e.message); }
  }

  function openCreate() {
    setEditInitial(null);
    setWizardOpen(true);
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">KPI-конфігурації</h2>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Архівні
          </label>
          <button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition">
            + Конфігурація
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {(() => { const visible = rows.filter((c) => showArchived || c.status !== 'ARCHIVED'); return (
      loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500 text-sm">{rows.length ? 'Активних конфігурацій немає.' : 'Конфігурацій ще немає.'}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{c.department.name}</span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[c.status].cls}`}>
                      {STATUS[c.status].label}
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Період {fmtPeriod(c.period)} · Тімлід {c.teamLead.name || c.teamLead.email} ·
                    {' '}{c._count.metrics} метрик · {c._count.managers} менеджерів
                  </p>
                  {c.teamLeadComment && (
                    <p className="text-sm text-orange-700 mt-2 bg-orange-50 rounded px-2 py-1">
                      Коментар тімліда: {c.teamLeadComment}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1.5 text-sm whitespace-nowrap">
                  {(c.status === 'DRAFT' || c.status === 'ON_CORRECTION') && (
                    <>
                      <button onClick={() => openEdit(c.id)} className="text-blue-600 hover:text-blue-800">Редагувати</button>
                      <button onClick={() => action(c.id, 'SEND_FOR_APPROVAL')} className="text-amber-600 hover:text-amber-800">Відправити на погодження</button>
                    </>
                  )}
                  {c.status === 'DRAFT' && (
                    <button onClick={() => remove(c.id)} className="text-gray-400 hover:text-red-600">Видалити</button>
                  )}
                  {c.status === 'ON_APPROVAL' && (
                    c.approvedAt
                      ? <button onClick={() => action(c.id, 'ACTIVATE')} className="text-green-600 hover:text-green-800 font-medium">Активувати</button>
                      : <span className="text-amber-600 text-xs">Очікує погодження тімліда</span>
                  )}
                  {c.status === 'ACTIVE' && (
                    <>
                      <button onClick={() => runAi(c)} className="text-purple-600 hover:text-purple-800">✦ AI-аналіз</button>
                      <button onClick={() => action(c.id, 'ARCHIVE')} className="text-gray-400 hover:text-red-600">Архівувати</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )
      ); })()}

      {ai.open && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setAi((a) => ({ ...a, open: false }))}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">✦ AI-аналіз — {ai.dept}</h3>
              <button onClick={() => setAi((a) => ({ ...a, open: false }))} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              {ai.busy ? (
                <p className="text-gray-500 text-sm">AI аналізує конфігурацію та історію...</p>
              ) : (
                <div className="text-sm text-gray-800 whitespace-pre-wrap">{ai.text}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {wizardOpen && (
        <ConfigurationWizard
          initial={editInitial}
          onClose={(saved) => {
            setWizardOpen(false);
            setEditInitial(null);
            if (saved) load();
          }}
        />
      )}
    </div>
  );
}
