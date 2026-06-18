// middleware.ts
// Захист роутів: перевірка JWT + рольовий доступ до дашбордів.

import { NextRequest, NextResponse } from 'next/server';
import { verifyTokenEdge } from '@/lib/jwt-edge';
import { canAccess, homeForRole } from '@/lib/roles';

const PROTECTED_PREFIXES = ['/operations', '/team-lead', '/manager', '/leadership'];
const AUTH_PAGES = ['/', '/register'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('auth-token')?.value;
  const payload = token ? await verifyTokenEdge(token) : null;

  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PAGES.includes(pathname);

  // Неавторизований на захищеному роуті -> на логін.
  if (isProtected && !payload) {
    const url = new URL('/', request.url);
    return NextResponse.redirect(url);
  }

  // Авторизований на захищеному роуті чужої ролі -> на свій дашборд.
  if (isProtected && payload && !canAccess(payload.role, pathname)) {
    return NextResponse.redirect(new URL(homeForRole(payload.role), request.url));
  }

  // Авторизований на сторінці логіну/реєстрації -> на свій дашборд.
  if (isAuthPage && payload) {
    return NextResponse.redirect(new URL(homeForRole(payload.role), request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/register', '/operations/:path*', '/team-lead/:path*', '/manager/:path*', '/leadership/:path*'],
};
