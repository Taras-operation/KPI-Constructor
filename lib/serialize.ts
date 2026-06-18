// lib/serialize.ts
// Конвертація Prisma Decimal у number на межі API.
// Prisma серіалізує Decimal у рядок, а розрахунки (lib/kpi-calculations.ts) очікують number.

import { Decimal } from '@prisma/client/runtime/library';

function isDecimal(value: unknown): value is Decimal {
  return value instanceof Decimal;
}

/**
 * Рекурсивно перетворює всі Decimal у number у довільній структурі
 * (об'єкт, масив, вкладені). Дати і примітиви лишаються без змін.
 */
export function serialize<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (isDecimal(value)) return value.toNumber() as unknown as T;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map((v) => serialize(v)) as unknown as T;
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out as T;
  }
  return value;
}
