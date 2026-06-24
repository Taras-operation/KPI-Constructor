import { describe, it, expect } from 'vitest';
import { parseTable, analyzeBaseline, recommendedPlan } from '@/lib/baseline';

const TSV = `period\tgrade\tFTD\tCost per FTD
202401\tJUNIOR\t100\t12
202401\tSENIOR\t200\t8
202402\tJUNIOR\t120\t11
202402\tSENIOR\t220\t9`;

describe('parseTable', () => {
  it('розпізнає TSV і заголовки', () => {
    const t = parseTable(TSV);
    expect(t.headers).toEqual(['period', 'grade', 'FTD', 'Cost per FTD']);
    expect(t.rows.length).toBe(4);
  });

  it('розпізнає CSV з комами', () => {
    const t = parseTable('a,b\n1,2');
    expect(t.headers).toEqual(['a', 'b']);
    expect(t.rows[0]).toEqual(['1', '2']);
  });
});

describe('analyzeBaseline', () => {
  const res = analyzeBaseline(parseTable(TSV));

  it('медіани по грейдах', () => {
    const ftd = res.metrics.find((m) => m.name === 'FTD')!;
    expect(ftd.byGrade.JUNIOR.median).toBe(110); // (100,120)
    expect(ftd.byGrade.SENIOR.median).toBe(210); // (200,220)
  });

  it('грейди у відомому порядку', () => {
    expect(res.grades).toEqual(['JUNIOR', 'SENIOR']);
  });

  it('сезональність по місяцях (index = mean місяця / mean всіх)', () => {
    const ftd = res.metrics.find((m) => m.name === 'FTD')!;
    // all = [100,200,120,220] mean=160; 01 mean=150 -> 0.94 ; 02 mean=170 -> 1.06
    const jan = ftd.seasonality.find((s) => s.month === '01')!;
    const feb = ftd.seasonality.find((s) => s.month === '02')!;
    expect(jan.index).toBe(0.94);
    expect(feb.index).toBe(1.06);
  });

  it('CV рахується (стабільність)', () => {
    const ftd = res.metrics.find((m) => m.name === 'FTD')!;
    expect(ftd.cv).not.toBeNull();
    expect(ftd.cv!).toBeGreaterThan(0);
  });

  it('mean і stdDev рахуються', () => {
    const ftd = res.metrics.find((m) => m.name === 'FTD')!;
    expect(ftd.mean).toBe(160); // (100+200+120+220)/4
    expect(ftd.stdDev).not.toBeNull();
    expect(ftd.byGrade.JUNIOR.mean).toBe(110);
  });

  it('тренд up (період 01 avg 150 -> 02 avg 170)', () => {
    const ftd = res.metrics.find((m) => m.name === 'FTD')!;
    expect(ftd.trend).toBe('up');
  });

  it('попереджає про відсутні колонки', () => {
    const r = analyzeBaseline(parseTable('FTD\n100\n200'));
    expect(r.warnings.length).toBe(2);
  });
});

describe('recommendedPlan', () => {
  const res = analyzeBaseline(parseTable(TSV));
  const ftd = res.metrics.find((m) => m.name === 'FTD')!;

  it('без місяця = медіана по грейду', () => {
    expect(recommendedPlan(ftd, 'JUNIOR')).toBe(110);
  });

  it('з місяцем = медіана × сезонний індекс', () => {
    // JUNIOR median 110 × лютий 1.06 = 116.6
    expect(recommendedPlan(ftd, 'JUNIOR', '02')).toBe(116.6);
  });
});
