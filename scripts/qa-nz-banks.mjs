import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const base = process.argv[2] || "http://127.0.0.1:8080";
const fixtures = join(dirname(fileURLToPath(import.meta.url)), "fixtures/statements");
mkdirSync("/workspace/screenshots", { recursive: true });

const banks = [
  { button: "ANZ", expect: /Read as ANZ/i },
  { button: "ASB", expect: /Read as ASB/i },
  { button: "Westpac", expect: /Read as Westpac/i },
  { button: "BNZ", expect: /Read as BNZ/i },
  { button: "Kiwibank", expect: /Read as Kiwibank/i },
];

const uploads = [
  { file: "asb-fastnet.csv", label: "ASB FastNet file" },
  { file: "kiwibank-full.csv", label: "Kiwibank full file" },
  { file: "bnz-extended.csv", label: "BNZ extended file" },
  { file: "westpac-nz.csv", label: "Westpac NZ file" },
  { file: "tsb.csv", label: "TSB file" },
];

const errors = [];
const notes = [];

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  page.on("pageerror", (e) => errors.push(`page: ${e.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console: ${msg.text()}`);
  });

  await page.goto(`${base}/calendar`, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(400);

  await page.getByRole("button", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Clear all" }).click();
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(250);
  await page.screenshot({ path: "/workspace/screenshots/qa-nz-picker.png" });

  for (const bank of banks) {
    await page.getByRole("button", { name: bank.button, exact: true }).click();
    await page.waitForTimeout(500);
    const dialog = page.locator('[role="dialog"]');
    const text = await dialog.innerText();
    if (!/4 in/i.test(text) || !/16 out/i.test(text)) {
      errors.push(`${bank.button}: expected 4 in · 16 out, got ${text.slice(0, 280)}`);
    }
    if (!text.includes("$7,432.18")) errors.push(`${bank.button}: missing salary $7,432.18`);
    if (!text.includes("$87.43")) errors.push(`${bank.button}: missing countdown $87.43`);
    if (!bank.expect.test(text)) errors.push(`${bank.button}: missing bank label. ${text.slice(0, 200)}`);
    const payroll = dialog.locator("li").filter({ hasText: /DHB|PAYROLL/i }).first();
    const side = await payroll.locator('button[aria-pressed="true"]').innerText();
    if (side.trim() !== "In") errors.push(`${bank.button}: payroll marked ${side}`);
    const shop = dialog.locator("li").filter({ hasText: /COUNTDOWN/i }).first();
    const shopSide = await shop.locator('button[aria-pressed="true"]').innerText();
    if (shopSide.trim() !== "Out") errors.push(`${bank.button}: countdown marked ${shopSide}`);
    notes.push(`${bank.button} sample OK`);
    await page.getByRole("button", { name: "Choose another" }).click();
    await page.waitForTimeout(200);
  }

  for (const up of uploads) {
    await page.locator('input[type="file"]').first().setInputFiles(join(fixtures, up.file));
    await page.waitForTimeout(500);
    const text = await page.locator('[role="dialog"]').innerText();
    if (!/4 in/i.test(text) || !/16 out/i.test(text)) {
      errors.push(`${up.label}: expected 4 in · 16 out`);
    }
    if (!text.includes("$7,432.18")) errors.push(`${up.label}: missing $7,432.18`);
    notes.push(`${up.label} upload OK`);
    await page.getByRole("button", { name: "Choose another" }).click();
    await page.waitForTimeout(150);
  }

  await page.getByRole("button", { name: "Kiwibank", exact: true }).click();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: /Import 20/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/workspace/screenshots/qa-nz-calendar.png", fullPage: true });
  const cal = await page.locator("body").innerText();
  if (!/\$9,023/.test(cal) && !/\$9,022/.test(cal)) errors.push(`Calendar income missing: ${cal.slice(0, 400)}`);
  if (!/\$3,439/.test(cal)) errors.push("Calendar expense not $3,439");
  notes.push("Kiwibank import landed on calendar");

  await page.getByRole("button", { name: "Statement" }).first().click();
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "ANZ PDF" }).click();
  await page.waitForTimeout(2500);
  const pdfText = await page.locator('[role="dialog"]').innerText();
  if (!/12 in/i.test(pdfText) || !/35 out/i.test(pdfText)) {
    errors.push(`ANZ PDF: expected 12 in · 35 out, got ${pdfText.slice(0, 300)}`);
  }
  await page.screenshot({ path: "/workspace/screenshots/qa-nz-anz-pdf.png" });
  notes.push("ANZ PDF sample OK");
} catch (err) {
  errors.push(String(err?.message || err));
} finally {
  await browser.close();
}

if (errors.length) {
  console.error(JSON.stringify({ ok: false, errors, notes }, null, 2));
  process.exit(1);
}
console.log(JSON.stringify({ ok: true, notes }, null, 2));
