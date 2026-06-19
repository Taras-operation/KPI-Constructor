// components/TeamLeadConfigs.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import ConfigurationView from './ConfigurationView';
import FrontTable from './FrontTable';

interface ConfigRow {
  id: string;
  period: string;
  status: 'DRAFT' | 'ON_APPROVAL' | 'ACTIVE' | 'ON_CORRECTION' | 'ARCHIVED';
  teamLeadComment: string | null;
  approvedAt: string | null;
  department: { name: string };
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

export default function TeamLeadConfigs() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any | null>(null);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [frontId, setFrontId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

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

  async function openDetail(id: string) {
    setError('');
    setComment('');
    try {
      const res = await fetch(`/api/configurations/${id}`);
      if (!res.ok) throw new Error('Не вдалося завантажити конфігурацію');
      const data = await res.json();
      setComment(data.teamLeadComment ?? '');
      setDetail(data);
    } catch (e: any) { setError(e.message); }
  }

  async function act(action: 'APPROVE' | 'REQUEST_CORRECTION') {
    if (!detail) return;
    if (action === 'REQUEST_CORRECTION' && !comment.trim()) {
      setError('Для повернення на коригування залиште коментар');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await fetch(`/api/configurations/${detail.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, comment: comment.trim() || undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка');
      setDetail(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Мої конфігурації</h2>
        <label className="flex items-center gap-1.5 text-sm text-gray-500 cursor-pointer">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          Архівні
        </label>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {(() => { const visible = rows.filter((c) => showArchived || c.status !== 'ARCHIVED'); return (
      loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : visible.length === 0 ? (
        <p className="text-gray-500 text-sm">{rows.length ? 'Активних конфігурацій немає.' : 'Конфігурацій для вашої команди ще немає.'}</p>
      ) : (
        <div className="space-y-3">
          {visible.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{c.department.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  Період {fmtPeriod(c.period)} · {c._count.metrics} метрик · {c._count.managers} менеджерів
                </p>
                {c.status === 'ON_APPROVAL' && (
                  <p className="text-sm text-amber-700 mt-1">Очікує вашого погодження</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5 text-sm whitespace-nowrap">
                <button onClick={() => openDetail(c.id)} className="text-blue-600 hover:text-blue-800">
                  {c.status === 'ON_APPROVAL' ? 'Розглянути' : 'Переглянути'}
                </button>
                {c.status === 'ACTIVE' && (
                  <button onClick={() => setFrontId(c.id)} className="text-green-600 hover:text-green-800 font-medium">
                    FRONT
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )
      ); })()}

      {frontId && <FrontTable configId={frontId} onClose={() => setFrontId(null)} />}

      {/* Модалка перегляду + погодження */}
      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Конфігурація</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>

            <div className="px-6 py-5 overflow-y-auto flex-1">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}
              <ConfigurationView config={detail} />

              {detail.status === 'ON_APPROVAL' && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Коментар (необов&apos;язково для погодження)</label>
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={3}
                    placeholder="Питання чи зауваження до конфігурації..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>

            {detail.status === 'ON_APPROVAL' && (
              <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-2">
                <button onClick={() => act('REQUEST_CORRECTION')} disabled={busy} className="px-4 py-2 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 disabled:opacity-50">
                  Повернути на коригування
                </button>
                <button onClick={() => act('APPROVE')} disabled={busy} className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg">
                  {busy ? 'Обробка...' : 'Погоджую'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
