// lib/session.ts
// Серверний хелпер: повертає поточного користувача з БД (для server components).

import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export async function getSessionUser() {
  const payload = await getCurrentUser();
  if (!payload) return null;

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, name: true, role: true, departmentId: true },
  });

  return user;
}
