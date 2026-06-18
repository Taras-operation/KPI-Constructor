// app/operations/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';
import OperationsWorkspace from '@/components/OperationsWorkspace';

export default async function OperationsPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'OPERATIONS') redirect('/');

  return (
    <DashboardShell role="OPERATIONS" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Робоче місце Operations</h1>
      <OperationsWorkspace />
    </DashboardShell>
  );
}
