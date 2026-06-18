// components/MetricsManager.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';

interface Department {
  id: string;
  name: string;
}

interface Metric {
  id: string;
  name: string;
  description: string | null;
  valueType: 'NUMBER' | 'PERCENT' | 'RATING';
  unit: string | null;
  direction: 'MORE_IS_BETTER' | 'LESS_IS_BETTER';
  status: 'ACTIVE' | 'ARCHIVED';
  requiredForDepartments: string[];
}

const VALUE_TYPE_LABELS: Record<Metric['valueType'], string> = {
  NUMBER: 'Число',
  PERCENT: 'Відсоток',
  RATING: 'Оцінка 1-5',
};

const DIRECTION_LABELS: Record<Metric['direction'], string> = {
  MORE_IS_BETTER: 'Більше = краще',
  LESS_IS_BETTER: 'Менше = краще',
};

const EMPTY_FORM = {
  name: '',
  description: '',
  valueType: 'NUMBER' as Metric['valueType'],
  unit: '',
  direction: 'MORE_IS_BETTER' as Metric['direction'],
  requiredForDepartments: [] as string[],
};

export default function MetricsManager() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Фільтри
  const [fStatus, setFStatus] = useState('ACTIVE');
  const [fType, setFType] = useState('');
  const [fDept, setFDept] = useState('');

  // Форма (створення / редагування)
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const deptName = useCallback(
    (id: string) => departments.find((d) => d.id === id)?.name ?? id,
    [departments]
  );

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (fStatus) params.set('status', fStatus);
      if (fType) params.set('valueType', fType);
      if (fDept) params.set('department', fDept);
      const res = await fetch(`/api/metrics?${params.toString()}`);
      if (!res.ok) throw new Error('Не вдалося завантажити метрики');
      setMetrics(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [fStatus, fType, fDept]);

  useEffect(() => {
    fetch('/api/departments')
      .then((r) => r.json())
      .then(setDepartments)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  function openCreate() {
    setEditId(null);
    setForm(EMPTY_FORM);
    setShowForm(true);
  }

  function openEdit(m: Metric) {
    setEditId(m.id);
    setForm({
      name: m.name,
      description: m.description ?? '',
      valueType: m.valueType,
      unit: m.unit ?? '',
      direction: m.direction,
      requiredForDepartments: m.requiredForDepartments,
    });
    setShowForm(true);
  }

  function toggleDept(id: string) {
    setForm((f) => ({
      ...f,
      requiredForDepartments: f.requiredForDepartments.includes(id)
        ? f.requiredForDepartments.filter((x) => x !== id)
        : [...f.requiredForDepartments, id],
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url = editId ? `/api/metrics/${editId}` : '/api/metrics';
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка збереження');
      setShowForm(false);
      await loadMetrics();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(m: Metric, status: 'ACTIVE' | 'ARCHIVED') {
    setError('');
    try {
      const res = await fetch(`/api/metrics/${m.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Помилка');
      }
      await loadMetrics();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Банк метрик</h2>
        <button
          onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2 rounded-lg transition"
        >
          + Метрика
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      {/* Фільтри */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
          <option value="ACTIVE">Активні</option>
          <option value="ARCHIVED">Архівні</option>
          <option value="">Усі</option>
        </select>
        <select value={fType} onChange={(e) => setFType(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
          <option value="">Усі типи</option>
          <option value="NUMBER">Число</option>
          <option value="PERCENT">Відсоток</option>
          <option value="RATING">Оцінка 1-5</option>
        </select>
        <select value={fDept} onChange={(e) => setFDept(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900">
          <option value="">Усі відділи</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </div>

      {/* Таблиця */}
      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : metrics.length === 0 ? (
        <p className="text-gray-500 text-sm">Метрик не знайдено.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-2 pr-4 font-medium">Назва</th>
                <th className="py-2 pr-4 font-medium">Тип</th>
                <th className="py-2 pr-4 font-medium">Од.</th>
                <th className="py-2 pr-4 font-medium">Напрямок</th>
                <th className="py-2 pr-4 font-medium">Обов&apos;язкова для</th>
                <th className="py-2 pr-4 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {metrics.map((m) => (
                <tr key={m.id} className={m.status === 'ARCHIVED' ? 'opacity-50' : ''}>
                  <td className="py-2 pr-4">
                    <span className="font-medium text-gray-900">{m.name}</span>
                    {m.description && <p className="text-xs text-gray-400">{m.description}</p>}
                  </td>
                  <td className="py-2 pr-4 text-gray-700">{VALUE_TYPE_LABELS[m.valueType]}</td>
                  <td className="py-2 pr-4 text-gray-700">{m.unit || '—'}</td>
                  <td className="py-2 pr-4 text-gray-700">{DIRECTION_LABELS[m.direction]}</td>
                  <td className="py-2 pr-4 text-gray-700">
                    {m.requiredForDepartments.length
                      ? m.requiredForDepartments.map(deptName).join(', ')
                      : '—'}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap text-right">
                    <button onClick={() => openEdit(m)} className="text-blue-600 hover:text-blue-800 mr-3">
                      Редагувати
                    </button>
                    {m.status === 'ACTIVE' ? (
                      <button onClick={() => setStatus(m, 'ARCHIVED')} className="text-gray-400 hover:text-red-600">
                        Архівувати
                      </button>
                    ) : (
                      <button onClick={() => setStatus(m, 'ACTIVE')} className="text-green-600 hover:text-green-800">
                        Відновити
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Форма */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {editId ? 'Редагувати метрику' : 'Нова метрика'}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Назва *</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                  placeholder="Напр. FTD, #"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Опис</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Тип значення *</label>
                  <select
                    value={form.valueType}
                    onChange={(e) => setForm({ ...form, valueType: e.target.value as Metric['valueType'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                  >
                    <option value="NUMBER">Число</option>
                    <option value="PERCENT">Відсоток</option>
                    <option value="RATING">Оцінка 1-5</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Одиниця</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="шт., $, %, x"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Напрямок *</label>
                <select
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value as Metric['direction'] })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900"
                >
                  <option value="MORE_IS_BETTER">Більше = краще</option>
                  <option value="LESS_IS_BETTER">Менше = краще</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Обов&apos;язкова для відділів</label>
                <div className="flex flex-wrap gap-2">
                  {departments.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      onClick={() => toggleDept(d.id)}
                      className={`px-2.5 py-1 rounded-full text-xs border transition ${
                        form.requiredForDepartments.includes(d.id)
                          ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
                      }`}
                    >
                      {d.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-600 hover:text-gray-900">
                  Скасувати
                </button>
                <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-lg transition">
                  {saving ? 'Збереження...' : 'Зберегти'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
