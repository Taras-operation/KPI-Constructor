// components/TeamLeadWorkspace.tsx
'use client';

import { useState } from 'react';
import TeamLeadDashboard from './TeamLeadDashboard';
import TeamLeadConfigs from './TeamLeadConfigs';
import TeamLeadFront from './TeamLeadFront';

type Section = 'dashboard' | 'configs' | 'front';

const MENU: { key: Section; label: string; icon: string }[] = [
  { key: 'dashboard', label: 'Дашборд', icon: '▣' },
  { key: 'configs', label: 'Конфігурації', icon: '◆' },
  { key: 'front', label: 'FRONT', icon: '▦' },
];

export default function TeamLeadWorkspace() {
  const [section, setSection] = useState<Section>('dashboard');

  return (
    <div className="flex flex-col md:flex-row gap-6 items-start min-h-[calc(100vh-12rem)]">
      <aside className="md:w-60 shrink-0 w-full md:sticky md:top-24">
        <nav className="bg-white/10 border border-white/15 rounded-xl p-2 flex md:flex-col gap-1 overflow-x-auto">
          {MENU.map((m) => (
            <button
              key={m.key}
              onClick={() => setSection(m.key)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                section === m.key ? 'bg-white text-gray-900' : 'text-white/80 hover:bg-white/10'
              }`}
            >
              <span className="text-base leading-none">{m.icon}</span>
              {m.label}
            </button>
          ))}
        </nav>
      </aside>

      <div className="flex-1 min-w-0">
        {section === 'dashboard' && <TeamLeadDashboard />}
        {section === 'configs' && <TeamLeadConfigs />}
        {section === 'front' && <TeamLeadFront />}
      </div>
    </div>
  );
}
