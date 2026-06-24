// components/ChangeRequestsManager.tsx
// D7: Operations розглядає запити тімлідів на зміну конфігурацій.
'use client';

import { useCallback, useEffect, useState } from 'react';

interface Mgr { name: string; grade: string; baseBonus?: number }
interface CR {
  id: string;
  summary: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  payload: any;
  requestedBy: { name: string | null; email: string };
  configuration: { department: { name: string }; period: string };
}

function fmtPeriod(p: string) { return p?.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function ChangeRequestsManager() {
  const [rows, setRows] = useState<CR[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/change-requests?status=PENDING');
      if (!res.ok) throw new Error('Не вдалося завантажити запити');
      setRows(await res.json());
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolve(id: string, action: 'APPROVE' | 'REJECT') {
    if (action === 'REJECT' && !confirm('Відхилити запит на зміну?')) return;
    setBusy(id); setError('');
    try {
      const res = await fetch(`/api/change-requests/${id}/resolve`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Помилка');
      await load();
    } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Запити на зміну від тімлідів</h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Немає запитів, що очікують розгляду.</p>
      ) : (
        <div className="space-y-3">
          {rows.map((c) => (
            <div key={c.id} className="border border-amber-200 bg-amber-50/40 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-gray-900">{c.configuration.department.name} · {fmtPeriod(c.configuration.period)}</p>
                  <p className="text-sm text-gray-600 mt-0.5">{c.summary}</p>
                  <p className="text-xs text-gray-400 mt-1">від {c.requestedBy.name || c.requestedBy.email}</p>
                  <button onClick={() => setExpanded(expanded === c.id ? null : c.id)} className="text-xs text-blue-600 hover:text-blue-800 mt-1">
                    {expanded === c.id ? 'Згорнути' : 'Що змінюється'}
                  </button>
                  {expanded === c.id && (
                    <div className="mt-2 text-xs text-gray-700 space-y-1 bg-white border border-gray-200 rounded p-2">
                      <p>Метрик: {c.payload?.metrics?.length ?? 0}</p>
                      <p>Менеджерів: {c.payload?.managers?.length ?? 0}
                        {Array.isArray(c.payload?.managers) && c.payload.managers.length > 0 &&
                          ` (${c.payload.managers.map((m: Mgr) => `${m.name}/${m.grade}/${m.baseBonus ?? 0}`).join(', ')})`}
                      </p>
                      <p>Бонусна модель: {c.payload?.bonusModel}</p>
                      {Array.isArray(c.payload?.requiredOverrides) && c.payload.requiredOverrides.length > 0 && (
                        <p className="text-amber-700">Зняті обов&apos;язкові: {c.payload.requiredOverrides.map((o: any) => o.name || o.metricId).join(', ')}</p>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1.5 text-sm whitespace-nowrap">
                  <button onClick={() => resolve(c.id, 'APPROVE')} disabled={busy === c.id} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white font-medium rounded-lg">
                    {busy === c.id ? '...' : 'Застосувати'}
                  </button>
                  <button onClick={() => resolve(c.id, 'REJECT')} disabled={busy === c.id} className="px-3 py-1.5 border border-gray-300 text-gray-600 hover:text-red-600 rounded-lg">
                    Відхилити
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
