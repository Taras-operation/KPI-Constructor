// app/api/notifications/route.ts
// Нотифікації всередині застосунку (Phase 2): нагадування і алерти за роллю.
// Обчислюються динамічно, без окремої таблиці.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

interface Note { level: 'info' | 'warn'; text: string; link: string }

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export async function GET() {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD', 'MANAGER', 'LEADERSHIP']);
  if ('error' in guard) return guard.error;

  const { role, userId } = guard.user;
  const period = currentPeriod();
  const notes: Note[] = [];

  if (role === 'TEAM_LEAD' || role === 'OPERATIONS') {
    // Активні конфігурації (тімлід — свої; Operations — усі) + дані для перевірки повноти.
    const configs = await prisma.kPIConfiguration.findMany({
      where: { status: 'ACTIVE', ...(role === 'TEAM_LEAD' ? { teamLeadId: userId } : {}) },
      include: {
        department: { select: { name: true } },
        _count: { select: { managers: true, metrics: true } },
        currentData: { select: { factValue: true } },
        history: { where: { period }, select: { id: true }, take: 1 },
      },
    });

    for (const c of configs) {
      const link = role === 'TEAM_LEAD' ? '/team-lead' : '/operations';
      const expected = c._count.managers * c._count.metrics;
      const filled = c.currentData.filter((d) => d.factValue !== null).length;
      const missing = expected - filled;
      const savedThisPeriod = c.history.length > 0;

      if (c.period <= period && !savedThisPeriod && missing > 0) {
        notes.push({
          level: 'warn',
          text: `${c.department.name}: не внесено факт по ${missing} показниках (період ${period})`,
          link,
        });
      }
      if (c.period <= period && !savedThisPeriod && missing === 0) {
        notes.push({
          level: 'info',
          text: `${c.department.name}: усі дані внесені — час зберегти місяць`,
          link,
        });
      }
    }
  }

  if (role === 'TEAM_LEAD') {
    const toApprove = await prisma.kPIConfiguration.count({ where: { status: 'ON_APPROVAL', teamLeadId: userId } });
    if (toApprove > 0) notes.push({ level: 'warn', text: `${toApprove} конфігурацій очікують вашого погодження`, link: '/team-lead' });
  }

  if (role === 'OPERATIONS') {
    const ready = await prisma.kPIConfiguration.count({ where: { status: 'ON_APPROVAL', approvedAt: { not: null } } });
    if (ready > 0) notes.push({ level: 'info', text: `${ready} конфігурацій погоджено — готові до активації`, link: '/operations' });

    const correction = await prisma.kPIConfiguration.count({ where: { status: 'ON_CORRECTION' } });
    if (correction > 0) notes.push({ level: 'warn', text: `${correction} конфігурацій повернено на коригування`, link: '/operations' });
  }

  if (role === 'MANAGER') {
    const myManagers = await prisma.teamManager.findMany({
      where: { userId, configuration: { status: 'ACTIVE', allowManagerInput: true } },
      select: { id: true, configurationId: true, configuration: { select: { period: true, department: { select: { name: true } } } } },
    });
    for (const tm of myManagers) {
      const saved = await prisma.historyRecord.count({ where: { configurationId: tm.configurationId, period: tm.configuration.period } });
      if (saved > 0) continue;
      const total = await prisma.currentData.count({ where: { configurationId: tm.configurationId, managerId: tm.id } });
      const filled = await prisma.currentData.count({ where: { configurationId: tm.configurationId, managerId: tm.id, factValue: { not: null } } });
      if (filled < total || total === 0) {
        notes.push({ level: 'info', text: `${tm.configuration.department.name}: внесіть свій факт за період`, link: '/manager' });
      }
    }
  }

  return NextResponse.json(notes);
}
