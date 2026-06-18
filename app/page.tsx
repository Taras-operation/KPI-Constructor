// app/page.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Помилка при вході');
        return;
      }

      // Перенаправляємо на дашборд відповідно до ролі
      const role = data.user.role.toLowerCase();
      if (role === 'operations') {
        router.push('/operations');
      } else if (role === 'team_lead') {
        router.push('/team-lead');
      } else if (role === 'manager') {
        router.push('/manager');
      } else if (role === 'leadership') {
        router.push('/leadership');
      }
    } catch (err) {
      setError('Помилка при підключенні до сервера');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <h1 className="text-3xl font-bold text-center mb-2 text-gray-900">
            KPI Constructor
          </h1>
          <p className="text-center text-gray-600 mb-8">
            CRM система управління KPI
          </p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="example@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Пароль
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-2 px-4 rounded-lg transition duration-200"
            >
              {loading ? 'Вход...' : 'Войти'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-600">
            Немає аккаунту?{' '}
            <Link href="/register" className="text-blue-600 hover:text-blue-700 font-medium">
              Реєстрація
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center mb-3">Тестові облікові записи:</p>
            <div className="space-y-2 text-xs text-gray-600">
              <p><strong>Operations:</strong> ops@test.com / password</p>
              <p><strong>Team Lead:</strong> lead@test.com / password</p>
              <p><strong>Manager:</strong> manager@test.com / password</p>
              <p><strong>Leadership:</strong> leader@test.com / password</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
