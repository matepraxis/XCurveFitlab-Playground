# XCurveFitLab Playground

Laboratorio web interactivo de **ajuste de curvas mediante algoritmos genéticos**, evolución de poblaciones y **análisis de residuos**, inspirado en la experiencia de TensorFlow Playground.

Proyecto independiente de [XCurveFitLab de escritorio](https://github.com/matepraxis/Xcurvefitlab), desarrollado originalmente por Diego Alejandro Marulanda Patiño.

## Primer prototipo (MVP)

- Seis familias matemáticas: lineal, polinómica (grado 1 a 5), exponencial, logarítmica, trigonométrica y logística.
- El usuario escoge la función: esa elección determina la estructura del cromosoma y sus genes.
- Controles de población, generaciones, mutación, cruce, elitismo, espacio de búsqueda y semilla reproducible.
- Selección por torneo, cruzamiento uniforme por gen y mutación estocástica.
- Exploración de generaciones: reproducir, pausar, avanzar individualmente, consultar el historial y reiniciar.
- Gráficas de población y mejor ajuste, convergencia del MSE y residuos frente a X o frente a valores predichos.
- Selección interactiva de observaciones para consultar el residuo observado menos predicho.
- MSE, RMSE, MAE y R²; R² negativo se conserva. Valores fuera del dominio se identifican como inválidos.
- Datos sintéticos con ruido configurable y carga de CSV con selección de columnas X/Y.
- Cálculo en un Web Worker para mantener la interfaz reactiva.

## Ejecutar

Requisitos: Node.js 20.19+ o Node.js 22.

    npm ci
    npm run dev

Pruebas y compilación:

    npm test
    npm run build

## Decisiones matemáticas

- Cada individuo es un vector de parámetros reales que describe una curva de la familia seleccionada.
- Los genes se inicializan en un espacio amplio, lo que produce ajustes iniciales potencialmente deficientes. La disminución del MSE se obtiene de la selección, cruce y mutación, no de valores dibujados de manera artificial.
- La aptitud **se recalcula después** del cruzamiento y la mutación. El seguimiento distingue entre el mejor histórico (que no aumenta por diseño) y el error medio de los individuos válidos (que puede oscilar).
- La métrica R² puede ser negativa; si la variabilidad del objetivo es cero se informa como no definida.
- Los residuos son e_i = y_i - f(x_i). El gráfico de residuos puede revelar estructura incluso cuando el MSE disminuye.
- Si un modelo es indefinido para algún X, esa solución se invalida sin sustituir silenciosamente los resultados.
- Los gráficos representan snapshots generacionales reales calculados por el motor.

## Arquitectura

React + TypeScript + Vite + Apache ECharts para interfaz y gráficas; un Web Worker con núcleo matemático reproducible mediante semilla. Diseño oscuro/claro y adaptación a pantallas pequeñas.

Código relevante:
- src/engine.ts: modelos matemáticos, cromosomas, dataset, métricas y evolución.
- src/engine.test.ts: comprobaciones del motor y análisis residual.
- src/workers/evolution.worker.ts: ejecución del algoritmo sin bloquear la interfaz.
- src/App.tsx y src/styles.css: playground y diseño visual.
- .github/workflows/ci.yml: verificación automática de pruebas y compilación.

## Alcance y siguientes etapas

Este primer prototipo debe superar las pruebas y una validación en navegador antes de publicarse en Render. La importación CSV ya maneja comillas y separadores regionales habituales; exportación de residuos e historial también está disponible. En siguientes fases incorporaremos diagramas de linajes, mejores diagnósticos residuales, comparación de corridas y evaluación de rendimiento con poblaciones grandes.

Este proyecto es una herramienta didáctica y experimental. No sustituye una validación formal de supuestos estadísticos.


## Preparación para Render

El repositorio incluye render.yaml, .node-version (Node 22) y package-lock.json.
Para la primera publicación, conectar este repositorio como **Static Site** / Blueprint:
- buildCommand: npm ci --no-audit --no-fund && npm run build
- staticPublishPath: dist
- rama: main
- no requiere backend, variables secretas, puertos ni comando start.

La publicación **no se realiza automáticamente por agregar** render.yaml.
La revisión en GitHub debe aprobar pruebas unitarias, compilación y pruebas Playwright en Chromium de escritorio y móvil.
Ejecutar localmente npm run test:e2e tras instalar navegadores con npx playwright install chromium.

## Evidencias y análisis

Los controles «Exportar residuos CSV» y «Exportar experimento JSON» descargan observaciones,
predicciones y errores, junto con parámetros genéticos, semilla e historial poblacional.
Una ronda con la misma semilla y configuración es reproducible. La simulación ocurre en el navegador.
Para la prueba inicial seguir docs/PRIMERA_PRUEBA.md.


## Vista previa desde GitHub Pages (sin Render)

Este repositorio incluye el workflow manual `.github/workflows/pages.yml` para publicar una vista de prueba de XCurveFitLab Playground.

**Activación inicial (una sola vez):**

1. Abrir Settings → Pages en este repositorio.
2. En Build and deployment → Source, elegir **GitHub Actions**.
3. Ir a Actions → **Preview on GitHub Pages** → Run workflow (rama main).
4. Comprobar que el workflow termine correctamente y abrir la URL de Pages desde la ejecución o Settings → Pages.

Dirección prevista después de una publicación exitosa: https://matepraxis.github.io/XCurveFitlab-Playground/

El workflow solo se ejecuta manualmente y usa el parámetro de Vite `--base=/XCurveFitlab-Playground/` para que JavaScript, estilos y Web Workers se carguen correctamente en la subruta. No despliega a Render, no modifica el archivo `render.yaml` y no activa un despliegue automático en cada commit.


## Experiencia didáctica: evolución genuina paso a paso

**Aplicar configuración no optimiza ni muestra una curva ganadora.** Inicializa una población aleatoria (generación 0), con muestras de cromosomas candidatos y sus distintas curvas, y deja el simulador en pausa.

La **gráfica de convergencia y los controles evolutivos están integrados en un único panel**. El estudiante puede:
- Pulsar **Paso** para ejecutar exactamente una generación (selección, cruce, mutación, evaluación).
- Pulsar **Iniciar** para observar generaciones a velocidad didáctica (1× por defecto, unos 900 ms por generación).
- Pausar, reiniciar o explorar una generación anterior mediante el deslizador.
- Ver cómo una curva destacada surge después de iniciar el proceso evolutivo, sin confundir la evaluación inicial de cromosomas con generaciones evolucionadas.
- Consultar los residuos y métricas de la solución histórica únicamente después de la primera generación.

Las curvas dibujadas son individuos reales, no trayectorias prediseñadas. El MSE medio puede subir o bajar; el mejor histórico se conserva. En la línea temporal no se dibujan generaciones posteriores a la seleccionada.
