// components/DepartmentsManager.tsx
'use client';

import { useEffect, useState } from 'react';

interface Department {
  id: string;
  name: string;
  description: string | null;
  _count?: { users: number; configurations: number };
}

export default function DepartmentsManager() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/departments');
      if (!res.ok) throw new Error('Не вдалося завантажити відділи');
      setDepartments(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка створення');
      setName('');
      setDescription('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Видалити відділ?')) return;
    setError('');
    try {
      const res = await fetch(`/api/departments/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка видалення');
      await load();
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Відділи</h2>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-2 mb-6">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Назва відділу"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Опис (необов'язково)"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-gray-900"
        />
        <button
          type="submit"
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-lg transition"
        >
          {saving ? 'Додаю...' : 'Додати'}
        </button>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : departments.length === 0 ? (
        <p className="text-gray-500 text-sm">Відділів ще немає.</p>
      ) : (
        <div className="divide-y divide-gray-100">
          {departments.map((d) => (
            <div key={d.id} className="py-3 flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{d.name}</p>
                {d.description && <p className="text-sm text-gray-500">{d.description}</p>}
                <p className="text-xs text-gray-400 mt-0.5">
                  Користувачів: {d._count?.users ?? 0} · Конфігурацій: {d._count?.configurations ?? 0}
                </p>
              </div>
              <button
                onClick={() => handleDelete(d.id)}
                className="text-sm text-gray-400 hover:text-red-600 transition"
              >
                Видалити
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
