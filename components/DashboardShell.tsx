// components/DashboardShell.tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { ROLE_LABELS, type Role } from '@/lib/roles';
import NotificationsBell from '@/components/NotificationsBell';
import TelegramSettings from '@/components/TelegramSettings';

interface Props {
  role: Role;
  email: string;
  name?: string | null;
  children: React.ReactNode;
}

export default function DashboardShell({ role, email, name, children }: Props) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/');
      router.refresh();
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-gray-900">KPI Constructor</span>
            <span className="text-xs font-medium px-2 py-1 rounded-full bg-blue-100 text-blue-700">
              {ROLE_LABELS[role]}
            </span>
          </div>
          <div className="flex items-center gap-4">
            <TelegramSettings />
            <NotificationsBell />
            <span className="text-sm text-gray-600">{name || email}</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="text-sm font-medium text-gray-500 hover:text-red-600 transition disabled:opacity-50"
            >
              {loggingOut ? 'Вихід...' : 'Вийти'}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
