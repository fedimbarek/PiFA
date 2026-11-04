import { test, expect } from '@playwright/test';
import { DEMO, login, unique } from './helpers.js';

test.describe.configure({ mode: 'serial' });
const title = `Lecture contée E2E ${unique()}`;

test('1. visitor browses events and opens a detail page', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('chacun a sa place');
  await page.getByRole('link', { name: 'Voir tous les événements' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Événements accessibles' })).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: /événement/ })).toBeVisible();
  await page.locator('article a').first().click();
  await expect(page.getByRole('heading', { name: 'Infos pratiques' })).toBeVisible();
});

test('2-3. user registers, logs out, logs in again', async ({ page }) => {
  const email = `e2e${unique()}@test.tn`;
  await page.goto('/inscription');
  await page.locator('#f-name').fill('Participant E2E');
  await page.locator('#f-email').fill(email);
  await page.locator('#f-password').fill('Motdepasse1');
  await page.locator('#f-confirm').fill('Motdepasse1');
  await page.locator('#f-acceptTerms').check();
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page).toHaveURL(/mon-espace\/accessibilite/);
  await page.getByRole('button', { name: /menu du compte/ }).click();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await login(page, email, 'Motdepasse1');
  await expect(page).toHaveURL(/mon-espace/);
});

test('4-6. user searches an accessible event, books it and sees it in history', async ({ page }) => {
  await login(page, DEMO.user);
  await page.goto('/evenements');
  await page.getByLabel('Interprétation en langue des signes').check();
  await page.getByLabel('Uniquement avec des places disponibles').check();
  await page.getByRole('button', { name: 'Afficher les résultats' }).click();
  await expect(page).toHaveURL(/features=signLanguage/);
  const links = await page.locator('article a').evaluateAll((as) => as.map((a) => a.getAttribute('href')));
  let booked = null;
  for (const href of links) {
    await page.goto(href);
    await page.getByRole('heading', { name: 'Infos pratiques' }).waitFor();
    const btn = page.getByRole('button', { name: /^Réserver/ });
    if (await btn.count()) {
      booked = await page.getByRole('heading', { level: 1 }).textContent();
      await btn.click();
      await page.getByRole('dialog').getByRole('button', { name: 'Confirmer la réservation' }).click();
      await expect(page.getByText(/Vous avez réservé/)).toBeVisible();
      break;
    }
  }
  expect(booked, 'an event with sign language and seats should exist').not.toBeNull();
  await page.goto('/mon-espace/reservations');
  await expect(page.getByRole('link', { name: booked })).toBeVisible();
});

test('9. user receives a booking notification', async ({ page }) => {
  await login(page, DEMO.user);
  await page.goto('/mon-espace/notifications');
  await expect(page.getByRole('heading', { name: /Réservation confirmée/ }).first()).toBeVisible();
});

test('duplicate booking is prevented in the UI', async ({ page }) => {
  await login(page, DEMO.user);
  await page.goto('/mon-espace/reservations');
  const href = await page.locator('tbody a').first().getAttribute('href');
  await page.goto(href);
  await expect(page.getByText(/Vous avez réservé/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Réserver/ })).toHaveCount(0);
});

test('cancellation frees the booking', async ({ page }) => {
  await login(page, DEMO.user);
  await page.goto('/mon-espace/reservations');
  const before = await page.getByRole('tab', { name: /Annulées/ }).textContent();
  await page.getByRole('button', { name: /^Annuler la réservation/ }).first().click();
  await page.getByRole('button', { name: 'Oui, annuler la réservation' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'annulée' })).toBeVisible();
  await expect(page.getByRole('tab', { name: /Annulées/ })).not.toHaveText(before);
});

test('7. organizer creates an event and submits it to moderation', async ({ page }) => {
  await login(page, DEMO.orga);
  await page.goto('/organisateur/evenements/nouveau');
  await page.locator('#f-title').fill(title);
  await page.locator('#f-description').fill('Lecture de contes bilingue interprétée en langue des signes tunisienne.');
  await page.locator('#f-category').selectOption({ label: 'Atelier' });
  const d = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
  await page.locator('#f-startDate').fill(`${d}T15:00`);
  await page.locator('#f-endDate').fill(`${d}T17:00`);
  await page.locator('#f-venueName').fill('Bibliothèque Diwan');
  await page.locator('#f-address').fill('Rue du Pacha');
  await page.locator('#f-city').fill('Tunis');
  await page.locator('#f-capacity').fill('2');
  await page.getByLabel('Interprétation en langue des signes').check();
  await page.getByRole('button', { name: 'Enregistrer et publier' }).click();
  await expect(page).toHaveURL(/organisateur\/evenements$/);
  await expect(page.getByRole('row', { name: new RegExp(title) })).toContainText('En attente de modération');
});

test('8. administrator approves the event, which becomes public', async ({ page }) => {
  await login(page, DEMO.admin);
  await page.goto('/admin/moderation');
  await page.getByRole('button', { name: `Approuver : ${title}` }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Approuver', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'approuvé' })).toBeVisible();
  await page.goto(`/evenements?q=${encodeURIComponent('contée')}`);
  await expect(page.getByRole('link', { name: title })).toBeVisible();
});

test('full capacity: event shows "complet" once all seats are taken', async ({ page, request }) => {
  // Fill the 2-seat event created above through the API with a fresh account.
  const email = `full${unique()}@test.tn`;
  const reg = await request.post('/api/auth/register', { data: { name: 'Remplisseur', email, password: 'Motdepasse1', acceptTerms: true } });
  const { token } = await reg.json();
  const list = await (await request.get(`/api/events?q=${encodeURIComponent('contée')}`)).json();
  const ev = list.items.find((e) => e.title === title);
  const b = await request.post('/api/bookings', { data: { eventId: ev.id, seats: 2 }, headers: { Authorization: `Bearer ${token}` } });
  expect(b.status()).toBe(201);
  const again = await request.post('/api/bookings', { data: { eventId: ev.id, seats: 1 }, headers: { Authorization: `Bearer ${token}` } });
  expect(again.status()).toBe(409);
  await page.goto(`/evenements/${ev.id}`);
  await expect(page.getByText('Cet événement est complet.')).toBeVisible();
});
