# Деплой на Vercel + облачний Postgres

Покрокова інструкція, щоб колеги могли тестувати застосунок за публічним посиланням.

## 1. Облачна база даних (Neon — безкоштовно)

1. Зареєструйся на https://neon.tech (через GitHub/Google).
2. Create Project → регіон ближче до вас (EU) → отримаєш **Connection string** виду:
   ```
   postgresql://USER:PASSWORD@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
3. Збережи цей рядок — це твій `DATABASE_URL`.

> Альтернативи: Vercel Postgres (вкладка Storage у Vercel), Supabase. Будь-який PostgreSQL підійде.

## 2. Залити код на GitHub

```bash
cd ~/Desktop/kpi-constructor
# Створи порожній репозиторій на github.com (без README), потім:
git remote add origin https://github.com/<твій-логін>/kpi-constructor.git
git push -u origin main
```

## 3. Імпорт у Vercel

1. https://vercel.com → Add New → Project → Import свій GitHub-репозиторій.
2. Framework Preset визначиться як **Next.js** автоматично. Build не змінюй.
3. **Environment Variables** — додай (Production + Preview):

   | Name | Value |
   |------|-------|
   | `DATABASE_URL` | рядок з Neon (п.1) |
   | `JWT_SECRET` | будь-який довгий випадковий рядок (32+ символів) |
   | `JWT_EXPIRES_IN` | `7d` |
   | `NEXT_PUBLIC_APP_URL` | URL твого деплою (можна додати після першого деплою) |

   > `NODE_ENV=production` Vercel виставляє сам. Не задавай вручну.

4. **Deploy**. На білді автоматично виконаються `prisma generate` + `prisma migrate deploy` (створять таблиці в Neon) + `next build`.

## 4. Наповнити базу тестовими даними (seed)

Один раз, локально, але вказавши **облачний** DATABASE_URL:

```bash
cd ~/Desktop/kpi-constructor
DATABASE_URL="<рядок з Neon>" npm run seed
```

Створить 4 тестових користувачів (пароль `password`), відділи і банк метрик.

## 5. Готово

- Публічне посилання: `https://<проект>.vercel.app`
- Тестові акаунти: `ops@test.com`, `lead@test.com`, `manager@test.com`, `leader@test.com` — пароль `password`.
- Привілейованих користувачів далі створює Operations у розділі «Користувачі».

## Оновлення

Кожен `git push` у `main` → Vercel автоматично передеплоїть. Міграції (`prisma migrate deploy`) застосуються на білді.

## Примітки

- Зміни схеми: локально `npm run prisma:migrate` (створює міграцію) → коміт → push (на проді застосується автоматично).
- Логи й помилки — у Vercel → Deployments → Functions/Logs.
