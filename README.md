# 🚀 KPI Constructor - CRM система управління KPI

Система для управління KPI команд маркетингового агентства. Дозволяє Operations-команді будувати стандартизовані системи оцінки KPI для команд, аналізувати ретроспективні дані і виставляти обґрунтовані бенчмарки.

## 📋 Технічний стек

- **Frontend:** Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend:** Next.js API Routes, Node.js
- **База данных:** PostgreSQL + Prisma ORM
- **Хостинг:** Vercel + Vercel Postgres
- **Авторизація:** JWT + NextAuth
- **Стилизація:** Tailwind CSS

## 🛠️ Встановлення і запуск локально

### 1. Клонування та встановлення залежностей

```bash
cd kpi-constructor
npm install
```

### 2. Налаштування базі даних

#### Варіант A: Локальний PostgreSQL

```bash
# Встановіть PostgreSQL локально, якщо не встановлений

# Скопіюйте .env.example в .env
cp .env.example .env

# Оновіть DATABASE_URL в .env
DATABASE_URL="postgresql://user:password@localhost:5432/kpi_constructor"

# Запустіть міграції Prisma
npm run prisma:migrate

# Згенеруйте Prisma client
npm run prisma:generate
```

#### Варіант B: Vercel Postgres (Рекомендовано для production)

```bash
# Залиште DATABASE_URL як в .env.example з Vercel Postgres URL
# Інструкція на https://vercel.com/docs/postgres

npm run prisma:migrate
npm run prisma:generate
```

### 3. Запуск розвивального сервера

```bash
npm run dev
```

Додаток буде доступне на `http://localhost:3000`

## 🔐 Авторизація

### Тестові облікові записи

| Роль | Email | Пароль |
|------|-------|--------|
| Operations | ops@test.com | password |
| Team Lead | lead@test.com | password |
| Manager | manager@test.com | password |
| Leadership | leader@test.com | password |

Для створення тестових користувачів запустіть:

```bash
npm run seed
# (буде створено після реалізації seed скрипту)
```

## 📚 API Документація

### Аутентифікація

#### POST `/api/auth/register`
Реєстрація нового користувача

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe",
    "role": "MANAGER"
  }'
```

**Відповідь:**
```json
{
  "message": "Користувач успішно зареєстрований",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "role": "MANAGER"
  }
}
```

#### POST `/api/auth/login`
Вхід в систему

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123"
  }'
```

### Метрики (тільки для Operations)

#### GET `/api/metrics`
Отримати всі метрики

```bash
curl http://localhost:3000/api/metrics
```

#### GET `/api/metrics?status=ACTIVE`
Отримати активні метрики

#### POST `/api/metrics`
Створити нову метрику

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "FTD, #",
    "description": "Кількість FTD (First Time Depositors)",
    "valueType": "NUMBER",
    "unit": "шт.",
    "direction": "MORE_IS_BETTER",
    "requiredForDepartments": ["marketing"]
  }'
```

#### PUT `/api/metrics/[id]`
Оновити метрику

```bash
curl -X PUT http://localhost:3000/api/metrics/uuid \
  -H "Content-Type: application/json" \
  -d '{
    "status": "ARCHIVED"
  }'
```

#### DELETE `/api/metrics/[id]`
Видалити метрику

```bash
curl -X DELETE http://localhost:3000/api/metrics/uuid
```

## 📂 Структура проекту

```
kpi-constructor/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   └── register/route.ts
│   │   ├── metrics/
│   │   │   ├── route.ts (GET, POST)
│   │   │   └── [id]/route.ts (GET, PUT, DELETE)
│   │   └── ... (інші API routes)
│   ├── operations/
│   │   └── page.tsx (CRM для Operations)
│   ├── manager/
│   │   └── page.tsx (Дашборд менеджера)
│   ├── team-lead/
│   │   └── page.tsx (Погодження конфігів)
│   ├── leadership/
│   │   └── page.tsx (Зведений дашборд)
│   ├── layout.tsx
│   ├── page.tsx (Login page)
│   ├── register/
│   │   └── page.tsx
│   └── globals.css
├── lib/
│   ├── prisma.ts (Prisma client)
│   ├── auth.ts (JWT, password hashing)
│   └── kpi-calculations.ts (KPI & bonus calculations)
├── prisma/
│   └── schema.prisma (Database schema)
├── components/
│   ├── ... (React компоненти)
├── public/
│   └── ... (Статичні файли)
├── .env.example
├── .gitignore
├── next.config.js
├── package.json
├── postcss.config.js
├── tailwind.config.ts
└── tsconfig.json
```

## 🔧 Ключові утилити

### `lib/kpi-calculations.ts`
Розрахунки KPI і бонусів:
- `calculateMetricPercentage()` - % виконання по метриці
- `calculateManagerKPI()` - зважений % KPI менеджера
- `calculateBonus()` - сума бонусу (3 моделі)
- `validateWeights()` - перевірка суми ваг

### `lib/auth.ts`
Аутентифікація:
- `hashPassword()` - хеширование паролю
- `verifyPassword()` - перевірка пароля
- `generateToken()` - створення JWT
- `verifyToken()` - перевірка JWT
- `getCurrentUser()` - отримання поточного користувача

## 📊 Схема БД

### Основні таблиці

- **User** - користувачі системи (Operations, Team Lead, Manager, Leadership)
- **Metric** - глобальний банк метрик
- **KPIConfiguration** - конфігурація KPI для команди
- **ConfigurationMetric** - метрики в конфігурації (з вагами)
- **TeamManager** - менеджери в команді
- **CurrentData** - фактичні дані поточного місяця
- **HistoryRecord** - архів закритих місяців
- **HistoryMetric** - деталі результатів по метриці
- **AuditLog** - логування всіх змін

## 🚀 Деплоймент на Vercel

```bash
# Спочатку закоміттьте код в Git
git add .
git commit -m "Initial commit"

# Залиште на GitHub
git push origin main

# В Vercel dashboard:
# 1. Import Project -> виберіть GitHub repo
# 2. Налаштуйте environment variables (.env)
# 3. Натисніть Deploy

# Альтернативно, через Vercel CLI:
npm install -g vercel
vercel
```

## 📝 Роздоумення по фазам розробки

### Phase 1 (MVP) - поточна фаза
- [x] Базова архітектура (Next.js + PostgreSQL + Prisma)
- [x] Авторизація (JWT)
- [x] Банк метрик (CRUD)
- [x] Розрахунок KPI і бонусів
- [ ] CRM для Operations (конструктор конфігурацій)
- [ ] Флоу погодження з тімлідом
- [ ] Дашборд менеджера
- [ ] Дашборд керівництва
- [ ] Тестування на пілотній команді

### Phase 2
- Інтеграція Baseline Analyzer
- Автоматичні бенчмарки з HISTORY
- Розширена аналітика
- API інтеграції з CRM
- Нотифікації

## 🤝 Контрибьютинг

Цей проект є внутрішнім інструментом. Для змін зв'яжіться з Operations-командою.

## 📞 Контакти

За запитаннями звертайтесь до Operations-команди.

---

**Версія:** 1.0.0 (MVP)
**Остання оновлення:** 2024
