// Accessibility regression guard (axe, WCAG 2 A/AA) on the main screens.
// color-contrast is excluded until the owner decides on the --subtle token (PENDENCIAS.md › Acessibilidade).
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { onboardCar } from './helpers.ts';

const screens = [
  ['Painel', '/'],
  ['Itens', '/itens'],
  ['Histórico', '/historico'],
  ['Conta', '/conta'],
  ['Consultas', '/consultas'],
] as const;

test('telas principais sem violações de acessibilidade', async ({ page }) => {
  await onboardCar(page);
  for (const [name, path] of screens) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const result = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    expect(result.violations.map(v => `${name}: ${v.id} (${v.nodes.length})`)).toEqual([]);
  }
});

test('login sem violações de acessibilidade', async ({ page }) => {
  await page.goto('/entrar');
  await expect(page.getByText('Entre para ver seus veículos e alertas')).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(result.violations.map(v => v.id)).toEqual([]);
});
