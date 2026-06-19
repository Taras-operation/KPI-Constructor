// components/NotificationsBell.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Note { level: 'info' | 'warn'; text: string; link: string }

export default function NotificationsBell() {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>([]);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/notifications').then((r) => r.json()).then((d) => Array.isArray(d) && setNotes(d)).catch(() => {});
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const warnCount = notes.filter((n) => n.level === 'warn').length;

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative text-gray-500 hover:text-gray-800 transition p-1" title="Сповіщення">
        <span className="text-xl leading-none">🔔</span>
        {notes.length > 0 && (
          <span className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${warnCount > 0 ? 'bg-red-500' : 'bg-blue-500'}`}>
            {notes.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl border border-gray-200 z-50 overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-100 text-sm font-medium text-gray-700">Сповіщення</div>
          {notes.length === 0 ? (
            <p className="px-4 py-4 text-sm text-gray-400">Немає нових сповіщень.</p>
          ) : (
            <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
              {notes.map((n, i) => (
                <button
                  key={i}
                  onClick={() => { setOpen(false); router.push(n.link); }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 transition flex gap-2"
                >
                  <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${n.level === 'warn' ? 'bg-red-500' : 'bg-blue-500'}`} />
                  <span className="text-sm text-gray-700">{n.text}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
