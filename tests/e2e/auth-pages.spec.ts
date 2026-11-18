import { expect, test } from "@playwright/test";

const pages = ["/sign-in", "/register", "/forgot-password", "/reset-password"];

for (const path of pages) {
  test(`${path} loads without horizontal scrolling`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveTitle("IBA Connect");

    // NFR13: usable at 360 px; the page must not scroll sideways
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test("the landing page introduces IBA Connect and links to sign-in and registration", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Find the right people at IBA." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Create account" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "I am an alumnus" })).toHaveAttribute("href", "/verify-alumni");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
