// app/layout.tsx

import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'KPI Constructor - CRM система управління KPI',
  description: 'Система для управління KPI команд маркетингового агентства',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="uk">
      <body>
        <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
          {children}
        </div>
      </body>
    </html>
  );
}
