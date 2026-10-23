import { expect, test } from '@playwright/test';

test('carga el laboratorio y renderiza tres gráficas', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Observa cómo evoluciona/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Análisis de residuos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Evolución y control generacional' })).toBeVisible();
  await expect(page.locator('.chart-canvas canvas')).toHaveCount(3);
  await expect(page.locator('.stat-card').first()).toContainText('0');
  expect(failures).toEqual([]);
});

test('cambia genotipo y ejecuta una generación real', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Familia de funciones').selectOption('trigonometric');
  await expect(page.locator('.gene-chip')).toHaveCount(5);
  await page.getByRole('button', { name: 'Aplicar configuración' }).click();
  await page.locator('[title="Avanzar una generación"]').click();
  await expect(page.locator('.stat-card').first()).toContainText('1 /');
  await page.getByRole('button', { name: 'Iniciar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar', exact: true })).toBeVisible();
});

test('acepta CSV con delimitador semicolon y selecciona columnas', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Archivo CSV' }).click();
  const content = 'tiempo;valor;serie\n0;2,5;"A"\n1;3,5;"A"\n2;5,5;"A"\n3;7,5;"A"\n4;11,5;"B"';
  await page.locator('input[type=file]').setInputFiles({
    name: 'datos.csv', mimeType: 'text/csv', buffer: Buffer.from(content, 'utf8')
  });
  await expect(page.getByText('datos.csv')).toBeVisible();
  await page.getByRole('button', { name: 'Aplicar configuración' }).click();
  await expect(page.locator('.stat-card').first()).toContainText('0 /');
  await expect(page.locator('.error-banner')).toHaveCount(0);
});

test('muestra advertencia de CSV inválido sin bloquear la aplicación', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Archivo CSV' }).click();
  await page.locator('input[type=file]').setInputFiles({
    name: 'mal.csv', mimeType: 'text/csv', buffer: Buffer.from('x,y\n1,2\n3,"sin cierre', 'utf8')
  });
  await expect(page.getByRole('alert')).toContainText('Comillas sin cerrar');
  await expect(page.getByRole('heading', { name: 'Análisis de residuos' })).toBeVisible();
});

test('tema claro y oscuro y paneles visibles en móvil', async ({ page, isMobile }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Cambiar tema visual' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/theme-light/);
  await page.getByRole('button', { name: 'Cambiar tema visual' }).click();
  await expect(page.locator('.app-shell')).toHaveClass(/theme-dark/);
  if (isMobile) {
    const size = await page.evaluate(() => ({ viewport: innerWidth, body: document.body.scrollWidth }));
    expect(size.body).toBeLessThanOrEqual(size.viewport + 2);
  }
});

test('exporta residuos e historial sin servidor externo', async ({ page }) => {
  await page.goto('/');
  // La configuración solo muestra candidatos iniciales; los residuos requieren evolución real.
  await expect(page.getByRole('button', { name: 'Exportar residuos CSV' })).toBeDisabled();
  await page.locator('[title="Avanzar una generación"]').click();
  await expect(page.getByRole('button', { name: 'Exportar residuos CSV' })).toBeEnabled();
  const residualDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar residuos CSV' }).click();
  expect((await residualDownload).suggestedFilename()).toContain('xcurve-residuos-generacion-1.csv');
  const experimentDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Exportar experimento JSON' }).click();
  expect((await experimentDownload).suggestedFilename()).toBe('xcurve-experimento.json');
});

test('aplicar configuración prepara una población inicial sin presentar un ajuste final', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Familia de funciones').selectOption('polynomial');
  await page.getByRole('button', { name: 'Aplicar configuración' }).click();
  await expect(page.getByText('Curvas candidatas aleatorias,')).toBeVisible();
  await expect(page.locator('.stat-card').first()).toContainText('0 /');
  await expect(page.locator('.stat-card').nth(1)).toContainText('—');
  await expect(page.getByRole('heading', { name: 'Genotipo por descubrir' })).toBeVisible();
  await page.waitForTimeout(1200);
  await expect(page.locator('.stat-card').first()).toContainText('0 /');
  await expect(page.locator('.evolution-controls')).toHaveCount(1);
  await expect(page.locator('.convergence-card .evolution-controls [title="Avanzar una generación"]')).toBeVisible();
  await page.locator('.convergence-card [title="Avanzar una generación"]').click();
  await expect(page.locator('.stat-card').first()).toContainText('1 /');
  await expect(page.getByRole('heading', { name: 'Mejor genotipo' })).toBeVisible();
  await expect(page.locator('.stat-card').nth(1)).not.toContainText('—');
});
