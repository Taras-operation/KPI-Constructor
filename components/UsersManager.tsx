// components/UsersManager.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { ROLE_LABELS, type Role } from '@/lib/roles';

interface User {
  id: string; name: string | null; email: string; role: Role; departmentId: string | null;
}
interface Department { id: string; name: string }

const ROLES: Role[] = ['MANAGER', 'TEAM_LEAD', 'OPERATIONS', 'LEADERSHIP'];

const EMPTY = { name: '', email: '', password: '', role: 'MANAGER' as Role, departmentId: '' };

export default function UsersManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        fetch('/api/users').then((r) => r.json()),
        fetch('/api/departments').then((r) => r.json()),
      ]);
      setUsers(u);
      setDepartments(d);
    } catch {
      setError('Не вдалося завантажити користувачів');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const deptName = (id: string | null) => (id ? departments.find((d) => d.id === id)?.name ?? '—' : '—');

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, departmentId: form.departmentId || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Помилка створення');
      setForm(EMPTY);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  const needsDept = form.role === 'TEAM_LEAD' || form.role === 'MANAGER';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Користувачі</h2>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 bg-gray-50 rounded-lg p-4">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="Ім'я" className={inp} />
        <input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required type="email" placeholder="Email" className={inp} />
        <input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required type="text" placeholder="Пароль (мін. 6)" className={inp} />
        <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} className={inp}>
          {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
        {needsDept && (
          <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className={inp}>
            <option value="">— відділ (необов&apos;язково) —</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        )}
        <div className="sm:col-span-2 flex justify-end">
          <button type="submit" disabled={saving} className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-medium px-4 py-2 rounded-lg transition">
            {saving ? 'Створення...' : '+ Створити користувача'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-gray-500 text-sm">Завантаження...</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-200">
              <th className="py-2 pr-4 font-medium">Ім&apos;я</th>
              <th className="py-2 pr-4 font-medium">Email</th>
              <th className="py-2 pr-4 font-medium">Роль</th>
              <th className="py-2 pr-4 font-medium">Відділ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="py-2 pr-4 text-gray-900">{u.name || '—'}</td>
                <td className="py-2 pr-4 text-gray-600">{u.email}</td>
                <td className="py-2 pr-4">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">{ROLE_LABELS[u.role]}</span>
                </td>
                <td className="py-2 pr-4 text-gray-600">{deptName(u.departmentId)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const inp = 'px-3 py-2 border border-gray-300 rounded-lg text-gray-900 outline-none focus:ring-2 focus:ring-blue-500';
