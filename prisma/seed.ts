// prisma/seed.ts
// Наповнення БД тестовими даними: користувачі, відділи, банк метрик (розд. 3.1 ТЗ).

import { PrismaClient, MetricValueType, MetricDirection, UserRole } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const N = MetricValueType.NUMBER;
const P = MetricValueType.PERCENT;
const R = MetricValueType.RATING;
const MORE = MetricDirection.MORE_IS_BETTER;
const LESS = MetricDirection.LESS_IS_BETTER;

// Відділи: ключ -> назва. Ключі використовуються в requiredForDepartments.
const DEPARTMENTS: Record<string, string> = {
  affiliate: 'Медіабаїнг / Affiliate',
  smm: 'SMM',
  retention: 'Retention',
  brand: 'Brand / Promo',
  seo: 'SEO / Performance',
  b2b: 'Sponsorship / B2B',
};

// Банк метрик. required = ключі відділів, для яких метрика обов'язкова.
type MetricSeed = {
  name: string;
  description: string;
  valueType: MetricValueType;
  unit: string;
  direction: MetricDirection;
  required: string[];
};

const METRICS: MetricSeed[] = [
  // --- Медіабаєри / Affiliate ---
  { name: 'FTD, #', description: 'Кількість FTD (First Time Depositors) — ключовий результат байєра', valueType: N, unit: 'шт.', direction: MORE, required: ['affiliate'] },
  { name: 'Dep Sum, $', description: 'Сума депозитів — якість трафіку', valueType: N, unit: '$', direction: MORE, required: ['affiliate'] },
  { name: 'Net Revenue, $', description: 'Підсумкова доходність після всіх виплат', valueType: N, unit: '$', direction: MORE, required: ['affiliate', 'smm'] },
  { name: 'ROMI / ROI, %', description: 'Ефективність використання бюджету', valueType: P, unit: '%', direction: MORE, required: ['affiliate'] },
  { name: 'Spend, $', description: 'Контроль використання бюджету', valueType: N, unit: '$', direction: MORE, required: [] },
  { name: 'Regs, #', description: 'Кількість реєстрацій — проміжна воронка', valueType: N, unit: 'шт.', direction: MORE, required: ['affiliate'] },
  { name: 'Cost per FTD, $', description: 'Вартість одного FTD (менше = краще)', valueType: N, unit: '$', direction: LESS, required: ['affiliate'] },
  { name: 'Cost per Reg, $', description: 'Вартість входу у воронку (менше = краще)', valueType: N, unit: '$', direction: LESS, required: ['affiliate'] },
  { name: 'Reg-to-FTD, %', description: 'Конверсія з реєстрації у FTD', valueType: P, unit: '%', direction: MORE, required: ['affiliate'] },
  { name: 'Кількість нових партнерів, #', description: 'Ріст партнерської бази', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Кількість активних партнерів, #', description: 'Якість партнерської бази', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Follow-up / Переговори', description: 'Процесна метрика для Affiliate Manager', valueType: R, unit: 'бали', direction: MORE, required: [] },

  // --- SMM ---
  { name: 'Охоплення (Reach), тис.', description: 'Сумарне охоплення публікацій', valueType: N, unit: 'тис.', direction: MORE, required: ['smm'] },
  { name: 'Покази (Impressions), тис.', description: 'Сумарні покази за період', valueType: N, unit: 'тис.', direction: MORE, required: ['smm'] },
  { name: 'ER, %', description: '(лайки + коменти + збереження + репости) / охоплення', valueType: P, unit: '%', direction: MORE, required: ['smm'] },
  { name: 'Приріст підписників, #', description: 'Ріст аудиторії', valueType: N, unit: 'шт.', direction: MORE, required: ['smm'] },
  { name: 'Кількість публікацій, #', description: 'Обсяг роботи', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'CTR, %', description: 'Кліки / покази', valueType: P, unit: '%', direction: MORE, required: ['smm'] },
  { name: 'Click to Reg, %', description: 'Конверсія з кліку в реєстрацію', valueType: P, unit: '%', direction: MORE, required: [] },
  { name: 'ROAS', description: 'Дохід від реклами / рекламні витрати', valueType: N, unit: 'x', direction: MORE, required: ['smm'] },
  { name: 'CPC, $', description: 'Ціна кліку (менше = краще)', valueType: N, unit: '$', direction: LESS, required: [] },
  { name: 'CPL, $', description: 'Ціна ліда (менше = краще)', valueType: N, unit: '$', direction: LESS, required: [] },
  { name: 'Кількість FTD, #', description: 'Платящі юзери з SMM-каналу', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Сума депозитів, $', description: 'Загальна сума депозитів з каналу', valueType: N, unit: '$', direction: MORE, required: [] },

  // --- Retention ---
  { name: 'OR (відкриття листів), %', description: 'Відкриваємість розсилок', valueType: P, unit: '%', direction: MORE, required: ['retention'] },
  { name: 'CTR розсилок, %', description: 'Кліки по лінку в листі / SMS / пуші', valueType: P, unit: '%', direction: MORE, required: ['retention'] },
  { name: 'Кількість розсилок, #', description: 'Обсяг роботи', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: '% реактивації', description: 'Реактивація по каналах (листи, пуші, SMS, дзвінки)', valueType: P, unit: '%', direction: MORE, required: ['retention'] },
  { name: 'Retention Rate, %', description: 'Частка активних юзерів, що повернулись', valueType: P, unit: '%', direction: MORE, required: ['retention'] },
  { name: 'Кількість активних юзерів, #', description: 'Активні юзери за період', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: '% приросту активних юзерів', description: 'Темп росту активної бази', valueType: P, unit: '%', direction: MORE, required: [] },

  // --- Brand / Promo ---
  { name: 'Кількість учасників акцій, #', description: 'Залучення в акції', valueType: N, unit: 'шт.', direction: MORE, required: ['brand'] },
  { name: '% залучення акції', description: 'Частка залучення в акцію', valueType: P, unit: '%', direction: MORE, required: [] },
  { name: 'ROMI акцій, %', description: 'Ефективність бюджету акцій', valueType: P, unit: '%', direction: MORE, required: ['brand'] },
  { name: 'Сума депозитів в рамках акції, $', description: 'Депозити, згенеровані акцією', valueType: N, unit: '$', direction: MORE, required: [] },
  { name: 'Кількість спецпроектів, #', description: 'Обсяг спецпроектів', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Охоплення спецпроектів', description: 'Сумарне охоплення спецпроектів', valueType: N, unit: 'тис.', direction: MORE, required: [] },
  { name: 'Cost per Mention, $', description: 'Вартість згадки (менше = краще)', valueType: N, unit: '$', direction: LESS, required: [] },

  // --- SEO / Performance ---
  { name: 'Кліки (GSC), #', description: 'Кліки за даними Google Search Console', valueType: N, unit: 'шт.', direction: MORE, required: ['seo'] },
  { name: 'Кількість Regs (SEO), #', description: 'Реєстрації з органічного трафіку', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Bounce rate, %', description: 'Показник відмов (менше = краще)', valueType: P, unit: '%', direction: LESS, required: ['seo'] },
  { name: 'Конверсія в ліда, %', description: 'Конверсія органіки в ліда', valueType: P, unit: '%', direction: MORE, required: ['seo'] },
  { name: 'Переходи з пошукових систем, #', description: 'Органічні переходи', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Time on Page', description: 'Середній час на сторінці', valueType: N, unit: 'сек', direction: MORE, required: [] },

  // --- Sponsorship / B2B ---
  { name: 'Активні акаунти, #', description: 'Кількість активних акаунтів', valueType: N, unit: 'шт.', direction: MORE, required: ['b2b'] },
  { name: 'Нові угоди, #', description: 'Кількість нових угод', valueType: N, unit: 'шт.', direction: MORE, required: ['b2b'] },
  { name: 'Оцінки офферів, #', description: 'Кількість оцінених офферів', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Підключення Fix, #', description: 'Підключення за моделлю Fix', valueType: N, unit: 'шт.', direction: MORE, required: [] },
  { name: 'Підключення RS, #', description: 'Підключення за моделлю Revenue Share', valueType: N, unit: 'шт.', direction: MORE, required: [] },

  // --- Загальні / Процесні ---
  { name: 'Дотримання дедлайнів, %', description: 'Задачі здані вчасно від загальної кількості', valueType: P, unit: '%', direction: MORE, required: [] },
  { name: 'Кількість правок від клієнта, #', description: 'Середня кількість ітерацій на одиницю контенту (менше = краще)', valueType: N, unit: 'шт.', direction: LESS, required: [] },
  { name: 'Виконання плану продажів, %', description: 'Відсоток виконання плану продажів', valueType: P, unit: '%', direction: MORE, required: [] },
  { name: 'Оцінка якості тімлідом, бали (1-5)', description: 'Суб’єктивна оцінка якості роботи тімлідом', valueType: R, unit: 'бали', direction: MORE, required: [] },
];

const USERS: { email: string; name: string; role: UserRole; department?: string }[] = [
  { email: 'ops@test.com', name: 'Operations Admin', role: UserRole.OPERATIONS },
  { email: 'lead@test.com', name: 'Тімлід Affiliate', role: UserRole.TEAM_LEAD, department: 'affiliate' },
  { email: 'manager@test.com', name: 'Менеджер Affiliate', role: UserRole.MANAGER, department: 'affiliate' },
  { email: 'leader@test.com', name: 'Керівництво', role: UserRole.LEADERSHIP },
];

async function main() {
  console.log('🌱 Seeding...');

  // 1. Відділи
  const deptIdByKey: Record<string, string> = {};
  for (const [key, name] of Object.entries(DEPARTMENTS)) {
    const dept = await prisma.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    deptIdByKey[key] = dept.id;
  }
  console.log(`  ✓ Відділів: ${Object.keys(deptIdByKey).length}`);

  // 2. Користувачі (пароль для всіх — "password")
  const passwordHash = await bcrypt.hash('password', 10);
  for (const u of USERS) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: { name: u.name, role: u.role, departmentId: u.department ? deptIdByKey[u.department] : null },
      create: {
        email: u.email,
        name: u.name,
        role: u.role,
        passwordHash,
        departmentId: u.department ? deptIdByKey[u.department] : null,
      },
    });
  }
  console.log(`  ✓ Користувачів: ${USERS.length} (пароль: password)`);

  // 3. Банк метрик
  for (const m of METRICS) {
    const requiredIds = m.required.map((k) => deptIdByKey[k]).filter(Boolean);
    await prisma.metric.upsert({
      where: { name: m.name },
      update: {
        description: m.description,
        valueType: m.valueType,
        unit: m.unit,
        direction: m.direction,
        requiredForDepartments: requiredIds,
      },
      create: {
        name: m.name,
        description: m.description,
        valueType: m.valueType,
        unit: m.unit,
        direction: m.direction,
        requiredForDepartments: requiredIds,
      },
    });
  }
  console.log(`  ✓ Метрик у банку: ${METRICS.length}`);

  console.log('✅ Seed завершено.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
