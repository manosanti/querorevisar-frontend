import { expect, type Page } from '@playwright/test';

export const API = process.env.E2E_API_URL ?? 'http://localhost:8080';

/** Picks an option in the QR Select: opens it, types in its search and chooses the first match. */
export async function pick(page: Page, label: string, search: string) {
  await page.getByRole('button', { name: label, exact: true }).click();
  const box = page.getByRole('textbox', { name: 'Buscar' });
  if (await box.isVisible().catch(() => false)) await box.fill(search);
  const option = page
    .getByRole('option')
    .filter({ hasText: new RegExp(search, 'i') })
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

/** Fresh anonymous user → onboarding → Painel with a Chevrolet Onix. */
export async function onboardCar(page: Page, km = '48.000') {
  await page.goto('/');
  await expect(page.getByText('Entre para ver seus veículos e alertas')).toBeVisible();
  await page.getByRole('button', { name: 'Continuar sem conta' }).click();
  await expect(page.getByRole('heading', { name: 'Qual é o seu veículo?' })).toBeVisible();
  await page.getByRole('radio', { name: 'Carro' }).click();
  await pick(page, 'Marca', 'Chevrolet');
  await pick(page, 'Modelo', 'Onix');
  await pick(page, 'Ano', '2019');
  await page.getByPlaceholder('48.000').fill(km);
  await page.getByRole('button', { name: 'Começar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Veículo cadastrado' })).toBeVisible();
  await expect(page.getByText('Precisa de atenção')).toBeVisible();
}

export async function registerChange(page: Page, item: string, km: string) {
  await page.getByRole('button', { name: 'Registrar troca' }).first().click();
  const sheet = page.getByRole('dialog', { name: 'Registrar troca' });
  await sheet.getByRole('textbox', { name: 'Buscar item' }).fill(item);
  await sheet
    .getByRole('button', { name: new RegExp(`^${item}`) })
    .first()
    .click();
  await sheet.locator('input[inputmode="numeric"]').fill(km);
  await sheet.getByRole('button', { name: 'Salvar' }).click();
}

/** Token of the signed-in user (dev auth stores it in localStorage; Supabase under qr-auth). */
export async function accessToken(page: Page): Promise<string> {
  return page.evaluate(() => {
    const dev = localStorage.getItem('qr-dev-session');
    if (dev) return (JSON.parse(dev) as { accessToken: string }).accessToken;
    const sb = localStorage.getItem('qr-auth');
    return sb ? (JSON.parse(sb) as { access_token: string }).access_token : '';
  });
}

export async function serverState(page: Page) {
  const token = await accessToken(page);
  const res = await page.request.get(`${API}/v1/sync`, { headers: { Authorization: `Bearer ${token}` } });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as {
    me: { plan: string; credits: number; isAnonymous: boolean; email: string | null };
    vehicles: Array<{ id: string; model: string; km: number }>;
    records: Array<{ id: string; itemId: string; km: number }>;
  };
}
