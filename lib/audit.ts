// lib/audit.ts
// Запис у AuditLog (ТЗ розд. 7). Best-effort: помилка аудиту не ламає основну дію.

import { prisma } from '@/lib/prisma';

type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'APPROVE' | 'STATUS';

interface AuditInput {
  userId?: string | null;
  action: AuditAction;
  tableName: string;
  recordId: string;
  oldValues?: unknown;
  newValues?: unknown;
}

export async function logAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        tableName: input.tableName,
        recordId: input.recordId,
        oldValues: (input.oldValues ?? undefined) as any,
        newValues: (input.newValues ?? undefined) as any,
      },
    });
  } catch (e) {
    console.error('[audit] не вдалося записати лог:', e);
  }
}
