// lib/ai.ts
// AI-аналіз через Anthropic API (D5, v1.2). Точка 1 — рекомендації по Baseline;
// точка 2 — оцінка ефективності активної конфігурації (конфіг + HISTORY).

import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-opus-4-8';

export class AINotConfiguredError extends Error {}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new AINotConfiguredError('ANTHROPIC_API_KEY не заданий — AI-аналіз недоступний.');
  }
  return new Anthropic({ apiKey });
}

const SYSTEM = `Ти — асистент-аналітик у системі KPI Constructor (маркетингове агентство).
Система: Operations будує KPI-конфігурації для команд; метрики мають ваги (сума 100%),
менеджери мають грейди (Junior/Middle/Senior) і планові значення; бонус рахується від % виконання KPI.
Мета — обґрунтовані, стабільні плани і захист від маніпуляцій.
Відповідай українською, стисло і по суті, маркованим списком конкретних рекомендацій.
Не вигадуй цифри, яких немає у вхідних даних.`;

async function ask(userContent: string): Promise<string> {
  const client = getClient();
  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: SYSTEM,
    messages: [{ role: 'user', content: userContent }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('\n')
    .trim();
}

/** Точка 1: рекомендації за результатами Baseline Analyzer. */
export async function analyzeBaseline(metrics: unknown): Promise<string> {
  const prompt = `Ось результати аналізу ретроспективних даних по метриках (медіани/середнє по грейдах,
стандартне відхилення, коефіцієнт варіації, тренд). Дай рекомендації Operations перед тим, як
затверджувати метрики і виставляти планові значення: на що звернути увагу (нестабільні метрики,
тренди, занадто широкий розкид), які ваги/плани доцільні, які метрики варто чи не варто включати.

Дані (JSON):
${JSON.stringify(metrics, null, 2)}`;
  return ask(prompt);
}

/** O: розпізнавання списку команди з сирого файлу (нікнейми + грейди). */
export async function extractTeam(rawText: string): Promise<{ name: string; grade: string }[]> {
  const prompt = `Нижче — сирий вміст файлу зі списком команди (можливі зайві колонки, шапки, шум).
Витягни список учасників. Для кожного поверни нікнейм/імʼя і грейд (одне з: JUNIOR, MIDDLE, SENIOR).
Якщо грейд не вказано або незрозумілий — постав MIDDLE. Імена не вигадуй, бери лише з тексту.
Поверни ВИКЛЮЧНО валідний JSON-масив без пояснень і без markdown, формат:
[{"name":"nickname","grade":"MIDDLE"}]

Вміст файлу:
${rawText.slice(0, 8000)}`;
  const text = await ask(prompt);

  // Дістаємо JSON-масив навіть якщо модель додала зайве
  let jsonStr = text.trim();
  const start = jsonStr.indexOf('[');
  const end = jsonStr.lastIndexOf(']');
  if (start !== -1 && end !== -1 && end > start) jsonStr = jsonStr.slice(start, end + 1);

  let parsed: any;
  try { parsed = JSON.parse(jsonStr); } catch { return []; }
  if (!Array.isArray(parsed)) return [];

  const valid = new Set(['JUNIOR', 'MIDDLE', 'SENIOR']);
  return parsed
    .map((m: any) => ({
      name: String(m?.name ?? '').trim(),
      grade: valid.has(String(m?.grade ?? '').toUpperCase()) ? String(m.grade).toUpperCase() : 'MIDDLE',
    }))
    .filter((m) => m.name.length > 0);
}

/** Точка 2: оцінка ефективності активної конфігурації на основі конфігу + HISTORY. */
export async function analyzeConfiguration(data: unknown): Promise<string> {
  const prompt = `Ось активна KPI-конфігурація команди разом з історією результатів (HISTORY) по місяцях.
Оціни ефективність системи KPI: які метрики системно перевиконуються або провалюються,
чи адекватні ваги і плани, чи є ознаки занадто легких/важких планів, ризики маніпуляцій,
і що варто скоригувати в наступному періоді.

Дані (JSON):
${JSON.stringify(data, null, 2)}`;
  return ask(prompt);
}
