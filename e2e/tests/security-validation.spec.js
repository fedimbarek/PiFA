import { test, expect } from '@playwright/test';
import { DEMO, login } from './helpers.js';

test('invalid registration shows an error summary that receives focus', async ({ page }) => {
  await page.goto('/inscription');
  await page.locator('#f-email').fill('pas-un-email');
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  const summary = page.locator('#error-summary');
  await expect(summary).toBeFocused();
  await expect(summary).toContainText('Adresse e-mail invalide');
  await expect(page.locator('#f-email')).toHaveAttribute('aria-invalid', 'true');
});

test('wrong password shows an explicit error', async ({ page }) => {
  await page.goto('/connexion');
  await page.locator('#f-email').fill(DEMO.user);
  await page.locator('#f-password').fill('mauvais');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'incorrect' })).toBeVisible();
});

test('unauthorized API requests are rejected', async ({ request }) => {
  expect((await request.get('/api/admin/stats')).status()).toBe(401);
  expect((await request.post('/api/events', { data: {} })).status()).toBe(401);
  const login = await request.post('/api/auth/login', { data: { email: DEMO.user, password: 'Password123' } });
  const { token } = await login.json();
  const h = { Authorization: `Bearer ${token}` };
  expect((await request.get('/api/admin/stats', { headers: h })).status()).toBe(403);
  expect((await request.get('/api/organizer/stats', { headers: h })).status()).toBe(403);
  const reg = await request.post('/api/auth/register', { data: { name: 'X', email: `adm${Date.now()}@t.tn`, password: 'Motdepasse1', role: 'admin', acceptTerms: true }, headers: { 'X-Requested-With': 'XMLHttpRequest' } });
  expect(reg.status()).toBe(400);
});

test('participant is redirected away from admin pages', async ({ page }) => {
  await login(page, DEMO.user);
  await page.goto('/admin/utilisateurs');
  await expect(page).toHaveURL(/\/mon-espace$/);
});
