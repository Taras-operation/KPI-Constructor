// components/TeamLeadFront.tsx
// V: окремий розділ FRONT у сайдбарі тімліда — список активних конфігурацій із входом у FRONT.
'use client';

import { useCallback, useEffect, useState } from 'react';
import FrontTable from './FrontTable';

interface ConfigRow {
  id: string;
  period: string;
  status: 'DRAFT' | 'ON_APPROVAL' | 'ACTIVE' | 'ON_CORRECTION' | 'ARCHIVED';
  department: { name: string };
  _count: { metrics: number; managers: number };
}

function fmtPeriod(p: string) {
  return p.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p;
}

export default function TeamLeadFront() {
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [frontId, setFrontId] = useState<string | null>(null);

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

  const active = rows.filter((c) => c.status === 'ACTIVE');

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">FRONT — внесення факту</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Активні конфігурації вашої команди. Відкрийте FRONT, щоб внести факт і зберегти місяць.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : active.length === 0 ? (
        <p className="text-gray-500 text-sm">Активних конфігурацій ще немає.</p>
      ) : (
        <div className="space-y-3">
          {active.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between gap-4">
              <div>
                <span className="font-medium text-gray-900">{c.department.name}</span>
                <p className="text-sm text-gray-500 mt-1">
                  Період {fmtPeriod(c.period)} · {c._count.metrics} метрик · {c._count.managers} менеджерів
                </p>
              </div>
              <button onClick={() => setFrontId(c.id)} className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg text-sm whitespace-nowrap">
                Відкрити FRONT
              </button>
            </div>
          ))}
        </div>
      )}

      {frontId && <FrontTable configId={frontId} onClose={() => { setFrontId(null); load(); }} />}
    </div>
  );
}
