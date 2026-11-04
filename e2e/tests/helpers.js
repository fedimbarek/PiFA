import { expect } from '@playwright/test';
export const PASSWORD = 'Password123';
export const DEMO = { user: 'user@inclusivenue.tn', orga: 'orga@inclusivenue.tn', admin: 'admin@inclusivenue.tn' };

export async function login(page, email, password = PASSWORD) {
  await page.goto('/connexion');
  await page.locator('#f-email').fill(email);
  await page.locator('#f-password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/connexion/);
}
export const unique = () => `${Date.now()}${Math.floor(Math.random() * 1000)}`;
