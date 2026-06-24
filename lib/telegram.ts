// lib/telegram.ts
// Telegram-нотифікації (Q-11). Best-effort: без токена або chat_id — тихо пропускаємо.

import { prisma } from '@/lib/prisma';

async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token || !chatId) return;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
  } catch (e) {
    console.error('[telegram] send failed:', e);
  }
}

/** Нотифікація конкретному користувачу (по його telegramChatId). */
export async function notifyUser(userId: string, text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
  if (user?.telegramChatId) await sendTelegram(user.telegramChatId, text);
}

/** Нотифікація всім Operations з прив'язаним Telegram. */
export async function notifyOperations(text: string): Promise<void> {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const ops = await prisma.user.findMany({
    where: { role: 'OPERATIONS', telegramChatId: { not: null } },
    select: { telegramChatId: true },
  });
  await Promise.all(ops.map((o) => sendTelegram(o.telegramChatId as string, text)));
}
