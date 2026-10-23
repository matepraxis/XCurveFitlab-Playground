import { expect, test } from '@playwright/test';

test('carga el laboratorio y renderiza tres gráficas', async ({ page }) => {
  const failures: string[] = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /Observa cómo evoluciona/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Análisis de residuos' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Convergencia del error' })).toBeVisible();
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
  await page.getByRole('button', { name: 'Iniciar' }).click();
  await expect(page.getByRole('button', { name: 'Pausar' })).toBeVisible();
  await page.getByRole('button', { name: 'Pausar' }).click();
  await expect(page.getByRole('button', { name: 'Iniciar' })).toBeVisible();
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
