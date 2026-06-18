// lib/jwt-edge.ts
// Перевірка JWT, сумісна з Edge-runtime (middleware). jsonwebtoken тут не працює,
// тому використовуємо jose. Токени підписуються в lib/auth.ts алгоритмом HS256.

import { jwtVerify } from 'jose';
import type { JWTPayload } from './auth';
import { JWT_SECRET } from './env';

const secret = new TextEncoder().encode(JWT_SECRET);

export async function verifyTokenEdge(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JWTPayload;
  } catch {
    return null;
  }
}
