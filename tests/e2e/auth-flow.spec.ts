import { expect, test } from "@playwright/test";

test("TC-029: signed-out visitors are sent from member pages to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fdashboard$/);
});

test("TC-088: the dashboard is not shown to a signed-out visitor", async ({ page }) => {
  await page.goto("/directory?course=CSE341");
  await expect(page).toHaveURL(/\/sign-in\?next=/);
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
});

test("the verify page explains an expired link and offers a new one", async ({ page }) => {
  await page.goto("/verify?error=expired");
  await expect(page.getByRole("heading", { name: "This link has expired" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Send a new link" })).toBeVisible();
});

test("the register API validates input on the server", async ({ request }) => {
  const res = await request.post("/api/v1/auth/register", {
    data: { name: "X", email: "someone@gmail.com", password: "weak" },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error.code).toBe("validation_failed");
});

test("the alumni verification page offers a code or the alumni list", async ({ page }) => {
  await page.goto("/verify-alumni");
  await expect(page.getByRole("heading", { name: "Alumni verification" })).toBeVisible();
  await expect(page.getByLabel("Alumni code")).toBeVisible();
  await page.getByText("My email is on the alumni list").click();
  await expect(page.getByLabel("Alumni code")).toBeHidden();
});
