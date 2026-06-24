// app/api/ai/baseline/route.ts
// AI-рекомендації за результатами Baseline (D5, точка 1). Тільки OPERATIONS.

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';
import { analyzeBaseline, AINotConfiguredError } from '@/lib/ai';

export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  try {
    const { metrics } = await request.json();
    if (!metrics) {
      return NextResponse.json({ error: 'Немає даних для аналізу' }, { status: 400 });
    }
    const text = await analyzeBaseline(metrics);
    return NextResponse.json({ text });
  } catch (e: any) {
    if (e instanceof AINotConfiguredError) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    console.error('AI baseline помилка:', e);
    return NextResponse.json({ error: 'Помилка AI-аналізу' }, { status: 502 });
  }
}
