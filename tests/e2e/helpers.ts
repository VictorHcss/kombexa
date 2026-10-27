import { expect, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@academia.dev", password: "kombexa123" };

export async function login(page: Page, email = ADMIN.email, password = ADMIN.password) {
  await page.goto("/login");
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await expect(page).not.toHaveURL(/\/login/);
}

/** Confirma a janela de confirmação do sistema (nunca o confirm() do navegador). */
export async function confirmDialog(page: Page) {
  const dialog = page.locator("dialog.modal[open]");
  await expect(dialog).toBeVisible();
  await dialog.locator(".modal-actions .btn").last().click();
}

export const toast = (page: Page) => page.locator(".toast");

/** Mesmo formato do sistema: 15090 -> "R$ 150,90". */
export const brl = (cents: number) => `R$ ${Math.floor(cents / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${String(cents % 100).padStart(2, "0")}`;
