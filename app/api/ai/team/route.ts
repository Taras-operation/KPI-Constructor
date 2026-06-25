// app/api/ai/team/route.ts
// O: розпізнавання списку команди з тексту файлу через AI. OPERATIONS і TEAM_LEAD.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { extractTeam, AINotConfiguredError } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS', 'TEAM_LEAD']);
  if ('error' in guard) return guard.error;

  try {
    const { text } = await request.json();
    if (!text || typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Немає тексту для розпізнавання' }, { status: 400 });
    }
    const team = await extractTeam(text);
    return NextResponse.json({ team });
  } catch (e: any) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error('AI team помилка:', e);
    return NextResponse.json({ error: 'Помилка розпізнавання команди' }, { status: 502 });
  }
}
