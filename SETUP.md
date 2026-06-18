# 🚀 Пошагова інструкція запуску KPI Constructor

## Варіант 1: Локальний запуск з PostgreSQL

### Крок 1: Встановлення PostgreSQL

**На macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**На Windows:**
- Завантажте з https://www.postgresql.org/download/windows/
- Встановіть з дефолтними параметрами
- Запам'ятайте пароль для користувача `postgres`

**На Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo service postgresql start
```

### Крок 2: Створення БД

```bash
# Підключіться до PostgreSQL
psql -U postgres

# В PostgreSQL shell виконайте:
CREATE DATABASE kpi_constructor;
\q
```

### Крок 3: Клонування і встановлення

```bash
# Клонуйте або скопіюйте проект
cd kpi-constructor

# Встановіть залежності
npm install

# Скопіюйте .env файл
cp .env.example .env

# Оновіть .env (замініть дані на свої):
# DATABASE_URL="postgresql://postgres:password@localhost:5432/kpi_constructor"
```

### Крок 4: Міграції Prisma

```bash
# Запустіть міграції
npm run prisma:migrate

# Відповідьте на запит про назву міграції, наприклад: "init"
```

### Крок 5: Запуск розвивального сервера

```bash
npm run dev
```

Перейдіть на **http://localhost:3000**

---

## Варіант 2: Використання Vercel Postgres (Рекомендовано)

### Крок 1: Реєстрація на Vercel

1. Перейдіть на https://vercel.com
2. Зареєструйтесь через GitHub
3. Создайте новий проект або використовуйте існуючий

### Крок 2: Підключення Vercel Postgres

1. В Vercel Dashboard → Storage → Create
2. Виберіть **Postgres**
3. Назвіть БД `kpi-constructor`
4. Vercel автоматично заповнить `DATABASE_URL`

### Крок 3: Локальна розробка з Vercel Postgres

```bash
# Встановіть Vercel CLI
npm i -g vercel

# Залогіньтесь
vercel login

# Витягніть env з Vercel
vercel env pull

# Запустіть міграції
npm run prisma:migrate

# Запустіть сервер
npm run dev
```

---

## Варіант 3: Швидкий запуск через Docker (Опціонально)

### Крок 1: Встановлення Docker

Завантажте Docker Desktop з https://www.docker.com/products/docker-desktop

### Крок 2: Docker Compose

Создайте файл `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: kpi_constructor
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  app:
    build: .
    ports:
      - "3000:3000"
    depends_on:
      - postgres
    environment:
      DATABASE_URL: postgresql://postgres:password@postgres:5432/kpi_constructor

volumes:
  postgres_data:
```

### Крок 3: Запуск через Docker

```bash
docker-compose up
```

---

## Перевірка встановлення

### 1. Перевірте БД

```bash
# Підключіться до БД
psql -U postgres -d kpi_constructor -c "\dt"

# Мають з'явитися таблиці:
# User, Metric, KPIConfiguration, etc.
```

### 2. Відкрийте додаток

1. Перейдіть на http://localhost:3000
2. Натисніть "Реєстрація"
3. Создайте користувача з роллю "OPERATIONS"

### 3. Тестуйте API

```bash
# Реєстрація
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ops@test.com",
    "password": "password",
    "name": "Operations",
    "role": "OPERATIONS"
  }'

# Вхід
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ops@test.com",
    "password": "password"
  }'
```

---

## Загальні команди

```bash
# Розробка
npm run dev

# Build для production
npm run build

# Запуск production версії
npm start

# Prisma Studio (перегляд БД)
npm run prisma:studio

# Міграції
npm run prisma:migrate

# Генерація Prisma client
npm run prisma:generate

# Lint
npm run lint
```

---

## Можливі проблеми

### Проблема: "error: could not connect to server"

**Рішення:** Переконайтесь, що PostgreSQL запущений:

```bash
# macOS
brew services start postgresql@15

# Linux
sudo service postgresql start

# Windows - запустіть PostgreSQL Server з Services
```

### Проблема: "Error: EACCES: permission denied"

**Рішення:** Дозвіл на запис в теку:

```bash
chmod -R 755 .
npm install
```

### Проблема: "Port 3000 already in use"

**Рішення:** Запустіть на іншому порту:

```bash
npm run dev -- -p 3001
```

### Проблема: Міграції не застосовуються

**Рішення:** Перезавдайте:

```bash
# Видаліть папку migrations (ОБЕРЕЖНО!)
rm -rf prisma/migrations

# Запустіть заново
npm run prisma:migrate
```

---

## Наступні кроки

1. **Создайте тестових користувачів** через API або вручну в БД
2. **Запустіть CRM для Operations** на сторінці `/operations`
3. **Загрузіть реальні дані** вашої пілотної команди
4. **Тестуйте функціональність** через UI

---

## Потреба в допомозі?

Якщо у вас є питання або проблеми, звертайтесь до Operations-команди або перевірте [README.md](./README.md).

---

**Happy developing! 🚀**
