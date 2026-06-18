// app/api/auth/register/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hashPassword, generateToken, setAuthCookie } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, role, departmentId } = await request.json();

    if (!email || !password || !name || !role) {
      return NextResponse.json(
        { error: 'Всі поля обов\'язкові' },
        { status: 400 }
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
