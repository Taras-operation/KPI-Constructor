// lib/api-auth.ts
// Хелпери авторизації для API-роутів (Node runtime).

import { NextResponse } from 'next/server';
import { getCurrentUser, type JWTPayload } from '@/lib/auth';

type Guard = { user: JWTPayload } | { error: NextResponse };

/**
 * Перевіряє, що користувач авторизований і (опційно) має одну з дозволених ролей.
 * Повертає { user } або { error } з готовою відповіддю 401/403.
 */
export async function requireRole(roles?: string[]): Promise<Guard> {
  const user = await getCurrentUser();

  if (!user) {
    return { error: NextResponse.json({ error: 'Не авторизовано' }, { status: 401 }) };
  }

  if (roles && roles.length > 0 && !roles.includes(user.role)) {
    return { error: NextResponse.json({ error: 'Доступ заборонений' }, { status: 403 }) };
  }

  return { user };
}
