// app/operations/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';
import DepartmentsManager from '@/components/DepartmentsManager';

export default async function OperationsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'OPERATIONS') redirect('/');

  return (
    <DashboardShell role="OPERATIONS" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Робоче місце Operations</h1>

      <div className="space-y-6">
        <DepartmentsManager />

        <div className="bg-white/10 border border-white/15 rounded-lg p-6 text-white/70 text-sm">
          Далі тут з&apos;являться: банк метрик, конструктор KPI-конфігурацій,
          відправка на погодження та зведений контроль.
        </div>
      </div>
    </DashboardShell>
  );
}
