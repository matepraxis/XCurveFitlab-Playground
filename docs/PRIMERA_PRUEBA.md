# Primera prueba de XCurveFitLab Playground

## Preparación
- [ ] GitHub Actions marca las pruebas matemáticas, build y navegador como exitosas.
- [ ] Conectar repo matepraxis/XCurveFitlab-Playground a Render como sitio estático, sin backend.
- [ ] Comando de compilación: npm ci --no-audit --no-fund && npm run build.
- [ ] Directorio público: dist. Node 22.
- [ ] Verificar que el frontend abra y que Web Workers cargue en el sitio público.

## Escenarios de prueba (registrar resultados)
1. **Inicio**: datos parabólicos cargados; población 100, generaciones 500. Generación inicial 0.
2. **Evolución**: pulsar avanzar (pasa a 1), iniciar, pausar, reanudar y reiniciar. No debe haber avances dobles ni bloqueo.
3. **Operadores**: mutación 0,0 y 0,5; cruce 0,0 y 1; elitismo 0 y 2. Comparar resultados sin esperar progreso estrictamente monótono en la media.
4. **Modelos**: lineal, polinómico grados 1–5, exponencial, logarítmico, trigonométrico, logístico. Los cromosomas cambian de tamaño.
5. **Diagnóstico**: pulsar punto; residuos e_i = y_i - ypred_i, y gráfico frente a X o predicción. R² negativo no se sustituye por 0.
6. **Convergencia**: mejor histórico no crece; MSE promedio puede oscilar. Verificar que las curvas evolucionan de verdad.
7. **CSV**: dos columnas numéricas, delimitador punto y coma y decimales con coma; invalidar CSV vacío o comillas mal cerradas.
8. **Reproducibilidad**: mismo modelo, dataset, semilla y parámetros deben generar el mismo historial.
9. **Pantallas**: móvil y escritorio, tema claro/oscuro, sin desbordamiento horizontal ni controles inaccesibles.
10. **Carga**: 500 individuos y 2000 generaciones deben poder pausarse, sin bloquear los controles de la página.

## Criterios de aprobación
- 0 errores no controlados en la consola durante estos escenarios.
- Tests unitarios y smoke del navegador en verde.
- Contraste numérico de ecuaciones/residuos con cálculos independientes.
- Ningún cambio en repo de escritorio.
- No desplegar hasta concluir los controles de calidad en GitHub.

## Limitaciones reconocidas
- La primera versión es una simulación educativa, no incorpora todavía validación cruzada ni bandas de incertidumbre.
- No hay guardado automático de corridas ni comparación simultánea de poblaciones.
- La importación acepta CSV delimitado por coma/punto y coma y celdas entrecomilladas, pero no formatos Excel ni separación por tabuladores.
- Las funciones de alta complejidad pueden requerir ampliar visualización/logística más adelante.

## Registro manual
| Fecha | Ambiente | Escenario | Resultado | Observaciones |
|---|---|---|---|---|
| | | | | |
