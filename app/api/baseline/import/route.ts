// app/api/baseline/import/route.ts
// Імпорт даних з опублікованої Google-таблиці (як CSV). Тільки OPERATIONS.
// Сервер тягне CSV, щоб обійти CORS; дозволено лише docs.google.com (захист від SSRF).

import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/api-auth';

function toCsvExportUrl(input: string): string | null {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com') return null;

  const idMatch = url.pathname.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const id = idMatch[1];

  // gid з хеша (#gid=) або query (?gid=)
  const gid = url.hash.match(/gid=(\d+)/)?.[1] ?? url.searchParams.get('gid') ?? '0';
  return `https://docs.google.com/spreadsheets/d/${id}/export?format=csv&gid=${gid}`;
}

export async function POST(request: NextRequest) {
  const guard = await requireRole(['OPERATIONS']);
  if ('error' in guard) return guard.error;

  const { url } = await request.json().catch(() => ({ url: '' }));
  const exportUrl = toCsvExportUrl(typeof url === 'string' ? url : '');
  if (!exportUrl) {
    return NextResponse.json({ error: 'Очікується посилання на Google-таблицю (docs.google.com)' }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(exportUrl, { signal: controller.signal, redirect: 'follow' });
    clearTimeout(timeout);

    const contentType = res.headers.get('content-type') ?? '';
    if (!res.ok || contentType.includes('text/html')) {
      return NextResponse.json(
        { error: 'Таблиця недоступна. Відкрийте доступ «за посиланням» або опублікуйте аркуш у CSV.' },
        { status: 400 }
      );
    }

    const text = await res.text();
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: 'Не вдалося завантажити таблицю' }, { status: 502 });
  }
}
