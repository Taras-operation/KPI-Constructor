// lib/roles.ts
// Єдине джерело правди по ролях: назви, дашборди, навігація.

export type Role = 'OPERATIONS' | 'TEAM_LEAD' | 'MANAGER' | 'LEADERSHIP';

export const ROLE_LABELS: Record<Role, string> = {
  OPERATIONS: 'Operations',
  TEAM_LEAD: 'Тімлід',
  MANAGER: 'Менеджер',
  LEADERSHIP: 'Керівництво',
};

// Головна сторінка (дашборд) кожної ролі.
export const ROLE_HOME: Record<Role, string> = {
  OPERATIONS: '/operations',
  TEAM_LEAD: '/team-lead',
  MANAGER: '/manager',
  LEADERSHIP: '/leadership',
};

// Префікси роутів, доступні кожній ролі.
export const ROLE_ALLOWED_PREFIXES: Record<Role, string[]> = {
  OPERATIONS: ['/operations'],
  TEAM_LEAD: ['/team-lead'],
  MANAGER: ['/manager'],
  LEADERSHIP: ['/leadership'],
};

// Ролі, які користувач може обрати при самостійній реєстрації (Q-04).
export const SELF_REGISTER_ROLES: Role[] = ['MANAGER'];

export function isRole(value: unknown): value is Role {
  return value === 'OPERATIONS' || value === 'TEAM_LEAD' || value === 'MANAGER' || value === 'LEADERSHIP';
}

export function homeForRole(role: string): string {
  return isRole(role) ? ROLE_HOME[role] : '/';
}

export function canAccess(role: string, pathname: string): boolean {
  if (!isRole(role)) return false;
  return ROLE_ALLOWED_PREFIXES[role].some((prefix) => pathname.startsWith(prefix));
}
