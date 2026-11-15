import { expect, test } from "@playwright/test";

test("landing page shows Helios Lab and the main navigation choices", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /helios lab/i })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  await expect(page.getByRole("link", { name: "Try demo bench" })).toHaveAttribute("href", "/lab");
});
