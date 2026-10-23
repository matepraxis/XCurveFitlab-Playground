export type ModelKind = 'linear' | 'polynomial' | 'exponential' | 'logarithmic' | 'trigonometric' | 'logistic';
export type DataShape = 'quadratic' | 'linear' | 'sine' | 'exponential' | 'logistic';
export type Point = { x: number; y: number };
export type Settings = {
  model: ModelKind;
  degree: number;
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  generations: number;
  seed: number;
  elitism: number;
  searchBound: number;
};
export type Individual = { genes: number[]; score: number; valid: boolean };
export type Metrics = { mse: number | null; rmse: number | null; mae: number | null; r2: number | null; valid: boolean };
export type Generation = {
  generation: number;
  currentBest: number | null;
  bestEver: number | null;
  meanScore: number | null;
  diversity: number;
  validCount: number;
  bestGenes: number[];
  sampleGenes: number[][];
};
export type Frame = { generation: Generation; metrics: Metrics; finished: boolean };

export const DEFAULT_SETTINGS: Settings = {
  model: 'polynomial', degree: 2, populationSize: 100, mutationRate: 0.08,
  crossoverRate: 0.75, generations: 500, seed: 42, elitism: 2, searchBound: 10
};
const INVALID_SCORE = Number.POSITIVE_INFINITY;

export class SeededRandom {
  private state: number;
  constructor(seed: number) { this.state = (Math.trunc(seed) >>> 0) || 1; }
  next(): number {
    let x = this.state;
    x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
    this.state = x >>> 0;
    return this.state / 4294967296;
  }
  between(a: number, b: number): number { return a + (b - a) * this.next(); }
}

export function geneNames(model: ModelKind, degree: number): string[] {
  if (model === 'polynomial') return Array.from({ length: degree + 1 }, (_, i) => 'a' + (degree - i));
  if (model === 'linear') return ['a', 'b'];
  if (model === 'exponential') return ['a', 'b', 'c'];
  if (model === 'logarithmic') return ['a', 'b', 'c', 'd'];
  if (model === 'trigonometric') return ['a', 'b', 'c', 'd', 'e'];
  return ['L', 'k', 'x0'];
}

export function modelFormula(model: ModelKind, degree: number): string {
  const formulas: Record<ModelKind, string> = {
    linear: 'a · x + b',
    polynomial: 'a' + degree + ' · x^' + degree + ' + … + a0',
    exponential: 'a · exp(b · x) + c',
    logarithmic: 'a · ln(b · x + c) + d',
    trigonometric: 'a · sin(b · x) + c · cos(d · x) + e',
    logistic: 'L / (1 + exp(-k · (x - x0)))'
  };
  return formulas[model];
}

export function predict(model: ModelKind, genes: number[], x: number, degree: number): number {
  if (!Number.isFinite(x) || genes.some(g => !Number.isFinite(g))) return NaN;
  let y: number;
  switch (model) {
    case 'linear': y = genes[0] * x + genes[1]; break;
    case 'polynomial':
      y = genes[0];
      for (let i = 1; i <= degree; i++) y = y * x + genes[i];
      break;
    case 'exponential': {
      const exponent = genes[1] * x;
      y = exponent > 700 ? NaN : genes[0] * Math.exp(exponent) + genes[2];
      break;
    }
    case 'logarithmic': {
      const argument = genes[1] * x + genes[2];
      y = argument > 0 ? genes[0] * Math.log(argument) + genes[3] : NaN;
      break;
    }
    case 'trigonometric':
      y = genes[0] * Math.sin(genes[1] * x) + genes[2] * Math.cos(genes[3] * x) + genes[4];
      break;
    case 'logistic': {
      const z = genes[1] * (x - genes[2]);
      const sigmoid = z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
      y = genes[0] * sigmoid;
      break;
    }
  }
  return Number.isFinite(y) ? y : NaN;
}

export function calculateMetrics(points: Point[], model: ModelKind, genes: number[], degree: number): Metrics {
  if (!points.length) return { mse: null, rmse: null, mae: null, r2: null, valid: false };
  const mean = points.reduce((sum, p) => sum + p.y, 0) / points.length;
  let squared = 0, absolute = 0, total = 0;
  for (const p of points) {
    const estimation = predict(model, genes, p.x, degree);
    if (!Number.isFinite(estimation)) return { mse: null, rmse: null, mae: null, r2: null, valid: false };
    const e = p.y - estimation;
    squared += e * e; absolute += Math.abs(e);
    total += (p.y - mean) ** 2;
  }
  const mse = squared / points.length;
  if (!Number.isFinite(mse)) return { mse: null, rmse: null, mae: null, r2: null, valid: false };
  return {
    mse, rmse: Math.sqrt(mse), mae: absolute / points.length,
    r2: total > 1e-12 ? 1 - squared / total : null, valid: true
  };
}

export function generateData(shape: DataShape, noise: number, count: number, seed: number): Point[] {
  const rng = new SeededRandom(seed + 1009);
  const samples: Point[] = [];
  const n = Math.max(5, Math.trunc(count));
  for (let i = 0; i < n; i++) {
    const x = -2.5 + 5 * i / (n - 1);
    let y: number;
    if (shape === 'linear') y = 1.6 * x + 0.4;
    else if (shape === 'quadratic') y = 0.85 * x * x - 1.1 * x + 0.3;
    else if (shape === 'sine') y = 2.2 * Math.sin(1.8 * x + 0.3);
    else if (shape === 'exponential') y = 0.7 * Math.exp(0.75 * x) - 1;
    else y = 4.5 / (1 + Math.exp(-1.8 * (x - 0.2)));
    const randomError = (rng.next() + rng.next() + rng.next() + rng.next() + rng.next() + rng.next() - 3) * noise;
    samples.push({ x, y: y + randomError });
  }
  return samples;
}

/** RFC 4180-style quoted cells, semicolon/comma delimiters, BOM and CRLF. */
export function parseCsv(csv: string): { columns: string[]; rows: string[][] } {
  if (csv.length > 2_000_000) throw new Error('Archivo demasiado grande (límite: 2 MB).');
  const text = csv.replace(/^\uFEFF/, '');
  if (!text.trim()) throw new Error('El archivo CSV está vacío.');
  let commas = 0, semicolons = 0, inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && (ch === '\n' || ch === '\r')) break;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semicolons++;
  }
  const delimiter = semicolons > commas ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [], value = '';
  inQuotes = false;
  const finishRecord = () => {
    record.push(value.trim()); value = '';
    if (record.some(cell => cell !== '')) records.push(record);
    record = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') { value += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delimiter) {
      record.push(value.trim()); value = '';
    } else if (!inQuotes && (ch === '\r' || ch === '\n')) {
      finishRecord();
      if (ch === '\r' && text[i + 1] === '\n') i++;
    } else value += ch;
  }
  if (inQuotes) throw new Error('Comillas sin cerrar en el archivo CSV.');
  finishRecord();
  if (records.length < 2) throw new Error('El CSV requiere encabezados y observaciones.');
  const [columns, ...rows] = records;
  if (columns.length < 2 || columns.some(c => !c)) throw new Error('El CSV requiere al menos dos encabezados no vacíos.');
  if (new Set(columns).size !== columns.length) throw new Error('El CSV tiene nombres de columnas duplicados.');
  if (rows.some(row => row.length !== columns.length))
    throw new Error('El CSV tiene filas con un número de columnas diferente al encabezado.');
  if (rows.length > 1000) throw new Error('Para garantizar fluidez, carga máximo 1000 observaciones por experimento.');
  return { columns, rows };
}

export function pointsFromCsv(columns: string[], rows: string[][], xColumn: string, yColumn: string): Point[] {
  const ix = columns.indexOf(xColumn), iy = columns.indexOf(yColumn);
  if (ix < 0 || iy < 0 || ix === iy) throw new Error('Selecciona dos columnas distintas para X y Y.');
  const parseNumeric = (input: string | undefined): number | null => {
    const s = input?.trim() ?? '';
    if (!/^[+-]?(?:\d+(?:[.,]\d*)?|[.,]\d+)(?:e[+-]?\d+)?$/i.test(s)) return null;
    const n = Number(s.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const points: Point[] = [];
  for (const row of rows) {
    const x = parseNumeric(row[ix]), y = parseNumeric(row[iy]);
    if (x !== null && y !== null) points.push({ x, y });
  }
  if (points.length < 5) throw new Error('Se necesitan al menos cinco pares numéricos válidos.');
  return points.sort((a, b) => a.x - b.x);
}

export class Evolution {
  private rng: SeededRandom;
  private population: Individual[];
  private best: Individual;
  private generationNumber = 0;
  private history: Generation[] = [];
  readonly settings: Settings;
  readonly points: Point[];

  constructor(settings: Settings, points: Point[]) {
    if (points.length < 5 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)))
      throw new Error('La muestra requiere cinco observaciones numéricas válidas.');
    if (!Number.isInteger(settings.degree) || settings.degree < 1 || settings.degree > 5)
      throw new Error('Grado polinómico fuera de rango.');
    if (!Number.isInteger(settings.populationSize) || settings.populationSize < 10 || settings.populationSize > 1000)
      throw new Error('El tamaño poblacional debe estar entre 10 y 1000.');
    if (settings.elitism < 0 || settings.elitism >= settings.populationSize || !Number.isInteger(settings.elitism))
      throw new Error('Elitismo no válido.');
    if (settings.mutationRate < 0 || settings.mutationRate > 1 || settings.crossoverRate < 0 || settings.crossoverRate > 1)
      throw new Error('Las probabilidades deben estar entre 0 y 1.');
    if (!(settings.searchBound > 0 && Number.isFinite(settings.searchBound))) throw new Error('Rango genético no válido.');
    this.settings = { ...settings };
    this.points = points.map(p => ({ ...p }));
    this.rng = new SeededRandom(settings.seed);
    const geneCount = geneNames(settings.model, settings.degree).length;
    this.population = Array.from({ length: settings.populationSize }, () => {
      const genes = Array.from({ length: geneCount }, () => this.rng.between(-settings.searchBound, settings.searchBound));
      return this.evaluate(genes);
    });
    this.best = this.clone(this.minOf(this.population));
    this.capture();
  }
  private clone(i: Individual): Individual { return { genes: [...i.genes], score: i.score, valid: i.valid }; }
  private evaluate(genes: number[]): Individual {
    const metrics = calculateMetrics(this.points, this.settings.model, genes, this.settings.degree);
    return { genes: [...genes], score: metrics.mse ?? INVALID_SCORE, valid: metrics.valid };
  }
  private minOf(pop: Individual[]): Individual { return pop.reduce((a, b) => a.score <= b.score ? a : b); }
  private tournament(): Individual {
    let best = this.population[Math.floor(this.rng.next() * this.population.length)];
    for (let i = 0; i < 2; i++) {
      const candidate = this.population[Math.floor(this.rng.next() * this.population.length)];
      if (candidate.score < best.score) best = candidate;
    }
    return best;
  }
  private capture(): void {
    const ordered = [...this.population].sort((a, b) => a.score - b.score);
    const current = ordered[0];
    if (current.score < this.best.score) this.best = this.clone(current);
    const valid = ordered.filter(i => i.valid);
    const mean = valid.length ? valid.reduce((sum, i) => sum + i.score, 0) / valid.length : null;
    const genesCount = ordered[0].genes.length;
    const centers = Array.from({ length: genesCount }, (_, j) =>
      ordered.reduce((sum, i) => sum + i.genes[j], 0) / ordered.length);
    const diversity = Math.sqrt(ordered.reduce((sum, i) =>
      sum + i.genes.reduce((acc, gene, j) => acc + (gene - centers[j]) ** 2, 0) / genesCount, 0) / ordered.length);
    const sampled = Array.from({ length: Math.min(12, ordered.length) }, (_, j) =>
      ordered[Math.floor(j * (ordered.length - 1) / Math.max(1, Math.min(12, ordered.length) - 1))].genes.slice());
    this.history.push({
      generation: this.generationNumber,
      currentBest: current.valid ? current.score : null,
      bestEver: this.best.valid ? this.best.score : null,
      meanScore: mean,
      diversity,
      validCount: valid.length,
      bestGenes: [...this.best.genes],
      sampleGenes: sampled
    });
  }
  step(): Frame {
    if (this.generationNumber >= this.settings.generations) return this.frame();
    const sorted = [...this.population].sort((a, b) => a.score - b.score);
    const next: Individual[] = sorted.slice(0, this.settings.elitism).map(i => this.clone(i));
    while (next.length < this.settings.populationSize) {
      const father = this.tournament(), mother = this.tournament();
      const genes = father.genes.map((g, i) => {
        let value = this.rng.next() < this.settings.crossoverRate && this.rng.next() < 0.5 ? mother.genes[i] : g;
        if (this.rng.next() < this.settings.mutationRate) {
          const change = (this.rng.next() + this.rng.next() + this.rng.next() + this.rng.next() - 2)
            * this.settings.searchBound * 0.15;
          value = Math.max(-this.settings.searchBound, Math.min(this.settings.searchBound, value + change));
        }
        return value;
      });
      next.push(this.evaluate(genes));
    }
    this.population = next;
    this.generationNumber++;
    this.capture();
    return this.frame();
  }
  frame(): Frame {
    return {
      generation: this.history[this.history.length - 1],
      metrics: calculateMetrics(this.points, this.settings.model, this.best.genes, this.settings.degree),
      finished: this.generationNumber >= this.settings.generations
    };
  }
  getHistory(): Generation[] { return [...this.history]; }
}
