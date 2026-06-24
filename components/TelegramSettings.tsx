// components/TelegramSettings.tsx
'use client';

import { useEffect, useState } from 'react';

export default function TelegramSettings() {
  const [enabled, setEnabled] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/me/telegram')
      .then((r) => r.json())
      .then((d) => { setEnabled(!!d.enabled); setChatId(d.chatId ?? null); })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function edit() {
    const current = chatId ?? '';
    const value = window.prompt('Telegram chat ID (дізнатись у @userinfobot). Порожнє — вимкнути:', current);
    if (value === null) return;
    const res = await fetch('/api/me/telegram', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chatId: value }),
    });
    const d = await res.json();
    setChatId(d.chatId ?? null);
  }

  // Показуємо лише якщо бот налаштований на сервері
  if (!loaded || !enabled) return null;

  return (
    <button onClick={edit} title="Telegram-нотифікації" className="text-sm text-gray-500 hover:text-blue-600 transition">
      Telegram {chatId ? '✓' : '—'}
    </button>
  );
}
