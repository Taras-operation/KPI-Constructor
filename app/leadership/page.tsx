// app/leadership/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';
import LeadershipDashboard from '@/components/LeadershipDashboard';

export default async function LeadershipPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'LEADERSHIP') redirect('/');

  return (
    <DashboardShell role="LEADERSHIP" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Зведений дашборд</h1>
      <LeadershipDashboard />
    </DashboardShell>
  );
}
