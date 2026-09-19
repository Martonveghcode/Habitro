import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function openStudy(page: Page) {
  await page.goto("/");
  await navigateStudy(page);
}
async function navigateStudy(page: Page) {
  await page.locator(".globalnav__group > button").click();
  await page.getByRole("menuitem", { name: "Catalan presentations", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Catalan presentations", exact: true })).toBeVisible();
}
const scope = (page: Page) => page.locator(".cp-workspace");
async function downloadData(page: Page) {
  const event = page.waitForEvent("download");
  await scope(page).getByRole("button", { name: "Download database" }).click();
  const download = await event;
  return { path: (await download.path())!, data: JSON.parse(await readFile((await download.path())!, "utf8")) };
}
async function rate(page: Page, name: string) {
  await scope(page).getByRole("button", { name: "Show answer", exact: true }).click();
  await scope(page).locator(".cp-rate").filter({ hasText: name }).click();
}

test("complete study flow, separate timings, exact Wrong gap, persistence and backups", async ({ page }) => {
  const errors: string[] = []; page.on("pageerror", e => errors.push(e.message));
  await openStudy(page);
  const cp = scope(page);
  await expect(cp.getByRole("heading", { name: "25 activities selected" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/catalan-setup.png", fullPage: true });
  await cp.getByRole("button", { name: "Start study session" }).click();
  await expect(cp.locator(".cp-card h2")).toHaveText("En què es diferenciaven un trobador i un poeta?");
  await expect(cp.locator(".cp-rating")).toHaveCount(0);
  await page.waitForTimeout(1200);
  await cp.getByRole("button", { name: "Show answer" }).click();
  await expect(cp.locator(".cp-answer")).toHaveText("b) El trobador escrivia en llengua «vulgar» i el poeta, en llatí.");
  await page.waitForTimeout(1100);
  await cp.getByRole("button", { name: "Wrong 1" }).click();
  await expect(cp.locator(".cp-card h2")).toHaveText("Què era un joglar?");
  await rate(page, "Easy");
  await expect(cp.locator(".cp-card h2")).toHaveText("En què es diferenciaven un trobador i un poeta?");
  await rate(page, "Medium");
  await expect(cp.locator(".cp-card h2")).toHaveText("Què vol dir «poesia culta en llengua vulgar»?");
  await cp.getByRole("button", { name: "Pause", exact: true }).click();
  const checkpoint = await downloadData(page);
  expect(checkpoint.data.data.reviews).toHaveLength(3);
  expect(checkpoint.data.data.reviews[0].recallMs).toBeGreaterThan(1000);
  expect(checkpoint.data.data.reviews[0].checkMs).toBeGreaterThan(1000);
  await page.waitForTimeout(1200);
  const paused = await downloadData(page);
  expect(paused.data.data.active.elapsedMs).toBe(checkpoint.data.data.active.elapsedMs);
  await page.reload(); await navigateStudy(page);
  await expect(cp.getByRole("heading", { name: "Session paused" })).toBeVisible();
  await cp.getByRole("button", { name: "Resume study" }).click();
  await expect(cp.locator(".cp-card h2")).toHaveText("Què vol dir «poesia culta en llengua vulgar»?");
  // Navigation to another section pauses without unmounting the study database.
  await page.locator(".globalnav__menu > button").last().click();
  await navigateStudy(page);
  await expect(cp.getByRole("heading", { name: "Session paused" })).toBeVisible();
  await cp.getByRole("button", { name: "End session", exact: true }).click();
  const backup = await downloadData(page);
  await cp.locator('input[type="file"]').setInputFiles(backup.path);
  await expect(cp.getByText("Backup restored. Existing reviews were kept.")).toBeVisible();
  await cp.locator('input[type="file"]').setInputFiles(backup.path);
  expect((await downloadData(page)).data.data.reviews).toHaveLength(3);
  await cp.locator('input[type="file"]').setInputFiles({ name: "bad.json", mimeType: "application/json", buffer: Buffer.from('{"version":99}') });
  await expect(cp.getByText(/Could not restore this backup/)).toBeVisible();
  expect((await downloadData(page)).data.data.reviews).toHaveLength(3);
  expect(errors).toEqual([]);
});

test("filters, invalid duration, long answer formatting, PDF and mobile layout", async ({ page }) => {
  await openStudy(page); const cp = scope(page);
  await cp.getByRole("button", { name: "Class 2", exact: false }).click();
  await cp.getByRole("button", { name: "Class 3", exact: false }).click();
  await cp.getByRole("button", { name: "Medium 31–75 words" }).click();
  await cp.getByRole("button", { name: "Long 76+ words" }).click();
  await expect(cp.getByRole("button", { name: "Start study session" })).toBeDisabled();
  await cp.getByRole("button", { name: "Short ≤30 words" }).click();
  await cp.getByRole("button", { name: "Long 76+ words" }).click();
  await expect(cp.getByRole("heading", { name: "3 activities selected" })).toBeVisible();
  await cp.getByRole("spinbutton", { name: "Minutes" }).fill("0");
  await expect(cp.getByRole("button", { name: "Start study session" })).toBeDisabled();
  await cp.getByRole("spinbutton", { name: "Minutes" }).fill("45");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/catalan-mobile-setup.png", fullPage: true });
  await cp.getByRole("button", { name: "Start study session" }).click();
  await cp.getByRole("button", { name: "Show answer" }).click();
  await expect(cp.locator(".cp-answer h3")).toHaveText("Característiques:");
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/catalan-mobile-answer.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await cp.getByRole("button", { name: "Easy 4" }).click();
  await cp.getByRole("button", { name: "Show answer" }).click();
  await expect(cp.locator(".cp-answer ul")).toHaveCount(2);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: "work/catalan-desktop-answer.png", fullPage: true });
  expect((await page.request.get("/catalan/presentations/classe-4.pdf")).headers()["content-type"]).toContain("pdf");
});

test("a backup can restore an unfinished session into a fresh browser", async ({ page, browser }) => {
  await openStudy(page); await scope(page).getByRole("button", { name: "Start study session" }).click();
  await rate(page, "Wrong");
  const backup = await downloadData(page);
  const context = await browser.newContext(); const restored = await context.newPage();
  await openStudy(restored);
  await scope(restored).locator('input[type="file"]').setInputFiles(backup.path);
  await expect(scope(restored).getByRole("heading", { name: "Session paused" })).toBeVisible();
  await scope(restored).getByRole("button", { name: "Resume study" }).click();
  await expect(scope(restored).locator(".cp-card h2")).toHaveText("Què era un joglar?");
  await rate(restored, "Easy");
  await expect(scope(restored).locator(".cp-card h2")).toHaveText("En què es diferenciaven un trobador i un poeta?");
  await context.close();
});

test("multiple tabs cannot overwrite one another's study data", async ({ page, context }) => {
  await openStudy(page);
  await scope(page).getByRole("button", { name: "Start study session" }).click();
  await rate(page, "Wrong");
  const second = await context.newPage(); await openStudy(second);
  await expect(scope(second).getByText(/open in another tab/)).toBeVisible();
  await page.close();
  await scope(second).getByRole("button", { name: "Try again" }).click();
  await expect(scope(second).getByRole("heading", { name: "Session paused" })).toBeVisible();
  expect((await downloadData(second)).data.data.reviews).toHaveLength(1);
});
