// lib/env.ts
// Централізований доступ до змінних оточення з перевіркою на проді.

function readSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;

  if (process.env.NODE_ENV === 'production') {
    // На проді відсутній секрет — критична помилка, не запускаємось мовчки.
    throw new Error(`Відсутня обов'язкова змінна оточення ${name}`);
  }

  console.warn(`[env] ${name} не заданий — використовується небезпечний dev-дефолт. Задайте ${name} у .env.`);
  return devFallback;
}

export const JWT_SECRET = readSecret('JWT_SECRET', 'dev-only-insecure-secret');
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
