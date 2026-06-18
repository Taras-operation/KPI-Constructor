// app/api/auth/login/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyPassword, generateToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email и пароль обов\'язкові' },
        { status: 400 }
      );
    }

    // Шукаємо користувача
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    // Перевіряємо пароль
    const passwordValid = await verifyPassword(password, user.passwordHash);

    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Невірний email або пароль' },
        { status: 401 }
      );
    }

    // Генеруємо токен
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      departmentId: user.departmentId || undefined,
    });

    const response = NextResponse.json(
      {
        message: 'Успішна авторизація',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
      { status: 200 }
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
    console.error('Помилка логину:', error);
    return NextResponse.json(
      { error: 'Помилка при вході' },
      { status: 500 }
    );
  }
}
