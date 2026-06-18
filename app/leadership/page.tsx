// app/leadership/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';

export default async function LeadershipPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'LEADERSHIP') redirect('/');

  return (
    <DashboardShell role="LEADERSHIP" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Зведений дашборд</h1>
      <div className="bg-white/10 border border-white/15 rounded-lg p-6 text-white/70 text-sm">
        Тут з&apos;явиться зведена таблиця по відділах: % KPI, сума бонусів,
        кількість менеджерів, фільтр по місяцю/кварталу.
      </div>
    </DashboardShell>
  );
}
