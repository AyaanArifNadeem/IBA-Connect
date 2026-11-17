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
