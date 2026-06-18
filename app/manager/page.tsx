// app/manager/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';

export default async function ManagerPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'MANAGER') redirect('/');

  return (
    <DashboardShell role="MANAGER" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Мій KPI</h1>
      <div className="bg-white/10 border border-white/15 rounded-lg p-6 text-white/70 text-sm">
        Тут з&apos;явиться ваш KPI-дашборд: метрики, план, факт, % виконання та сума бонусу.
      </div>
    </DashboardShell>
  );
}
