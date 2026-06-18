// app/api/auth/register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken } from '@/lib/auth';
import { SELF_REGISTER_ROLES } from '@/lib/roles';
import { parseBody, registerSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    const parsed = await parseBody(request, registerSchema);
    if ('error' in parsed) return parsed.error;
    const { email, password, name, role, departmentId } = parsed.data;

    // Q-04: самостійно можна зареєструватись лише в дозволених ролях (MANAGER).
    // Привілейовані ролі (OPERATIONS / LEADERSHIP / TEAM_LEAD) створює лише Operations.
    if (!SELF_REGISTER_ROLES.includes(role)) {
      return NextResponse.json(
        { error: 'Реєстрація доступна лише для ролі «Менеджер»' },
        { status: 403 }
      );
    }

    // Перевіряємо чи існує користувач
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Користувач вже існує' },
        { status: 400 }
      );
    }

    // Хешуємо пароль
    const passwordHash = await hashPassword(password);

    // Створюємо користувача
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role,
        departmentId: departmentId || null,
      },
    });

    // Генеруємо токен
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || undefined,
    });

    // Встановлюємо токен в cookies
    const response = NextResponse.json(
      {
        message: 'Користувач успішно зареєстрований',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 201 }
    );

    // Встановлюємо cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error('Помилка реєстрації:', error);
    return NextResponse.json(
      { error: 'Помилка при реєстрації' },
      { status: 500 }
    );
  }
}
