// app/manager/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';
import ManagerDashboard from '@/components/ManagerDashboard';

export default async function ManagerPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'MANAGER') redirect('/');

  return (
    <DashboardShell role="MANAGER" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Мій KPI</h1>
      <ManagerDashboard />
    </DashboardShell>
  );
}
