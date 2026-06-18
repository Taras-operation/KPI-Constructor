// app/api/auth/logout/route.ts

import { NextResponse } from 'next/server';

export async function POST() {
  const response = NextResponse.json({ message: 'Вихід виконано' });
  response.cookies.delete('auth-token');
  return response;
}
