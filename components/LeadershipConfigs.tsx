// components/LeadershipConfigs.tsx
// Прозорість для керівництва (ТЗ розд. 7): перегляд конфігурацій — метрики, ваги, плани.
'use client';

import { useEffect, useState } from 'react';
import ConfigurationView from './ConfigurationView';

interface Row {
  id: string; period: string;
  status: 'DRAFT' | 'ON_APPROVAL' | 'ACTIVE' | 'ON_CORRECTION' | 'ARCHIVED';
  department: { name: string };
  teamLead: { name: string | null; email: string };
  _count: { metrics: number; managers: number };
}

const STATUS: Record<Row['status'], { label: string; cls: string }> = {
  DRAFT: { label: 'Чернетка', cls: 'bg-gray-100 text-gray-600' },
  ON_APPROVAL: { label: 'На погодженні', cls: 'bg-amber-100 text-amber-700' },
  ACTIVE: { label: 'Активна', cls: 'bg-green-100 text-green-700' },
  ON_CORRECTION: { label: 'На коригуванні', cls: 'bg-orange-100 text-orange-700' },
  ARCHIVED: { label: 'Архівна', cls: 'bg-gray-100 text-gray-400' },
};

function fmtPeriod(p: string) { return p.length === 6 ? `${p.slice(4)}.${p.slice(0, 4)}` : p; }

export default function LeadershipConfigs() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    fetch('/api/configurations')
      .then((r) => r.json())
      .then((d) => Array.isArray(d) && setRows(d))
      .catch(() => setError('Не вдалося завантажити'))
      .finally(() => setLoading(false));
  }, []);

  async function open(id: string) {
    setError('');
    try {
      const res = await fetch(`/api/configurations/${id}`);
      if (!res.ok) throw new Error('Не вдалося завантажити конфігурацію');
      setDetail(await res.json());
    } catch (e: any) { setError(e.message); }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-1">Конфігурації команд</h2>
      <p className="text-sm text-gray-500 mb-4">Перегляд метрик, ваг і планів — для прозорості оцінки.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : rows.length === 0 ? (
        <p className="text-gray-500 text-sm">Конфігурацій ще немає.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((c) => (
            <div key={c.id} className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{c.department.name}</span>
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
                </div>
                <p className="text-sm text-gray-500 mt-0.5">
                  Період {fmtPeriod(c.period)} · {c.teamLead.name || c.teamLead.email} · {c._count.metrics} метрик · {c._count.managers} менеджерів
                </p>
              </div>
              <button onClick={() => open(c.id)} className="text-blue-600 hover:text-blue-800 text-sm whitespace-nowrap">Переглянути</button>
            </div>
          ))}
        </div>
      )}

      {detail && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setDetail(null)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Конфігурація</h3>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-700">✕</button>
            </div>
            <div className="px-6 py-5 overflow-y-auto flex-1">
              <ConfigurationView config={detail} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
