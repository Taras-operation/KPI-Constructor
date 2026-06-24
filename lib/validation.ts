// lib/validation.ts
// Zod-схеми тіл запитів + хелпер парсингу з єдиним форматом помилки 400.

import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';

type ParseResult<T> = { data: T } | { error: NextResponse };

/** Безпечно парсить JSON-тіло за схемою. Повертає { data } або { error } (400). */
export async function parseBody<T>(request: NextRequest, schema: z.ZodSchema<T>): Promise<ParseResult<T>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return { error: NextResponse.json({ error: 'Невірний JSON у тілі запиту' }, { status: 400 }) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    const path = first.path.join('.');
    return {
      error: NextResponse.json(
        { error: `Помилка валідації${path ? ` (${path})` : ''}: ${first.message}` },
        { status: 400 }
      ),
    };
  }
  return { data: result.data };
}

// ---- Спільні ----
const role = z.enum(['OPERATIONS', 'TEAM_LEAD', 'MANAGER', 'LEADERSHIP']);
const grade = z.enum(['JUNIOR', 'MIDDLE', 'SENIOR']);
const bonusModel = z.enum(['LINEAR', 'THRESHOLD', 'MATRIX']);
const periodicity = z.enum(['MONTHLY', 'QUARTERLY', 'SEMIANNUAL']);

// ---- Auth ----
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'мінімум 6 символів'),
  name: z.string().min(1),
  role,
  departmentId: z.string().nullish(),
});

// ---- Users ----
export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'мінімум 6 символів'),
  name: z.string().min(1),
  role,
  departmentId: z.string().nullish(),
});

// ---- Departments ----
export const departmentCreateSchema = z.object({
  name: z.string().min(1, 'назва обов\'язкова'),
  description: z.string().nullish(),
});
export const departmentUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
});

// ---- Metrics ----
const valueType = z.enum(['NUMBER', 'PERCENT', 'RATING']);
const direction = z.enum(['MORE_IS_BETTER', 'LESS_IS_BETTER']);
export const metricCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullish(),
  valueType,
  unit: z.string().nullish(),
  direction,
  requiredForDepartments: z.array(z.string()).optional(),
});
export const metricUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullish(),
  valueType: valueType.optional(),
  unit: z.string().nullish(),
  direction: direction.optional(),
  requiredForDepartments: z.array(z.string()).optional(),
  status: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
});

// ---- Configurations ----
const configMetric = z.object({ metricId: z.string().min(1), weight: z.coerce.number().min(0) });
const configManager = z.object({
  name: z.string().min(1),
  grade,
  baseBonus: z.coerce.number().min(0),
  userId: z.string().nullish(),
});
const bonusParameters = z.object({
  baseBonus: z.number().optional(), // D4: базовий бонус тепер на рівні менеджера
  currency: z.string().optional(),
  threshold: z.number().optional(),
  maxCoefficient: z.number().optional(),
});
const plans = z.record(z.string(), z.record(z.string(), z.union([z.number(), z.string(), z.null()]))).optional();
const requiredOverrides = z.array(z.object({
  metricId: z.string().min(1),
  name: z.string().optional(),
  reason: z.string().min(1, 'потрібне обґрунтування'),
})).optional();

export const configurationCreateSchema = z.object({
  departmentId: z.string().min(1),
  teamLeadId: z.string().min(1),
  period: z.string().regex(/^\d{6}$/, 'формат YYYYMM'),
  periodicity: periodicity.optional(),
  bonusModel,
  bonusParameters,
  allowManagerInput: z.boolean().optional(),
  metrics: z.array(configMetric),
  managers: z.array(configManager),
  plans,
  requiredOverrides,
});

export const configurationUpdateSchema = z.object({
  departmentId: z.string().optional(),
  teamLeadId: z.string().optional(),
  period: z.string().regex(/^\d{6}$/).optional(),
  periodicity: periodicity.optional(),
  bonusModel: bonusModel.optional(),
  bonusParameters: bonusParameters.optional(),
  allowManagerInput: z.boolean().optional(),
  metrics: z.array(configMetric),
  managers: z.array(configManager),
  plans,
  requiredOverrides,
});

// ---- DATA / status ----
export const dataSchema = z.object({
  entries: z.array(
    z.object({
      managerId: z.string().min(1),
      metricId: z.string().min(1),
      factValue: z.union([z.number(), z.string(), z.null()]),
    })
  ),
});

export const statusSchema = z.object({
  action: z.enum(['SEND_FOR_APPROVAL', 'ACTIVATE', 'ARCHIVE', 'APPROVE', 'REQUEST_CORRECTION']),
  comment: z.string().optional(),
});

export const historySaveSchema = z.object({
  comments: z.record(z.string(), z.string()).optional(),
});
