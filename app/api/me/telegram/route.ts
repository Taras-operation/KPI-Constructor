// app/api/me/telegram/route.ts
// Прив'язка Telegram chat_id поточного користувача (Q-11).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/api-auth';

export async function GET() {
  const guard = await requireRole();
  if ('error' in guard) return guard.error;
  const user = await prisma.user.findUnique({ where: { id: guard.user.userId }, select: { telegramChatId: true } });
  return NextResponse.json({ chatId: user?.telegramChatId ?? null, enabled: !!process.env.TELEGRAM_BOT_TOKEN });
}

export async function POST(request: NextRequest) {
  const guard = await requireRole();
  if ('error' in guard) return guard.error;
  const { chatId } = await request.json().catch(() => ({ chatId: null }));
  const value = typeof chatId === 'string' && chatId.trim() ? chatId.trim() : null;
  await prisma.user.update({ where: { id: guard.user.userId }, data: { telegramChatId: value } });
  return NextResponse.json({ chatId: value });
}
