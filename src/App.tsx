import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import * as echarts from 'echarts';
import {
  Activity, ArrowRight, ChartScatter, CircleHelp, Dna, Download, FlaskConical,
  Layers3, Moon, Pause, Play, RotateCcw, Settings2, SkipForward, Sun, Upload
} from 'lucide-react';
import {
  DEFAULT_SETTINGS, calculateMetrics, generateData, geneNames, modelFormula,
  parseCsv, pointsFromCsv, predict, type DataShape, type Frame, type Generation,
  type ModelKind, type Point, type Settings
} from './engine';

const INITIAL_POINTS = generateData('quadratic', 0.18, 60, 42);
const MODELS: { id: ModelKind; label: string }[] = [
  { id: 'linear', label: 'Lineal' },
  { id: 'polynomial', label: 'Polinómico' },
  { id: 'exponential', label: 'Exponencial' },
  { id: 'logarithmic', label: 'Logarítmico' },
  { id: 'trigonometric', label: 'Trigonométrico' },
  { id: 'logistic', label: 'Logístico' }
];
const SHAPES: { id: DataShape; label: string }[] = [
  { id: 'quadratic', label: 'Parábola con ruido' },
  { id: 'linear', label: 'Recta' },
  { id: 'sine', label: 'Función sinusoidal' },
  { id: 'exponential', label: 'Crecimiento exponencial' },
  { id: 'logistic', label: 'Crecimiento logístico' }
];

type WorkerEvent =
  | { type: 'frame'; frame: Frame }
  | { type: 'running'; running: boolean }
  | { type: 'reset-complete' }
  | { type: 'error'; message: string };
type ChartProps = { option: echarts.EChartsOption; onPoint?: (index: number) => void; className?: string };

function EChart({ option, onPoint, className }: ChartProps) {
  const root = useRef<HTMLDivElement>(null);
  const chart = useRef<echarts.ECharts | null>(null);
  useEffect(() => {
    if (!root.current) return;
    const instance = echarts.init(root.current, undefined, { renderer: 'canvas' });
    chart.current = instance;
    const resize = new ResizeObserver(() => instance.resize());
    resize.observe(root.current);
    return () => { resize.disconnect(); instance.dispose(); chart.current = null; };
  }, []);
  useEffect(() => { chart.current?.setOption(option, { notMerge: true, lazyUpdate: true }); }, [option]);
  useEffect(() => {
    const instance = chart.current;
    if (!instance) return;
    const handle = (event: { data?: unknown }) => {
      const data = event.data;
      if (Array.isArray(data) && typeof data[2] === 'number') onPoint?.(data[2]);
    };
    instance.on('click', handle);
    return () => { instance.off('click', handle); };
  }, [onPoint]);
  return <div ref={root} className={'chart-canvas ' + (className ?? '')} role="img" aria-label="Gráfica interactiva" />;
}

function formatValue(value: number | null | undefined, digits = 3): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs !== 0 && (abs >= 100000 || abs < 0.0001)) return value.toExponential(2);
  return value.toLocaleString('es-CO', { maximumFractionDigits: digits });
}
function axisStyle(dark: boolean) {
  return {
    axisLine: { lineStyle: { color: dark ? '#34425b' : '#d7dee9' } },
    axisTick: { show: false },
    axisLabel: { color: dark ? '#8294af' : '#69768b', fontSize: 11 },
    splitLine: { lineStyle: { color: dark ? '#26344b' : '#eef1f6', type: 'dashed' as const } },
    nameTextStyle: { color: dark ? '#9dacbf' : '#69768b', fontSize: 12 }
  };
}
function basicChart(dark: boolean): echarts.EChartsOption {
  return {
    animation: false,
    backgroundColor: 'transparent',
    textStyle: { fontFamily: 'Inter, system-ui, sans-serif', color: dark ? '#b9c7de' : '#4f5e72' },
    grid: { left: 52, right: 20, top: 26, bottom: 42 },
    tooltip: {
      trigger: 'item', confine: true, backgroundColor: dark ? '#19273b' : '#ffffff',
      borderColor: dark ? '#344761' : '#e3e8f1',
      textStyle: { color: dark ? '#f2f6ff' : '#172338', fontSize: 12 }
    }
  };
}
function FieldSlider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number;
  format?: (v: number) => string; onChange: (v: number) => void
}) {
  return <label className="slider-field">
    <span className="field-heading"><span>{label}</span><strong>{format ? format(value) : formatValue(value, 4)}</strong></span>
    <input type="range" min={min} max={max} step={step} value={value}
      onChange={event => onChange(Number(event.target.value))} />
  </label>;
}

function App() {
  const worker = useRef<Worker | null>(null);
  const [settings, setSettings] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [active, setActive] = useState<Settings>({ ...DEFAULT_SETTINGS });
  const [source, setSource] = useState<'generated' | 'csv'>('generated');
  const [shape, setShape] = useState<DataShape>('quadratic');
  const [noise, setNoise] = useState(0.18);
  const [csv, setCsv] = useState<{ columns: string[]; rows: string[][]; name: string } | null>(null);
  const [xColumn, setXColumn] = useState('');
  const [yColumn, setYColumn] = useState('');
  const [points, setPoints] = useState<Point[]>(INITIAL_POINTS);
  const [dirty, setDirty] = useState(false);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(5);
  const [pastGeneration, setPastGeneration] = useState<number | null>(null);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [residualAxis, setResidualAxis] = useState<'x' | 'fitted'>('x');
  const [dark, setDark] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const w = new Worker(new URL('./workers/evolution.worker.ts', import.meta.url), { type: 'module' });
    worker.current = w;
    w.onmessage = (event: MessageEvent<WorkerEvent>) => {
      const msg = event.data;
      if (msg.type === 'frame') {
        setFrame(msg.frame);
        setHistory(previous => {
          const generation = msg.frame.generation;
          if (generation.generation === 0) return [generation];
          if (previous.length === generation.generation) return [...previous, generation];
          return [...previous.slice(0, generation.generation), generation];
        });
      }
      if (msg.type === 'running') setRunning(msg.running);
      if (msg.type === 'error') { setError(msg.message); setRunning(false); }
    };
    w.postMessage({ type: 'reset', settings: DEFAULT_SETTINGS, points: INITIAL_POINTS });
    return () => { w.postMessage({ type: 'pause' }); w.terminate(); worker.current = null; };
  }, []);

  const updateSetting = <K extends keyof Settings>(key: K, value: Settings[K]) => {
    setSettings(previous => ({ ...previous, [key]: value }));
    setDirty(true);
  };
  const apply = (start = false, singleStep = false) => {
    try {
      const data = source === 'csv'
        ? pointsFromCsv(csv?.columns ?? [], csv?.rows ?? [], xColumn, yColumn)
        : generateData(shape, noise, 60, settings.seed);
      setError(null); setPoints(data); setActive({ ...settings });
      setFrame(null); setHistory([]); setSelectedPoint(null); setPastGeneration(null);
      setDirty(false); setRunning(false);
      worker.current?.postMessage({ type: 'reset', settings, points: data });
      if (singleStep) worker.current?.postMessage({ type: 'step' });
      if (start) worker.current?.postMessage({ type: 'start', speed });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No fue posible preparar los datos.');
    }
  };
  const play = () => {
    setPastGeneration(null);
    if (dirty) apply(true);
    else worker.current?.postMessage({ type: 'start', speed });
  };
  const pause = () => worker.current?.postMessage({ type: 'pause' });
  const step = () => {
    setPastGeneration(null);
    if (dirty) apply(false, true);
    else worker.current?.postMessage({ type: 'step' });
  };
  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 2_000_000) throw new Error('El CSV supera el límite de 2 MB.');
      const parsed = parseCsv(await file.text());
      setCsv({ ...parsed, name: file.name });
      setXColumn(parsed.columns[0]); setYColumn(parsed.columns[1]);
      setSource('csv'); setDirty(true); setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'CSV inválido');
    }
  };

  const display = pastGeneration === null
    ? frame?.generation : history.find(g => g.generation === pastGeneration) ?? frame?.generation;
  const bestGenes = display?.bestGenes ?? [];
  const metrics = useMemo(
    () => bestGenes.length ? calculateMetrics(points, active.model, bestGenes, active.degree) : null,
    [points, active, display]
  );
  const residuals = useMemo(() => points.map((p, index) => {
    const fitted = bestGenes.length ? predict(active.model, bestGenes, p.x, active.degree) : NaN;
    return { index, x: p.x, y: p.y, fitted, residual: p.y - fitted };
  }), [points, active, display]);
  const palette = {
    line: dark ? '#59c4ff' : '#087cc5',
    population: dark ? '#9789e9' : '#7466ca',
    observed: dark ? '#f5bf69' : '#d38a1b',
    positive: dark ? '#48d6ba' : '#078d75',
    negative: dark ? '#ff8298' : '#dc5470',
    current: dark ? '#b99bff' : '#9c6bdf'
  };
  const plotOption = useMemo<echarts.EChartsOption>(() => {
    const xs = points.map(p => p.x);
    const xmin = Math.min(...xs), xmax = Math.max(...xs);
    const ys = points.map(p => p.y);
    const ymin = Math.min(...ys), ymax = Math.max(...ys);
    const ypad = Math.max(0.6, (ymax - ymin) * 0.25);
    const xGrid = Array.from({ length: 130 }, (_, i) => xmin + (xmax - xmin) * i / 129);
    const plot = (genes: number[]) => xGrid.map(x => {
      const y = predict(active.model, genes, x, active.degree);
      return Number.isFinite(y) && Math.abs(y) < 1e12 ? [x, y] : [x, null];
    });
    const series: echarts.SeriesOption[] = (display?.sampleGenes ?? []).map((genes, i) => ({
      type: 'line', name: 'Individuo ' + (i + 1), data: plot(genes),
      showSymbol: false, silent: true, lineStyle: { color: palette.population, width: 1.15, opacity: 0.26 },
      emphasis: { disabled: true }
    }));
    if (bestGenes.length) series.push({
      type: 'line', name: 'Mejor solución', data: plot(bestGenes),
      showSymbol: false, lineStyle: { color: palette.line, width: 3.3 },
      z: 8
    });
    if (selectedPoint !== null && residuals[selectedPoint] && Number.isFinite(residuals[selectedPoint].fitted)) {
      const p = residuals[selectedPoint];
      series.push({
        type: 'line', name: 'Residuo seleccionado',
        data: [[p.x, p.y], [p.x, p.fitted]], showSymbol: true, symbolSize: 7,
        lineStyle: { color: p.residual >= 0 ? palette.positive : palette.negative, width: 2.2, type: 'dashed' }, z: 10
      });
    }
    series.push({
      type: 'scatter', name: 'Observaciones',
      data: points.map((p, i) => [p.x, p.y, i]),
      symbolSize: 8, itemStyle: { color: palette.observed, borderColor: dark ? '#111e31' : '#ffffff', borderWidth: 1 },
      z: 9
    });
    return {
      ...basicChart(dark), xAxis: { type: 'value', name: 'X', nameLocation: 'end', ...axisStyle(dark) },
      yAxis: { type: 'value', name: 'Y', min: ymin - ypad, max: ymax + ypad, ...axisStyle(dark) }, series
    };
  }, [points, active, display, selectedPoint, residuals, dark]);

  const convergenceOption = useMemo<echarts.EChartsOption>(() => ({
    ...basicChart(dark),
    grid: { left: 54, right: 20, top: 30, bottom: 45 },
    xAxis: { type: 'value', name: 'Generación', min: 0, ...axisStyle(dark) },
    yAxis: { type: 'value', name: 'MSE', min: 0, scale: true, ...axisStyle(dark) },
    series: [
      { type: 'line', name: 'Mejor histórico', data: history.map(h => [h.generation, h.bestEver]),
        showSymbol: false, lineStyle: { color: palette.line, width: 2.5 }, areaStyle: { color: palette.line, opacity: 0.06 } },
      { type: 'line', name: 'Promedio válido', data: history.map(h => [h.generation, h.meanScore]),
        showSymbol: false, lineStyle: { color: palette.population, width: 1.5, type: 'dashed' } }
    ]
  }), [history, dark]);

  const residualOption = useMemo<echarts.EChartsOption>(() => {
    const valid = residuals.filter(r => Number.isFinite(r.residual) && Number.isFinite(r.fitted));
    const sourceData = (positive: boolean) => valid.filter(r => positive ? r.residual >= 0 : r.residual < 0)
      .map(r => [residualAxis === 'x' ? r.x : r.fitted, r.residual, r.index]);
    return {
      ...basicChart(dark),
      xAxis: { type: 'value', name: residualAxis === 'x' ? 'X' : 'Predicción', ...axisStyle(dark) },
      yAxis: { type: 'value', name: 'Residuo', scale: true, ...axisStyle(dark) },
      series: [
        { type: 'scatter', name: 'Residuos positivos', data: sourceData(true),
          symbolSize: 8, itemStyle: { color: palette.positive } },
        { type: 'scatter', name: 'Residuos negativos', data: sourceData(false),
          symbolSize: 8, itemStyle: { color: palette.negative },
          markLine: { symbol: 'none', silent: true, label: { show: false },
            lineStyle: { color: dark ? '#8191a7' : '#75849a', type: 'dashed', width: 1 },
            data: [{ yAxis: 0 }] } }
      ]
    };
  }, [residuals, residualAxis, dark]);

  const download = (name: string, mime: string, content: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const exportResiduals = () => {
    const lines = ['x,y_observado,y_predicho,residuo,residuo_cuadrado'];
    for (const r of residuals) {
      lines.push([r.x, r.y, r.fitted, r.residual, r.residual * r.residual]
        .map(v => Number.isFinite(v) ? String(v) : '').join(','));
    }
    download('xcurve-residuos-generacion-' + (display?.generation ?? 0) + '.csv',
      'text/csv;charset=utf-8', '\uFEFF' + lines.join('\r\n'));
  };
  const exportExperiment = () => {
    const result = {
      software: 'XCurveFitLab Playground',
      version: '0.1.0',
      settings: active,
      dataset: points,
      history,
      viewedGeneration: display?.generation ?? 0,
      bestGenes,
      metrics,
      residuals
    };
    download('xcurve-experimento.json', 'application/json;charset=utf-8', JSON.stringify(result, null, 2));
  };

  const total = active.generations;
  const latestGeneration = frame?.generation.generation ?? 0;
  const viewing = display?.generation ?? latestGeneration;
  const selected = selectedPoint !== null ? residuals[selectedPoint] : null;
  const isFinished = frame?.finished ?? false;

  return <div className={'app-shell ' + (dark ? 'theme-dark' : 'theme-light')}>
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark"><Activity size={23} strokeWidth={2.6} /></div>
        <div><div className="brand-name">XCurveFit<span>Lab</span></div><div className="brand-subtitle">EVOLUTION PLAYGROUND</div></div>
      </div>
      <div className="topbar-right">
        <span className="project-tag"><span className="status-dot" /> MOTOR GENÉTICO</span>
        <button className="theme-button" onClick={() => setDark(!dark)} title="Cambiar tema" aria-label="Cambiar tema visual">
          {dark ? <Sun size={19} /> : <Moon size={19} />}
        </button>
        <a className="github-link" href="https://github.com/matepraxis/XCurveFitlab-Playground" target="_blank" rel="noreferrer">
          GitHub <ArrowRight size={15} />
        </a>
      </div>
    </header>
    <main className="workspace">
      <aside className="sidebar">
        <div className="sidebar-header">
          <div><span className="eyebrow">LABORATORIO</span><h2>Tu experimento</h2></div>
          <Settings2 size={20} />
        </div>
        <section className="control-section">
          <div className="section-title"><Layers3 size={16} /><span>01 · Datos</span></div>
          <div className="source-toggle">
            <button className={source === 'generated' ? 'active' : ''} onClick={() => { setSource('generated'); setDirty(true); }}>Ejemplo</button>
            <button className={source === 'csv' ? 'active' : ''} onClick={() => { setSource('csv'); setDirty(true); }}>Archivo CSV</button>
          </div>
          {source === 'generated' ? <>
            <label className="input-field"><span>Conjunto de datos</span>
              <select value={shape} onChange={e => { setShape(e.target.value as DataShape); setDirty(true); }}>
                {SHAPES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </label>
            <FieldSlider label="Ruido" value={noise} min={0} max={1.5} step={0.03}
              onChange={v => { setNoise(v); setDirty(true); }} format={v => v.toFixed(2)} />
          </> : <>
            <label className="upload-zone">
              <Upload size={20} />
              <span>{csv?.name ?? 'Seleccionar archivo CSV'}</span>
              <small>Con encabezados y columnas numéricas</small>
              <input type="file" accept=".csv,text/csv" onChange={openFile} />
            </label>
            {csv && <>
              <label className="input-field"><span>Columna X</span><select value={xColumn} onChange={e => { setXColumn(e.target.value); setDirty(true); }}>
                {csv.columns.map(c => <option key={c}>{c}</option>)}
              </select></label>
              <label className="input-field"><span>Columna Y</span><select value={yColumn} onChange={e => { setYColumn(e.target.value); setDirty(true); }}>
                {csv.columns.map(c => <option key={c}>{c}</option>)}
              </select></label>
            </>}
          </>}
        </section>
        <section className="control-section">
          <div className="section-title"><Dna size={16} /><span>02 · Genotipo</span></div>
          <label className="input-field"><span>Familia de funciones</span>
            <select value={settings.model} onChange={e => updateSetting('model', e.target.value as ModelKind)}>
              {MODELS.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
            </select>
          </label>
          {settings.model === 'polynomial' && <label className="input-field"><span>Grado del polinomio</span>
            <select value={settings.degree} onChange={e => updateSetting('degree', Number(e.target.value))}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Grado {n}</option>)}
            </select>
          </label>}
          <div className="gene-display">
            <span className="micro-label">ESTRUCTURA DEL CROMOSOMA</span>
            <div className="gene-list">{geneNames(settings.model, settings.degree).map((g, i) => <span className="gene-chip" key={i}>{g}</span>)}</div>
            <small>{modelFormula(settings.model, settings.degree)}</small>
          </div>
          <details className="learning-note">
            <summary>¿Qué representa un cromosoma?</summary>
            <p>Es una posible curva. Cada gen es un parámetro de la función escogida. La selección favorece individuos con menor MSE; el cruce combina genes y la mutación los modifica aleatoriamente.</p>
          </details>
        </section>
        <section className="control-section">
          <div className="section-title"><Settings2 size={16} /><span>03 · Evolución</span></div>
          <FieldSlider label="Población" min={20} max={500} step={10} value={settings.populationSize}
            onChange={v => updateSetting('populationSize', v)} />
          <FieldSlider label="Mutación" min={0} max={0.5} step={0.005} value={settings.mutationRate}
            format={v => (v * 100).toFixed(1) + '%'} onChange={v => updateSetting('mutationRate', v)} />
          <FieldSlider label="Cruce" min={0} max={1} step={0.025} value={settings.crossoverRate}
            format={v => (v * 100).toFixed(1) + '%'} onChange={v => updateSetting('crossoverRate', v)} />
          <FieldSlider label="Generaciones" min={50} max={2000} step={50} value={settings.generations}
            onChange={v => updateSetting('generations', v)} />
          <FieldSlider label="Elitismo" min={0} max={Math.min(10, settings.populationSize - 1)} step={1} value={settings.elitism}
            onChange={v => updateSetting('elitism', v)} />
          <FieldSlider label="Rango de genes (±)" min={2} max={20} step={1} value={settings.searchBound}
            onChange={v => updateSetting('searchBound', v)} />
          <label className="input-field"><span>Semilla reproducible</span><input type="number" min={1} step={1} value={settings.seed}
            onChange={e => updateSetting('seed', Math.max(1, Math.trunc(Number(e.target.value) || 1)))} /></label>
          <div className="tip"><CircleHelp size={15} /><span>El programa conserva la mejor solución histórica. El promedio de la población puede subir o bajar.</span></div>
        </section>
        <button className="apply-button" onClick={() => apply()}><RotateCcw size={16} /> {dirty ? 'Aplicar configuración' : 'Reiniciar experimento'}</button>
      </aside>

      <section className="main-area">
        <div className="content-header">
          <div><div className="eyebrow"><FlaskConical size={14} /> EXPLORACIÓN MATEMÁTICA EN TIEMPO REAL</div>
            <h1>Observa cómo <span>evoluciona</span> una solución.</h1>
            <p>Configura el genotipo, experimenta con los operadores y descubre qué revelan los residuos.</p>
          </div>
          <div className="experiment-state"><span className={'live-dot ' + (running ? 'animating' : '')} />
            {running ? 'Evolucionando' : isFinished ? 'Completado' : 'En pausa'}</div>
        </div>

        {error && <div className="error-banner" role="alert">{error}</div>}
        {dirty && <div className="pending-banner">Hay cambios pendientes. Pulsa «Aplicar configuración» o inicia una corrida nueva.</div>}

        <div className="stats-row">
          <div className="stat-card"><div className="stat-label">GENERACIÓN</div><div className="stat-value">{viewing}<span className="stat-suffix"> / {total}</span></div><div className="stat-caption">Progreso evolutivo</div></div>
          <div className="stat-card"><div className="stat-label">MEJOR MSE</div><div className="stat-value accent-blue">{formatValue(display?.bestEver)}</div><div className="stat-caption">Mejor histórico</div></div>
          <div className="stat-card"><div className="stat-label">R²</div><div className="stat-value accent-violet">{formatValue(metrics?.r2, 4)}</div><div className="stat-caption">Puede ser negativo</div></div>
          <div className="stat-card"><div className="stat-label">DIVERSIDAD</div><div className="stat-value">{formatValue(display?.diversity)}</div><div className="stat-caption">Dispersión genética</div></div>
        </div>

        <div className="viz-grid">
          <article className="viz-card primary-chart">
            <div className="card-header"><div><div className="card-eyebrow">ESPACIO DE SOLUCIONES</div><h3>Ajuste y población</h3></div><span className="pill">Gen. {viewing}</span></div>
            <EChart option={plotOption} onPoint={setSelectedPoint} />
            <div className="chart-legend"><span><i className="legend-dot gold" /> Observaciones</span><span><i className="legend-line blue" /> Mejor histórico</span><span><i className="legend-line violet" /> Otras soluciones</span></div>
            <p className="chart-footnote">Eje Y fijado a los datos: algunas soluciones iniciales pueden quedar fuera de escala.</p>
          </article>
          <article className="viz-card residual-chart">
            <div className="card-header"><div><div className="card-eyebrow">DIAGNÓSTICO ESTADÍSTICO</div><h3>Análisis de residuos</h3></div>
              <div className="chart-switch"><button className={residualAxis === 'x' ? 'active' : ''} onClick={() => setResidualAxis('x')}>vs X</button><button className={residualAxis === 'fitted' ? 'active' : ''} onClick={() => setResidualAxis('fitted')}>vs ŷ</button></div>
            </div>
            <EChart option={residualOption} onPoint={setSelectedPoint} />
            <div className="diagnostic-tip">
              <ChartScatter size={17}/><span>{selected
                ? 'Punto ' + (selected.index + 1) + ': observado ' + formatValue(selected.y) + ', predicho ' + formatValue(selected.fitted) + ', residuo ' + formatValue(selected.residual)
                : 'Selecciona un punto para ver su error (y − ŷ). Busca patrones, sesgos y dispersión desigual.'}</span>
            </div>
            <details className="learning-note residual-help">
              <summary>¿Cómo interpreto los residuos?</summary>
              <p>Un residuo positivo significa que la observación está por encima de la curva. Uno negativo, por debajo. Si forman una curvatura o un embudo, puede existir un patrón que el modelo no explica. Un MSE pequeño no garantiza la ausencia de esos patrones.</p>
            </details>
          </article>
          <article className="viz-card convergence-card">
            <div className="card-header"><div><div className="card-eyebrow">HISTORIA GENERACIONAL</div><h3>Convergencia del error</h3></div><span className="pill">MSE ↓</span></div>
            <EChart option={convergenceOption} className="compact" />
            <div className="chart-legend"><span><i className="legend-line blue" /> Mejor histórico</span><span><i className="legend-line violet" /> Promedio de individuos válidos</span></div>
          </article>
          <article className="viz-card genotype-card">
            <div className="card-header"><div><div className="card-eyebrow">INDIVIDUO DESTACADO</div><h3>Su genotipo</h3></div><Dna size={19} className="dim-icon"/></div>
            <p className="equation-name">{modelFormula(active.model, active.degree)}</p>
            <div className="gene-values">{geneNames(active.model, active.degree).map((g, i) => <div key={g}><span>{g}</span><strong>{formatValue(bestGenes[i], 4)}</strong></div>)}</div>
            <div className="metrics-strip">
              <div><span>RMSE</span><strong>{formatValue(metrics?.rmse)}</strong></div>
              <div><span>MAE</span><strong>{formatValue(metrics?.mae)}</strong></div>
              <div><span>Válidos</span><strong>{display?.validCount ?? '—'}/{active.populationSize}</strong></div>
            </div>
          </article>
        </div>

        <div className="playback-panel">
          <div className="playback-top"><div><span className="card-eyebrow">CONTROL EVOLUTIVO</span><h3>Explora las generaciones</h3></div>
            <div className="play-controls">
              <button className="control-button subtle" title="Reiniciar" onClick={() => apply()}><RotateCcw size={18}/></button>
              {running ? <button className="control-button play-control" onClick={pause}><Pause size={18} fill="currentColor"/> Pausar</button> :
                <button className="control-button play-control" onClick={play} disabled={isFinished && !dirty}><Play size={18} fill="currentColor"/> Iniciar</button>}
              <button className="control-button subtle" title="Avanzar una generación" onClick={step} disabled={isFinished && !dirty}><SkipForward size={19}/></button>
            </div>
          </div>
          <input className="timeline" type="range" min={0} max={Math.max(1, latestGeneration)} step={1}
            value={viewing} onChange={e => { pause(); setPastGeneration(Number(e.target.value)); }}
            aria-label="Consultar una generación anterior" />
          <div className="timeline-footer"><span>Gen. 0</span><span className="timeline-caption">Arrastra para revisar las generaciones anteriores</span><span>Gen. {latestGeneration}</span></div>
          <div className="speed-control"><span>Velocidad</span><input type="range" min={1} max={30} value={speed} onChange={e => {
            const newSpeed = Number(e.target.value); setSpeed(newSpeed);
            if (running) worker.current?.postMessage({ type: 'start', speed: newSpeed });
          }} /><strong>{speed}×</strong></div>
        </div>
        <div className="export-actions">
          <span>Descarga los resultados para analizar o documentar el experimento:</span>
          <div><button disabled={!metrics?.valid} onClick={exportResiduals}><Download size={15}/> Exportar residuos CSV</button>
          <button disabled={!frame} onClick={exportExperiment}><Download size={15}/> Exportar experimento JSON</button></div>
        </div>
        <div className="footer-note"><FlaskConical size={16}/><span>Un MSE menor no prueba por sí solo que el modelo sea adecuado. Interpreta el patrón de los residuos y compara familias de funciones.</span>
          <a href="https://github.com/matepraxis/Xcurvefitlab" target="_blank" rel="noreferrer">Proyecto de origen <Download size={13}/></a>
        </div>
      </section>
    </main>
  </div>;
}

export default App;
