// F14.1 — critical flows end to end against the local API in mock mode.
import { expect, test } from '@playwright/test';
import { onboardCar, registerChange, serverState } from './helpers.ts';

test('primeiro veículo', async ({ page }) => {
  await onboardCar(page);
  await expect(page.getByRole('region', { name: /Onix/ })).toContainText('48.000');
  const state = await serverState(page);
  expect(state.vehicles.map(v => v.model)).toEqual([expect.stringMatching(/Onix/i)]);
});

test('registrar troca', async ({ page }) => {
  await onboardCar(page);
  await registerChange(page, 'Óleo do motor', '45.000');
  await expect(page.getByRole('status').filter({ hasText: 'Troca registrada' })).toBeVisible();
  await page.getByRole('link', { name: 'Histórico' }).click();
  await expect(page.getByText('Óleo do motor')).toBeVisible();
  await expect.poll(async () => (await serverState(page)).records.length).toBe(1);
});

test('atualizar km', async ({ page }) => {
  await onboardCar(page);
  await page.getByRole('button', { name: 'Atualizar km' }).click();
  const sheet = page.getByRole('dialog', { name: 'Atualizar km' });
  await expect(sheet.getByText('Rodou quanto?')).toBeVisible();
  await sheet.getByRole('textbox', { name: 'Km no painel' }).fill('49.500');
  await sheet.getByRole('button', { name: 'Salvar' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Km atualizada' })).toBeVisible();
  await expect.poll(async () => (await serverState(page)).vehicles[0]?.km).toBe(49500);
});

test('offline e sync: a troca registrada sem rede chega ao servidor uma única vez', async ({ page, context }) => {
  await onboardCar(page);
  await expect.poll(async () => (await serverState(page)).vehicles.length).toBe(1);
  await context.setOffline(true);
  await registerChange(page, 'Filtro de ar', '46.000');
  await expect(page.getByRole('status').filter({ hasText: 'Troca registrada' })).toBeVisible();
  await expect(page.getByText(/Sem conexão/)).toBeVisible();
  await context.setOffline(false);
  await expect(page.getByText(/Sem conexão/)).toBeHidden();
  await expect.poll(async () => (await serverState(page)).records.length, { timeout: 40_000 }).toBe(1);
  await page.reload();
  await expect(page.getByText('Precisa de atenção')).toBeVisible();
  expect((await serverState(page)).records).toHaveLength(1);
});

test('criar conta a partir do anônimo sem perder dados', async ({ page }) => {
  await onboardCar(page);
  await registerChange(page, 'Óleo do motor', '45.000');
  await expect(page.getByText('Salve seus registros')).toBeVisible();
  await page.getByRole('button', { name: 'Criar conta' }).first().click();
  const email = `e2e+${Date.now()}@local.test`;
  await page.getByRole('textbox', { name: 'Nome' }).fill('Rafael');
  await page.getByRole('textbox', { name: 'E-mail' }).fill(email);
  await page.getByRole('textbox', { name: 'Senha' }).fill('segredo123');
  await page.getByRole('button', { name: 'Criar conta' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Conta criada · registros salvos' })).toBeVisible();
  const state = await serverState(page);
  expect(state.me.isAnonymous).toBe(false);
  expect(state.records).toHaveLength(1);
});

test('assinar Premium (mock)', async ({ page }) => {
  await onboardCar(page);
  await page.getByRole('link', { name: 'Conta' }).click();
  await page.getByRole('button', { name: 'Assinar Premium' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamento de teste' })).toBeVisible();
  await page.getByRole('button', { name: 'Aprovar pagamento' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Premium ativado · +2 créditos de consulta' })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByRole('button', { name: 'Seu plano atual · voltar ao grátis' })).toBeVisible();
  const state = await serverState(page);
  expect(state.me.plan).toBe('premium');
  expect(state.me.credits).toBe(2);
});

test('comprar créditos com Pix (mock) e consultar uma placa', async ({ page }) => {
  await onboardCar(page);
  await page.getByRole('button', { name: 'Consultar placa' }).first().click();
  await expect(page.getByRole('heading', { name: 'Consultar placa' })).toBeVisible();
  await page.getByPlaceholder('ABC1D23').fill('BRA2E19');
  await page.getByRole('button', { name: 'Comprar créditos para consultar' }).click();
  const sheet = page.getByRole('dialog', { name: 'Comprar créditos' });
  await expect(
    sheet.getByText('Faltam 6 créditos para esta consulta. Pacotes saem mais barato que o avulso.'),
  ).toBeVisible();
  await sheet.getByRole('button', { name: /^Pagar R\$\s47,90 com Pix$/ }).click();
  await expect(sheet.getByRole('heading', { name: 'Pague com Pix' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: '12 créditos adicionados' })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole('button', { name: 'Consultar · 6 créditos' }).click();
  await expect(page.getByText('1 ponto de atenção: leilão')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole('button', { name: 'Baixar laudo em PDF' })).toBeVisible();
  expect((await serverState(page)).me.credits).toBe(6);
});
