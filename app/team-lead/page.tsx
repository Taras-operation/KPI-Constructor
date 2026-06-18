// app/team-lead/page.tsx
import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import DashboardShell from '@/components/DashboardShell';
import TeamLeadConfigs from '@/components/TeamLeadConfigs';

export default async function TeamLeadPage() {
  const user = await getSessionUser();
  if (!user || user.role !== 'TEAM_LEAD') redirect('/');

  return (
    <DashboardShell role="TEAM_LEAD" email={user.email} name={user.name}>
      <h1 className="text-2xl font-bold text-white mb-6">Робоче місце тімліда</h1>

      <div className="space-y-6">
        <TeamLeadConfigs />

        <div className="bg-white/10 border border-white/15 rounded-lg p-6 text-white/70 text-sm">
          Далі тут з&apos;явиться FRONT з результатами команди, внесення факту
          та збереження місяця в HISTORY.
        </div>
      </div>
    </DashboardShell>
  );
}
