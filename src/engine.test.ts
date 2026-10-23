import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, Evolution, calculateMetrics, generateData, geneNames, parseCsv, pointsFromCsv, predict } from './engine';

describe('representación genética', () => {
  it('mantiene la estructura de genes del modelo elegido', () => {
    expect(geneNames('linear', 1)).toEqual(['a', 'b']);
    expect(geneNames('polynomial', 4)).toEqual(['a4', 'a3', 'a2', 'a1', 'a0']);
    expect(geneNames('trigonometric', 2)).toHaveLength(5);
  });
  it('evalúa cada familia matemática', () => {
    expect(predict('linear', [2, 3], 2, 1)).toBe(7);
    expect(predict('polynomial', [1, 0, -1], 3, 2)).toBe(8);
    expect(predict('exponential', [2, 0, 1], 4, 1)).toBe(3);
    expect(predict('logarithmic', [1, 1, 0, 0], 1, 1)).toBe(0);
    expect(Number.isNaN(predict('logarithmic', [1, 1, 0, 0], -1, 1))).toBe(true);
    expect(predict('logistic', [4, 2, 0], 0, 1)).toBe(2);
  });
});
describe('análisis de residuos y métricas', () => {
  it('produce MSE cero y R² uno en ajuste perfecto', () => {
    const points = [{ x: 0, y: 1 }, { x: 1, y: 3 }, { x: 2, y: 5 }, { x: 3, y: 7 }, { x: 4, y: 9 }];
    expect(calculateMetrics(points, 'linear', [2, 1], 1)).toMatchObject({ mse: 0, rmse: 0, mae: 0, r2: 1, valid: true });
  });
  it('no recorta artificialmente R² negativo', () => {
    const pts = [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 3 }, { x: 4, y: 4 }];
    expect(calculateMetrics(pts, 'linear', [0, 100], 1).r2!).toBeLessThan(0);
  });
  it('informa predicciones fuera de dominio sin disfrazarlas', () => {
    const points = generateData('quadratic', 0, 30, 42);
    expect(calculateMetrics(points, 'logarithmic', [1, 1, 0, 0], 1).valid).toBe(false);
  });
});
describe('evolución', () => {
  const settings = { ...DEFAULT_SETTINGS, populationSize: 40, generations: 30 };
  const points = generateData('quadratic', 0.1, 45, 12);
  it('reproduce generaciones con una semilla fija', () => {
    const a = new Evolution(settings, points);
    const b = new Evolution(settings, points);
    for (let i = 0; i < 12; i++) {
      expect(a.step()).toEqual(b.step());
    }
  });
  it('mantiene el mejor histórico gracias a elitismo', () => {
    const engine = new Evolution(settings, points);
    const initial = engine.frame().generation.bestEver!;
    for (let i = 0; i < 30; i++) engine.step();
    const history = engine.getHistory();
    expect(history).toHaveLength(31);
    expect(history[30].bestEver!).toBeLessThanOrEqual(initial);
    for (let i = 1; i < history.length; i++)
      expect(history[i].bestEver!).toBeLessThanOrEqual(history[i - 1].bestEver!);
    expect(engine.frame().finished).toBe(true);
  });
});
describe('importación CSV', () => {
  it('elige columnas x/y y conserva observaciones válidas', () => {
    const result = parseCsv('tiempo;valor;grupo\n0;2;A\n1;3;A\n2;5;A\n3;7;A\n4;11;B');
    expect(pointsFromCsv(result.columns, result.rows, 'tiempo', 'valor')).toHaveLength(5);
  });
});
