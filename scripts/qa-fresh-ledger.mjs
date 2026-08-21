import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const url = "http://127.0.0.1:8080/";
const sample = {
  state: {
    transactions: [
      {
        id: "tx-1",
        type: "income",
        amount: 7400,
        categoryId: "salary",
        note: "Monthly salary",
        date: "2026-08-01",
        createdAt: "2026-08-01T10:00:00.000Z",
      },
      {
        id: "tx-2",
        type: "expense",
        amount: 86.4,
        categoryId: "groceries",
        note: "Farro Fresh",
        date: "2026-08-20",
        createdAt: "2026-08-20T10:00:00.000Z",
      },
    ],
    budgets: [{ id: "bd-1", categoryId: "housing", amount: 2200 }],
    bills: [],
    notices: [],
    settings: {
      displayName: "Alex",
      currency: "NZD",
      browserNotifications: false,
      budgetAlertPct: 80,
    },
  },
  version: 0,
};

await mkdir("/workspace/screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true });

function fail(step, text) {
  console.log(JSON.stringify({ step, ok: false, preview: text.slice(0, 800) }, null, 2));
}

const seedCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
await seedCtx.addInitScript((payload) => {
  if (sessionStorage.getItem("cove-reloaded-empty") === "1") return;
  localStorage.setItem("cove-finance-v1", payload);
  localStorage.setItem("cove-finance-v2", payload);
  localStorage.setItem("cove-finance-v3", payload);
  localStorage.removeItem("cove-empty-once");
}, JSON.stringify(sample));
const seedPage = await seedCtx.newPage();
await seedPage.goto(url, { waitUntil: "networkidle" });
await seedPage.waitForTimeout(900);
const wipeText = await seedPage.locator("body").innerText();
await seedPage.screenshot({ path: "/workspace/screenshots/fresh-zero.png", fullPage: false });
const wiped =
  wipeText.includes("$0.00") &&
  wipeText.includes("No entries yet") &&
  !wipeText.includes("Monthly salary") &&
  !wipeText.includes("Farro Fresh") &&
  !/\bAlex\b/.test(wipeText);
if (!wiped) {
  fail("wipe-sample", wipeText);
  await browser.close();
  process.exit(1);
}
await seedCtx.close();

const freshCtx = await browser.newContext({ viewport: { width: 1280, height: 860 } });
const page = await freshCtx.newPage();
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(700);
const freshText = await page.locator("body").innerText();
if (!freshText.includes("$0.00") || !freshText.includes("No entries yet")) {
  fail("fresh-context", freshText);
  await browser.close();
  process.exit(1);
}

await page.getByRole("button", { name: "Add", exact: true }).first().click();
const dialog = page.getByRole("dialog");
await dialog.getByLabel("Amount").fill("42.5");
await dialog.getByLabel("Note").fill("Test coffee");
await dialog.getByRole("button", { name: "Add", exact: true }).click();
await page.getByText("Test coffee").waitFor({ timeout: 5000 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(700);
const afterAdd = await page.locator("body").innerText();
await page.screenshot({ path: "/workspace/screenshots/fresh-after-add.png", fullPage: false });
if (!afterAdd.includes("42.50") || !afterAdd.includes("Test coffee") || afterAdd.includes("Monthly salary")) {
  fail("persist-user", afterAdd);
  await browser.close();
  process.exit(1);
}

await page.getByRole("navigation").getByRole("link", { name: "Activity" }).first().click();
await page.waitForTimeout(400);
const activity = await page.locator("body").innerText();
if (!activity.includes("Test coffee") || !activity.includes("42.50")) {
  fail("activity", activity);
  await browser.close();
  process.exit(1);
}

await page.getByRole("navigation").getByRole("link", { name: "Calendar" }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: "/workspace/screenshots/fresh-calendar.png", fullPage: false });

console.log(
  JSON.stringify(
    {
      ok: true,
      seededStorageWipedToZero: true,
      newSessionStartsAtZero: true,
      userEntrySurvivesReload: true,
      activityShowsCoffee: true,
    },
    null,
    2,
  ),
);
await browser.close();
