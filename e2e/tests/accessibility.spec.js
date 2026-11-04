import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import fs from 'node:fs';
import { DEMO, login } from './helpers.js';

const PUBLIC = ['/', '/evenements', '/carte', '/connexion', '/inscription', '/a-propos', '/contact', '/accessibilite', '/plan-du-site'];
const results = [];

async function audit(page, url) {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.leaflet-container').analyze();
  results.push({ url, violations: r.violations.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length, help: v.help })) });
  return r;
}

test.afterAll(() => {
  fs.mkdirSync('test-results', { recursive: true });
  fs.writeFileSync('test-results/axe-results.json', JSON.stringify(results, null, 2));
});

for (const url of PUBLIC) {
  test(`axe WCAG 2.1 AA — ${url}`, async ({ page }) => {
    const r = await audit(page, url);
    expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)), JSON.stringify(r.violations, null, 1)).toEqual([]);
  });
}

test('axe — event detail and authenticated spaces', async ({ page }) => {
  await page.goto('/evenements');
  const href = await page.locator('article a').first().getAttribute('href');
  for (const [who, urls] of [[null, [href]], [DEMO.user, ['/mon-espace', '/mon-espace/reservations', '/mon-espace/accessibilite']], [DEMO.orga, ['/organisateur', '/organisateur/evenements/nouveau']], [DEMO.admin, ['/admin', '/admin/moderation', '/admin/utilisateurs']]]) {
    if (who) await login(page, who);
    for (const u of urls) {
      const r = await audit(page, u);
      expect(r.violations.filter((v) => ['serious', 'critical'].includes(v.impact)), `${u}: ${JSON.stringify(r.violations)}`).toEqual([]);
    }
  }
});

test('keyboard: skip link first, then main navigation', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Aller au contenu principal' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#main')).toBeFocused();
});

test('dialog traps focus and closes with Escape', async ({ page }) => {
  await page.goto('/');
  const trigger = page.getByRole('button', { name: /Affichage/ });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: "Préférences d'affichage" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('200 % text: no horizontal scrolling', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.setItem('iv-display-prefs', JSON.stringify({ fontScale: 200 })));
  for (const u of ['/', '/evenements', '/contact']) {
    await page.goto(u);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, u).toBeLessThanOrEqual(1);
  }
  await page.evaluate(() => localStorage.clear());
});

test('@mobile layout: menu button and no horizontal scroll', async ({ page }) => {
  await page.goto('/evenements');
  await expect(page.getByRole('button', { name: 'Ouvrir le menu' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Ouvrir le menu' }).click();
  await expect(page.getByRole('navigation', { name: 'Navigation principale' }).getByRole('link', { name: 'Carte' })).toBeVisible();
});
