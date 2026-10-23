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

    npm install
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

Este primer prototipo debe superar las pruebas y una validación en navegador antes de publicarse en Render. En las siguientes fases incorporaremos importación CSV robusta (comillas y separadores regionales), diagramas de linajes de los individuos, mejores diagnósticos residuales, exportación, comparación de corridas y evaluación de rendimiento con poblaciones grandes.

Este proyecto es una herramienta didáctica y experimental. No sustituye una validación formal de supuestos estadísticos.
