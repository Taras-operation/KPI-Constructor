# ✅ KPI Constructor - Проект инициализирован!

## 📦 Что мы создали

Полный стартер **Next.js + PostgreSQL + TypeScript** для KPI Constructor CRM системы.

### Созданные файлы и папки:

```
kpi-constructor/
├── 📁 app/
│   ├── 📁 api/
│   │   ├── 📁 auth/
│   │   │   ├── login/route.ts ✅
│   │   │   └── register/route.ts ✅
│   │   └── 📁 metrics/
│   │       ├── route.ts (GET, POST) ✅
│   │       └── [id]/route.ts (GET, PUT, DELETE) ✅
│   ├── 📄 page.tsx (Login page) ✅
│   ├── 📄 register/page.tsx ✅
│   ├── 📄 layout.tsx ✅
│   └── 📄 globals.css ✅
│
├── 📁 lib/
│   ├── 📄 prisma.ts (Prisma client) ✅
│   ├── 📄 auth.ts (JWT + password hashing) ✅
│   └── 📄 kpi-calculations.ts (Розрахунки KPI & бонусов) ✅
│
├── 📁 prisma/
│   └── 📄 schema.prisma (11 таблиц БД) ✅
│
├── 📄 package.json ✅
├── 📄 .env.example ✅
├── 📄 .gitignore ✅
├── 📄 tsconfig.json ✅
├── 📄 tailwind.config.ts ✅
├── 📄 next.config.js ✅
├── 📄 postcss.config.js ✅
├── 📄 README.md ✅
└── 📄 SETUP.md ✅
```

---

## 🎯 Что готово к использованию

### ✅ Backend

- **Аутентификация:** JWT + bcrypt password hashing
- **API endpoints:**
  - `POST /api/auth/register` - Реєстрація
  - `POST /api/auth/login` - Вход
  - `GET /api/metrics` - Получить все метрики
  - `POST /api/metrics` - Создать метрику
  - `PUT /api/metrics/[id]` - Обновить метрику
  - `DELETE /api/metrics/[id]` - Удалить метрику

### ✅ Database (Prisma ORM)

11 таблиц:
1. **User** - Користувачи (Operations, Team Lead, Manager, Leadership)
2. **Department** - Відділи
3. **Metric** - Глобальный банк метрик
4. **KPIConfiguration** - KPI конфигурации для команды
5. **ConfigurationMetric** - Метрики в конфигурации (с весами)
6. **TeamManager** - Менеджеры в команде
7. **CurrentData** - Текущие фактические данные
8. **HistoryRecord** - Архив закрытых месяцев
9. **HistoryMetric** - Детали результатов по метрике
10. **AuditLog** - Логирование всех изменений

### ✅ Утилиты для расчетов

```typescript
// lib/kpi-calculations.ts
- calculateMetricPercentage() - % выполнения по метрике
- calculateManagerKPI() - Взвешенный % KPI менеджера
- calculateBonus() - Сумма бонуса (3 модели: LINEAR, THRESHOLD, MATRIX)
- validateWeights() - Проверка суммы весов
- formatCurrency() - Форматирование денег
- formatPercentage() - Форматирование %
```

### ✅ UI Components

- Страница входа (Login)
- Страница регистрации (Register)
- Готовая Tailwind CSS стилизация

---

## 🚀 Как начать разработку

### Вариант 1: Локальный PostgreSQL

```bash
# 1. Установите PostgreSQL
brew install postgresql@15  # macOS
# или скачайте с https://postgresql.org

# 2. Создайте БД
createdb kpi_constructor

# 3. Установите зависимости
cd kpi-constructor
npm install

# 4. Скопируйте .env
cp .env.example .env

# 5. Обновите DATABASE_URL в .env
DATABASE_URL="postgresql://user:password@localhost:5432/kpi_constructor"

# 6. Запустите миграции
npm run prisma:migrate

# 7. Запустите dev сервер
npm run dev

# Готово! Откройте http://localhost:3000
```

### Вариант 2: Vercel Postgres (Рекомендуется)

```bash
# 1. Залиньтесь на Vercel и создайте Postgres БД
# https://vercel.com/docs/postgres

# 2. Установите Vercel CLI
npm i -g vercel

# 3. Вытяните env
vercel env pull

# 4. Запустите миграции
npm run prisma:migrate

# 5. Запустите dev сервер
npm run dev
```

---

## 📋 Следующие шаги разработки (Phase 1)

### 🔴 TODO (В порядке приоритета)

#### 1️⃣ **Operations CRM - Конструктор KPI** (3-4 дня)
Создать главную страницу `/operations` с модулями:

```typescript
// app/operations/page.tsx
import MetricsList from '@/components/operations/MetricsList';
import ConfigurationBuilder from '@/components/operations/ConfigurationBuilder';
import DashboardOverview from '@/components/operations/DashboardOverview';

export default function OperationsPage() {
  return (
    <div>
      <MetricsList /> {/* Управление банком метрик */}
      <ConfigurationBuilder /> {/* Конструктор KPI конфигураций */}
      <DashboardOverview /> {/* Обзор по всем отделам */}
    </div>
  );
}
```

**Компоненты для создания:**
- `MetricsBank` - CRUD для метрик
- `ConfigurationWizard` - Пошаговое создание конфиги (выбор метрик → веса → менеджеры → планы → бонусная модель)
- `ApprovalFlow` - Отправка на согласование тімліду

#### 2️⃣ **Manager Dashboard** (2 дня)
Страница `/manager` для менеджеров:

```typescript
// app/manager/page.tsx
import KPIDashboard from '@/components/manager/KPIDashboard';
import HistoryTable from '@/components/manager/HistoryTable';

export default function ManagerPage() {
  return (
    <div>
      <KPIDashboard /> {/* Текущие KPI, план, факт, % выполнения, бонус */}
      <HistoryTable /> {/* История предыдущих месяцев */}
    </div>
  );
}
```

#### 3️⃣ **Team Lead Flow** (1-2 дня)
Страница `/team-lead` для согласования конфигураций и внесения фактов:

```typescript
// app/team-lead/page.tsx
import ConfigurationApproval from '@/components/team-lead/ConfigurationApproval';
import DataEntry from '@/components/team-lead/DataEntry';

export default function TeamLeadPage() {
  return (
    <div>
      <ConfigurationApproval /> {/* Просмотр и согласование конфиги */}
      <DataEntry /> {/* Форма внесення фактичних даних */}
    </div>
  );
}
```

#### 4️⃣ **Leadership Dashboard** (1 день)
Зведенный дашборд для топ-менеджмента `/leadership`:

```typescript
// app/leadership/page.tsx
import DepartmentOverview from '@/components/leadership/DepartmentOverview';
import BonusForecasting from '@/components/leadership/BonusForecasting';

export default function LeadershipPage() {
  return (
    <div>
      <DepartmentOverview /> {/* Таблица по отделам: % KPI, бонусы, динамика */}
      <BonusForecasting /> {/* Прогноз бонусного фонда */}
    </div>
  );
}
```

#### 5️⃣ **API Routes для конфигураций** (2 дня)

```typescript
// Нужно создать:
- POST /api/configurations - Создать конфигурацию
- GET /api/configurations - Получить все конфигурации
- PUT /api/configurations/[id] - Обновить статус, комментарий тімліда
- POST /api/configurations/[id]/approve - Одобрить конфигурацию
- GET /api/configurations/[id]/managers - Получить менеджеров в конфиге

- POST /api/data - Внесення фактичних даних
- GET /api/data/[configId]/[period] - Получить фактические данные за период
- POST /api/data/save-month - Сохранить месяц в HISTORY

- GET /api/history - Получить архив
- GET /api/history/[managerId] - История менеджера
```

#### 6️⃣ **Компоненты Common** (1-2 дня)

```typescript
// components/common/
├── Navigation.tsx - Меню навигации с ролями
├── ProtectedRoute.tsx - Защита от неавторизованных
├── DataTable.tsx - Универсальная таблица с сортировкой
├── FormFields.tsx - Input, Select, Textarea
├── Modal.tsx - Модальное окно
├── Toast.tsx - Уведомления об ошибках/успехе
└── LoadingSpinner.tsx - Индикатор загрузки
```

---

## 📊 Архитектура приложения

```
┌─────────────────────────────────────────────────────────┐
│                  Frontend (React + Next.js)              │
├─────────────────────────────────────────────────────────┤
│  /operations (CRM)  │  /manager  │  /team-lead  │ /lead  │
└──────────┬──────────┴───────┬────┴──────┬───────┴───┬────┘
           │                  │            │           │
           └──────────────────┼────────────┼───────────┘
                              │            │
           ┌──────────────────┴────────────┴───────────┐
           │      API Routes (/api/...)                │
           │  Auth │ Metrics │ Config │ Data │ History │
           └───────────────────────────────────────────┘
                              │
           ┌──────────────────┴──────────────────┐
           │   Prisma ORM + PostgreSQL           │
           │  (Users, Metrics, Configs, Data)    │
           └───────────────────────────────────────┘
```

---

## 🔑 Ключевые переменные окружения

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/kpi_constructor"

# JWT
JWT_SECRET="your-super-secret-key"
JWT_EXPIRES_IN="7d"

# App
NEXT_PUBLIC_APP_URL="http://localhost:3000"
NODE_ENV="development"
```

---

## 📚 API примеры использования

### Создать метрику для Media Buyers

```bash
curl -X POST http://localhost:3000/api/metrics \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Cost per FTD, $",
    "description": "Вартість одного FTD",
    "valueType": "NUMBER",
    "unit": "$",
    "direction": "LESS_IS_BETTER",
    "requiredForDepartments": ["media_buying", "affiliate"]
  }'
```

### Создать конфигурацию (будет API позже)

```javascript
// Пример логики
const config = {
  departmentId: "dept-123",
  period: "202501", // YYYYMM
  metrics: [
    { metricId: "ftd", weight: 40 },
    { metricId: "romi", weight: 30 },
    { metricId: "spend_control", weight: 30 }
  ],
  managers: [
    { name: "John Doe", grade: "MIDDLE" },
    { name: "Jane Smith", grade: "SENIOR" }
  ],
  bonusModel: "LINEAR",
  bonusParameters: {
    baseBonus: 1000
  }
};
```

### Внести фактические данные

```javascript
// Пример логики
const data = {
  configurationId: "config-123",
  period: "202501",
  entries: [
    {
      managerId: "manager-1",
      metricId: "ftd",
      planValue: 100,
      factValue: 95 // 95% выполнения
    },
    {
      managerId: "manager-1",
      metricId: "romi",
      planValue: 200,
      factValue: 210 // 105% выполнения
    }
  ]
};

// Результат:
// % по FTD = (95/100)*100 = 95%
// % по ROMI = (210/200)*100 = 105%
// % KPI = (95*0.4 + 105*0.3 + ...) / 100 = взвешенный %
// Бонус = 1000 * (% KPI / 100)
```

---

## 🎓 Рекомендации для разработки

### Порядок работы

1. **Сначала backend** - API routes и БД
2. **Потом frontend** - Pages и Components
3. **Затем интеграция** -連接 frontend с API
4. **Наконец тестирование** - На реальных данных пилотной команды

### Команды для разработки

```bash
# Dev mode с hot reload
npm run dev

# Prisma Studio (графический интерфейс БД)
npm run prisma:studio

# Проверка типов
tsc --noEmit

# Lint
npm run lint

# Production build
npm run build
npm start
```

### Полезные инструменты

- **VS Code extensions:**
  - Prisma (для подсветки синтаксиса schema.prisma)
  - Thunder Client (для тестирования API)
  - REST Client (альтернатива curl в VS Code)

- **Браузерные инструменты:**
  - Devtools (F12) - Inspect, Network, Console
  - Cookies - Проверить auth-token

---

## 📞 Что делать дальше

### Ближайшие 3 шага:

1. **Запустите приложение локально** (следуйте SETUP.md)
2. **Тестируйте API endpoints** (используйте curl или Thunder Client)
3. **Начните писать Operations CRM** (начните с компонента MetricsList)

### Затем:

4. Создайте Manager Dashboard
5. Team Lead согласование и ввод данных
6. Leadership overview

### После Phase 1 MVP:

7. Тестирование на пилотной команде
8. Сбор feedback
9. Phase 2 расширения

---

## 🎉 Готово к разработке!

Все готово, чтобы начать писать код. Проект структурирован, БД спроектирована, API routes заготовлены.

**Начните с:**

```bash
cd /home/claude/kpi-constructor
npm install
# Следуйте SETUP.md
```

**Вопросы или нужна помощь?** Спрашивайте! 🚀

---

**Happy coding!**
