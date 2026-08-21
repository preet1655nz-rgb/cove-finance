import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto("http://127.0.0.1:8080/calendar", { waitUntil: "networkidle" });
await page.evaluate(() => {
  for (const k of Object.keys(localStorage)) localStorage.removeItem(k);
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);

await page.getByRole("button", { name: /statement/i }).first().click();
await page.locator('input[type="file"]').setInputFiles("/workspace/attachments/State.pdf");
await page.getByText(/78 to import/i).waitFor({ timeout: 12000 });
const nameBox = page.getByPlaceholder("e.g. ANZ Go");
if (await nameBox.isVisible().catch(() => false)) await nameBox.fill("ANZ Go");
await page.getByRole("button", { name: /Import/i }).click();
await page.waitForTimeout(600);

async function ask(q) {
  const open = await page.getByText("Reads your ledger").isVisible().catch(() => false);
  if (!open) await page.getByRole("button", { name: "Ask Cove" }).click();
  await page.getByPlaceholder("Ask Cove anything about your money").fill(q);
  await page.getByRole("button", { name: "Send" }).click();
  await page.waitForFunction(() => !document.body.innerText.includes("Reading your books…"), null, { timeout: 20000 });
  await page.waitForTimeout(250);
  return page.locator(".fixed.inset-x-3, .lg\\:w-\\[400px\\]").first().innerText();
}

const doing = await ask("How am I doing?");
const patterns = await ask("What patterns do you see?");
await page.screenshot({ path: "/workspace/screenshots/ask-cove-analysis.png" });

const result = {
  analysisHasTotals: /12,?273|11,?918|lived/i.test(doing),
  analysisNotGeneric: !/Ask “how am I doing/i.test(doing) && !/I would file/i.test(doing),
  patternsNamePayee: /Cityfitness|Inland Revenue|Countdown|Uber|Didi|Sharesies/i.test(patterns + doing),
  pageErrors: errors.slice(0, 5),
};
console.log(JSON.stringify(result, null, 2));
console.log("---DOING---\n", doing.slice(-700));
console.log("---PATTERNS---\n", patterns.slice(-700));
await browser.close();
if (!result.analysisHasTotals || !result.analysisNotGeneric || !result.patternsNamePayee) process.exit(1);
