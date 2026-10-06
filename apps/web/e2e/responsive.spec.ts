// F14.1 — the shell follows docs/screens.md#shell at 390, 834 and 1440 px (screenshots go to test-results/).
import { expect, test } from '@playwright/test';
import { onboardCar, registerChange } from './helpers.ts';

const sizes = [
  { name: 'mobile', width: 390, height: 844 },
  { name: 'tablet', width: 834, height: 1112 },
  { name: 'desktop', width: 1440, height: 900 },
] as const;

for (const size of sizes) {
  test(`painel, itens e histórico em ${size.width}px`, async ({ page }, info) => {
    await page.setViewportSize({ width: size.width, height: size.height });
    await onboardCar(page);
    await registerChange(page, 'Óleo do motor', '45.000');
    await expect(page.getByRole('status').filter({ hasText: 'Troca registrada' })).toBeVisible();

    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    if (size.name === 'mobile') {
      await expect(nav).toHaveCSS('height', '74px');
      await expect(page.getByRole('link', { name: 'Consultar placa' })).toHaveCount(0);
    } else if (size.name === 'tablet') {
      await expect(page.getByRole('link', { name: 'Consultas' })).toBeVisible();
    } else {
      await expect(page.getByRole('link', { name: 'Consultar placa' })).toBeVisible();
      await expect(page.getByRole('img', { name: 'QueroRevisar' }).first()).toBeVisible();
    }
    await page.screenshot({ path: info.outputPath(`painel-${size.width}.png`), fullPage: true });

    await page.getByRole('link', { name: 'Itens' }).click();
    await page.getByRole('button', { name: 'Precisa de atenção' }).click();
    if (size.name !== 'mobile') await expect(page.getByText('Situação').first()).toBeVisible();
    await page.screenshot({ path: info.outputPath(`itens-${size.width}.png`), fullPage: true });

    await page.getByRole('link', { name: 'Histórico' }).click();
    await expect(page.getByText('Trocas registradas')).toBeVisible();
    if (size.name !== 'mobile') await expect(page.getByText('Custo', { exact: true })).toBeVisible();
    await page.screenshot({ path: info.outputPath(`historico-${size.width}.png`), fullPage: true });
  });
}
