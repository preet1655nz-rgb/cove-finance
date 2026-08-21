import { CATEGORIES, getCategory } from "./categories";
import type { Transaction, TxType } from "./types";

export type StatementDraft = {
  key: string;
  date: string;
  amount: number;
  type: TxType;
  note: string;
  categoryId: string;
  duplicate: boolean;
  included: boolean;
};

export type ParseResult = {
  ok: boolean;
  format: string;
  rows: StatementDraft[];
  skipped: number;
  warnings: string[];
  error?: string;
  needsPassword?: boolean;
};

const SKIP_NOTE =
  /\b(opening balance|closing balance|brought forward|carried forward|balance (brought|carried)|opening bal|closing bal|total balance|account balance|totals at end|totals at end of page|avail(?:able)? bal(?:ance)?|ledger bal(?:ance)?|balance brought forward)\b/i;

const DATE_H = /\b(date|posted|posting|processed|value date|dtposted|txn date|effective|transaction date|tran date)\b/i;
const AMOUNT_H = /^(amount|value|sum|aud|nzd|usd|gbp|eur|cad|transaction amount|trnamt|txn amount)$/i;
const DESC_H = /\b(description|details|particulars|memo|payee|narration|narrative|merchant|other party|reference\d*|contra|name|tp name|op name|libelle|label|beneficiary|transaction type|category)\b/i;
const TYPE_H = /^(type|tran(saction)? type|dr\/cr|debit\/credit|txn type|source code( \(payment type\))?|payment type)$/i;
const IGNORE_H =
  /^(balance|running balance|account( number)?|bank account|unique id|cheque( number)?|check number|fitid|processed date|value date|foreign ?currency ?amount|conversion ?charge|serial|batch( number)?|originating bank.*|this party account|other party account|op bank account( number)?|analysis code|tpn|tp ref|tp part|tp code|op ref|op part|op code|op bank account number|avail bal(ance)?|ledger bal(ance)?|created date.*|from date|to date)$/i;

const INCOME_TYPE = /\b(credit|deposit|salary|salaire|payroll|interest|dividend|refund|direct credit|d\/c|\bdc\b|dep|inward|payment received|cr|wage\/salary|credit transfer)\b/i;
const EXPENSE_TYPE = /\b(debit|pos|eftpos|visa|mastercard|atm|payment|bill|direct debit|d\/d|\bdd\b|withdrawal|fee|purchase|dr|outward|transfer out|\bbp\b|\bap\b|\bvt\b|\bep\b|\bat\b|bill payment|automatic payment)\b/i;


const RULES: { re: RegExp; id: string }[] = [
  { re: /\b(salary|salaire|wages?|payroll|paye|direct dep(osit)?|employer)\b/i, id: "salary" },
  { re: /\b(freelance|invoice|contract work|consult)\b/i, id: "freelance" },
  { re: /\b(dividend|interest|vti|hatch|investnow|brokerage)\b/i, id: "investments" },
  { re: /\b(didi mobility|uber bv)\b/i, id: "other-income" },
  { re: /\b(gift|birthday|present from)\b/i, id: "gifts" },
  { re: /\b(ird|inland revenue|tax refund|gst return)\b/i, id: "other-income" },
  { re: /\b(rent|landlord|barfoot|harcourts|mortgage)\b/i, id: "housing" },
  { re: /\b(countdown|new world|pak'? ?n ?save|paknsave|farro|woolworths|fresh choice|four square|coles|aldi|tesco|whole foods|trader joe|grocery|fruit shop|vege|foodmart)\b/i, id: "groceries" },
  { re: /\b(uber eats|deliveroo|menulog|doordash|mcdonald|kfc|subway|dominos|pizza|burger|restaurant|bistro|kitchen|takeaway|amano|coco'?s|orphans|sweets)\b/i, id: "dining" },
  { re: /\b(allpress|starbucks|coffee|caf[eé]|espresso|l'?affare|gloria jean)\b/i, id: "drinks" },
  { re: /\b(netflix|spotify|icloud|disney|youtube|apple\.com\/bill|google one|dropbox|subscription)\b/i, id: "subscriptions" },
  { re: /\b(waitomo|bp |z energy|mobil|shell|petrol|gasoline|at hop|auckland transport|uber trip|uber *rides|lyft|parking|wilson parking|transit)\b/i, id: "transport" },
  { re: /\b(genesis|mercury|contact energy|meridian|powershop|vector|watercare|spark|one nz|2degrees|vodafone|chorus|fibre|broadband|internet|power|electri)\b/i, id: "utilities" },
  { re: /\b(pharmacy|chemist|physio|doctor| gp\b|hospital|dental|dentist|acc |cityfitness|city fitness)\b/i, id: "health" },
  { re: /\b(airbnb|booking\.com|air new zealand|air nz|jetstar|qantas|hotel|motel|flight)\b/i, id: "travel" },
  { re: /\b(uniqlo|zara|h&m|kmart|the warehouse|amazon|cotton on|country road)\b/i, id: "shopping" },
  { re: /\b(cinema|event cinemas|ticketmaster|concert|academy cinema|aotea)\b/i, id: "entertainment" },
  { re: /\b(university|course|udemy|workbook|tuition)\b/i, id: "education" },
  { re: /\b(kiwisaver|emergency fund|savings|sharesies|wstpac saving)\b/i, id: "savings" },
];

export const SAMPLE_STATEMENT = `Type,Details,Particulars,Code,Reference,Amount,Date,Processed Date
Direct credit,ACME DESIGN LTD,SALARY,,,6200.00,14/08/2026,14/08/2026
Visa purchase,COUNTDOWN GREY LYNN,,,,-112.40,13/08/2026,13/08/2026
Visa purchase,ALLPRESS ESPRESSO,,,,-6.50,13/08/2026,13/08/2026
Eft-pos,Z ENERGY PONSONBY,,,,-78.20,12/08/2026,12/08/2026
Automatic payment,LANDLORD LTD,RENT,,,-1850.00,01/08/2026,01/08/2026
Direct debit,NETFLIX.COM,,,,-24.99,08/08/2026,08/08/2026
Visa purchase,FARRO FRESH,,,,-64.30,10/08/2026,10/08/2026
Direct credit,IRD,TAX REFUND,,,340.00,05/08/2026,05/08/2026
Visa purchase,EVENT CINEMAS NEW MARKET,,,,-32.00,09/08/2026,09/08/2026
Atm,WESTPAC ATM QUEEN ST,,,,-80.00,07/08/2026,07/08/2026
Direct credit,NORTH STUDIO,INVOICE 441,,,960.00,18/08/2026,18/08/2026
Visa purchase,UNIQLO NEW MARKET,,,,-48.00,11/08/2026,11/08/2026
Opening balance,,,,,,12450.00,01/08/2026,
`;

export const NZ_BANK_SAMPLES: { id: string; label: string; file: string }[] = [
  { id: "anz", label: "ANZ", file: "/samples/anz.csv" },
  { id: "asb", label: "ASB", file: "/samples/asb.csv" },
  { id: "westpac", label: "Westpac", file: "/samples/westpac.csv" },
  { id: "bnz", label: "BNZ", file: "/samples/bnz.csv" },
  { id: "kiwibank", label: "Kiwibank", file: "/samples/kiwibank.csv" },
];


export function txFingerprint(date: string, amount: number, note: string) {
  const n = note
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 48);
  return `${date}|${amount.toFixed(2)}|${n}`;
}

export function parseBankStatement(input: string, filename = ""): ParseResult {
  try {
    return parseUnsafe(input, filename);
  } catch {
    return fail("That file could not be read. Export a CSV or PDF from your bank and try again.");
  }
}

export async function readStatementFile(file: File, password?: string): Promise<ParseResult> {
  try {
    if (file.size > 12_000_000) {
      return fail("That file is too large. Export a CSV or PDF of a single month instead.");
    }
    const buf = await file.arrayBuffer();
    const kind = sniffFile(buf);
    if (kind === "image") {
      return fail("That looks like a photo. Upload the PDF or CSV your bank exported, not a screenshot.");
    }
    if (kind === "pdf") {
      try {
        const { extractPdfText, PdfOpenError } = await import("./pdf-statement");
        const text = await Promise.race([
          extractPdfText(buf, password),
          new Promise<string>((_, reject) => {
            setTimeout(() => reject(new PdfOpenError("That PDF took too long to read. Try a one-month CSV export.", "timeout")), 45000);
          }),
        ]);
        const parsed = parseBankStatement(text, file.name || "statement.pdf");
        if (!parsed.ok) {
          return fail(
            parsed.error ??
              "No dates and amounts were found in that PDF. Download the CSV from internet banking instead.",
          );
        }
        return parsed;
      } catch (err) {
        const { PdfOpenError } = await import("./pdf-statement");
        if (err instanceof PdfOpenError) {
          return fail(err.message, { needsPassword: err.kind === "password" });
        }
        if (isPasswordish(err)) {
          return fail("This PDF is locked. Enter the password from your bank (often your date of birth or customer number).", {
            needsPassword: true,
          });
        }
        console.error("PDF read failed", err);
        return fail("That PDF could not be read. Try another export, or download the CSV from internet banking.");
      }
    }
    const head = new Uint8Array(buf.slice(0, 8));
    if (head.some((b, i) => i < 4 && b === 0)) {
      return fail("That looks like a spreadsheet workbook. Save as CSV and upload again.");
    }
    const text = new TextDecoder("utf-8", { fatal: false }).decode(buf);
    return parseBankStatement(text, file.name);
  } catch (err) {
    console.error("Statement read failed", err);
    return fail("That file could not be opened. Try a PDF or CSV export from your bank.");
  }
}

function isPasswordish(err: unknown) {
  const e = err as { name?: string; message?: string } | null;
  return Boolean(e && (e.name === "PasswordException" || /password/i.test(String(e.message ?? ""))));
}

function sniffFile(buf: ArrayBuffer): "pdf" | "image" | "other" {
  const bytes = new Uint8Array(buf.slice(0, 1024));
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image";
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image";
  const latin = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join("");
  if (latin.includes("%PDF")) return "pdf";
  if (latin.includes("ftypheic") || latin.includes("ftypheif") || latin.includes("ftypmif1")) return "image";
  if (latin.includes("WEBP")) return "image";
  return "other";
}

function fail(error: string, extra: Partial<ParseResult> = {}): ParseResult {
  return { ok: false, format: "unknown", rows: [], skipped: 0, warnings: [], error, ...extra };
}

function parseUnsafe(input: string, filename: string): ParseResult {
  const text = String(input ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!text) return fail("The file was empty.");

  const lower = text.slice(0, 200).toLowerCase();
  const fname = filename.toLowerCase();
  if (lower.includes("<ofx") || lower.includes("ofxheader") || fname.endsWith(".ofx") || fname.endsWith(".qfx")) {
    return finalize(parseOfx(text), "ofx");
  }
  if (lower.startsWith("!type:") || fname.endsWith(".qif")) {
    return finalize(parseQif(text), "qif");
  }
  if (text.startsWith("{") || text.startsWith("[")) {
    const json = parseJsonBackup(text);
    if (json) return json;
  }

  const yearHint = inferYear(text);
  const looksPdf = fname.endsWith(".pdf") || looksLikeAnzLedger(text);
  if (looksPdf) {
    const anz = parseAnzLedger(text, yearHint);
    if (anz.length) {
      return finalize(anz, "anz-ledger", 0, ["Read as an ANZ-style statement (withdrawals and deposits)."]);
    }
    const generic = parseGenericLedger(text, yearHint);
    if (generic.length) {
      return finalize(generic, "pdf-ledger", 0, ["Read as a statement PDF (dates and amounts)."]);
    }
  }

  const csv = parseCsv(text, filename);
  if (csv.ok) return csv;
  const anz = parseAnzLedger(text, yearHint);
  if (anz.length) {
    return finalize(anz, "anz-ledger", 0, ["Read as an ANZ-style statement (withdrawals and deposits)."]);
  }
  const generic = parseGenericLedger(text, yearHint);
  if (generic.length) {
    return finalize(generic, "pdf-ledger", 0, ["Read as a statement PDF (dates and amounts)."]);
  }
  return csv;
}

function looksLikeAnzLedger(text: string) {
  const hits = text.split("\n").filter((l) => ANZ_DATE.test(l.trim()) && ANZ_CODE.test(l.replace(ANZ_DATE, "").trim()));
  return hits.length >= 3;
}

function finalize(
  raw: Omit<StatementDraft, "key" | "duplicate" | "included">[],
  format: string,
  extraSkipped = 0,
  warnings: string[] = [],
): ParseResult {
  const rows: StatementDraft[] = [];
  let skipped = extraSkipped;
  const seen = new Set<string>();
  for (const r of raw) {
    if (!r.date || !Number.isFinite(r.amount) || r.amount <= 0) {
      skipped += 1;
      continue;
    }
    const key = txFingerprint(r.date, r.amount, r.note);
    if (seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    rows.push({
      ...r,
      key,
      duplicate: false,
      included: true,
    });
  }
  if (!rows.length) {
    return fail("No dates and amounts were found. Export a CSV or PDF with a Date column and an Amount (or Debit/Credit) column.");
  }
  return { ok: true, format, rows, skipped, warnings };
}

export function applyDuplicates(rows: StatementDraft[], existing: Transaction[]): StatementDraft[] {
  const have = new Set(existing.map((t) => txFingerprint(t.date, t.amount, t.note)));
  return rows.map((r) => {
    const duplicate = have.has(r.key);
    return { ...r, duplicate, included: duplicate ? false : r.included };
  });
}

function parseJsonBackup(text: string): ParseResult | null {
  try {
    const data = JSON.parse(text) as { transactions?: Transaction[] } | Transaction[];
    const list = Array.isArray(data) ? data : data.transactions;
    if (!Array.isArray(list) || !list.length) return null;
    const raw = list
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        date: String(t.date ?? "").slice(0, 10),
        amount: Math.abs(Number(t.amount)),
        type: (t.type === "income" ? "income" : "expense") as TxType,
        note: String(t.note ?? ""),
        categoryId: String(t.categoryId || categorize(String(t.note ?? ""), t.type === "income" ? "income" : "expense")),
      }));
    return finalize(raw, "json");
  } catch {
    return null;
  }
}

function parseOfx(text: string): Omit<StatementDraft, "key" | "duplicate" | "included">[] {
  const parts = text.split(/<STMTTRN>/i).slice(1);
  const out: Omit<StatementDraft, "key" | "duplicate" | "included">[] = [];
  for (const part of parts) {
    const body = part.split(/<\/STMTTRN>/i)[0] ?? part;
    const amt = parseAmount(ofxTag(body, "TRNAMT"));
    const date = parseDate(ofxTag(body, "DTPOSTED"), true);
    const name = ofxTag(body, "NAME") || ofxTag(body, "PAYEE");
    const memo = ofxTag(body, "MEMO");
    const note = joinNote([name, memo]);
    if (SKIP_NOTE.test(note)) continue;
    if (amt == null || !date) continue;
    const type: TxType = amt < 0 ? "expense" : "income";
    out.push({
      date,
      amount: Math.abs(amt),
      type,
      note,
      categoryId: categorize(note, type),
    });
  }
  return out;
}

function ofxTag(body: string, name: string) {
  const re = new RegExp(`<${name}>([^<\\r\\n]+)`, "i");
  const m = body.match(re);
  return m ? m[1].trim() : "";
}

function parseQif(text: string): Omit<StatementDraft, "key" | "duplicate" | "included">[] {
  const blocks = text.split("^");
  const out: Omit<StatementDraft, "key" | "duplicate" | "included">[] = [];
  for (const block of blocks) {
    let date = "";
    let amt: number | null = null;
    const notes: string[] = [];
    for (const line of block.split("\n")) {
      const code = line[0];
      const val = line.slice(1).trim();
      if (code === "D") date = parseDate(val, true) ?? "";
      if (code === "T" || code === "U") amt = parseAmount(val);
      if (code === "P" || code === "M" || code === "N") notes.push(val);
    }
    const note = joinNote(notes);
    if (!date || amt == null || SKIP_NOTE.test(note)) continue;
    const type: TxType = amt < 0 ? "expense" : "income";
    out.push({ date, amount: Math.abs(amt), type, note, categoryId: categorize(note, type) });
  }
  return out;
}

function inferYear(text: string) {
  const found = [...text.matchAll(/\b(20[1-3]\d)\b/g)].map((m) => Number(m[1]));
  if (found.length) {
    const counts = new Map<number, number>();
    for (const y of found) counts.set(y, (counts.get(y) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  }
  return new Date().getFullYear();
}

const ANZ_DATE = /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\b/i;
const ANZ_CODE = /^(DD|DC|BP|AP|VT|EP|AT|CQ|ED|FX|IA|IP|IF|TP)\b/i;

function parseAnzLedger(text: string, yearHint: number): Omit<StatementDraft, "key" | "duplicate" | "included">[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const merged: string[] = [];
  for (const line of lines) {
    if (ANZ_DATE.test(line)) merged.push(line);
    else if (
      merged.length &&
      !/^(totals|page |go -|date\b|transaction type|withdrawals|deposits|balance|ap automatic|bp bill|dc direct|dd direct|vt visa|ep eftpos)/i.test(line)
    ) {
      merged[merged.length - 1] += ` ${line}`;
    }
  }
  const out: Omit<StatementDraft, "key" | "duplicate" | "included">[] = [];
  for (const line of merged) {
    if (SKIP_NOTE.test(line) || /totals at end/i.test(line)) continue;
    const dm = line.match(
      /^(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[,\s]+(.*)$/i,
    );
    if (!dm) continue;
    const date = parseDate(`${dm[1]} ${dm[2]} ${yearHint}`, true, yearHint);
    if (!date) continue;
    let rest = dm[3].replace(/^,+/, "").trim();
    const tm = rest.match(ANZ_CODE);
    const code = tm ? tm[1].toUpperCase() : "";
    if (tm) rest = rest.slice(tm[0].length).trim();
    const moneyMatches = [...rest.matchAll(/\$?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}/g)].map((m) => m[0]);
    if (!moneyMatches.length) continue;
    const amountStr = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0];
    const amount = parseAmount(amountStr);
    if (amount == null || amount === 0) continue;
    let note = rest;
    for (const am of moneyMatches) note = note.split(am).join("");
    note = [code, note.replace(/\s+/g, " ").trim()].filter(Boolean).join(" ");
    if (SKIP_NOTE.test(note)) continue;
    const type: TxType =
      code === "DC" || /\b(wage\/salary|credit transfer|direct credit)\b/i.test(note) ? "income" : "expense";
    out.push({
      date,
      amount: Math.abs(amount),
      type,
      note,
      categoryId: categorize(note, type),
    });
  }
  return out;
}

function parseGenericLedger(text: string, yearHint: number): Omit<StatementDraft, "key" | "duplicate" | "included">[] {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const out: Omit<StatementDraft, "key" | "duplicate" | "included">[] = [];
  for (const line of lines) {
    if (SKIP_NOTE.test(line) || /^(date\b|transaction|page |totals|statement |account |opening|closing)/i.test(line)) continue;
    let date: string | null = null;
    let rest = line;
    const isoD = line.match(/^(\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2})\s+(.*)$/);
    const dmy = line.match(/^(\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4})\s+(.*)$/);
    const mid = line.match(/(\d{4}[/.\-]\d{1,2}[/.\-]\d{1,2}|\d{1,2}[/.\-]\d{1,2}[/.\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?)/);
    const mon = line.match(/^(\d{1,2}\s+[A-Za-z]{3}(?:\s+\d{2,4})?)\s+(.*)$/);
    if (isoD) {
      date = parseDate(isoD[1], true, yearHint);
      rest = isoD[2];
    } else if (dmy) {
      date = parseDate(dmy[1], true, yearHint);
      rest = dmy[2];
    } else if (mon) {
      date = parseDate(mon[1], true, yearHint);
      rest = mon[2];
    } else if (mid) {
      date = parseDate(mid[1], true, yearHint);
      rest = (line.slice(0, mid.index) + " " + line.slice((mid.index ?? 0) + mid[1].length)).trim();
    } else continue;
    if (!date) continue;
    const moneyMatches = [...rest.matchAll(/\$?(?:\d{1,3}(?:,\d{3})+|\d+)\.\d{2}(?:\s*(?:CR|DR))?/gi)].map((m) => m[0]);
    if (!moneyMatches.length) continue;
    const amountStr = moneyMatches.length >= 2 ? moneyMatches[moneyMatches.length - 2] : moneyMatches[0];
    const amount = parseAmount(amountStr.replace(/\s*(CR|DR)\s*$/i, ""));
    if (amount == null || amount === 0) continue;
    let note = rest;
    for (const am of moneyMatches) note = note.split(am).join("");
    note = note.replace(/\s+/g, " ").trim();
    if (SKIP_NOTE.test(note)) continue;
    const cr = /\bCR\b/i.test(amountStr);
    const dr = /\bDR\b/i.test(amountStr);
    let type: TxType = "expense";
    if (cr && !dr) type = "income";
    else if (amount < 0) type = "expense";
    else if (INCOME_TYPE.test(note) || isIncomeNote(note)) type = "income";
    out.push({
      date,
      amount: Math.abs(amount),
      type,
      note,
      categoryId: categorize(note, type),
    });
  }
  return out;
}

function parseCsv(text: string, _filename: string): ParseResult {
  const delimiter = detectDelimiter(text);
  const table = splitCsv(text, delimiter).filter((r) => r.some((c) => c.trim()));
  if (!table.length) return fail("No rows were found in that file.");

  let headerIdx = 0;
  let best = -Infinity;
  const scan = Math.min(table.length, 25);
  for (let i = 0; i < scan; i++) {
    const score = headerScore(table[i]);
    if (score > best) {
      best = score;
      headerIdx = i;
    }
  }
  const looksLikeHeader = best >= 3;
  const headers = looksLikeHeader ? table[headerIdx].map((h) => h.trim()) : [];
  const dataStart = looksLikeHeader ? headerIdx + 1 : 0;
  const cols = mapColumns(headers, table.slice(dataStart, dataStart + 15));

  if (cols.date == null || (cols.amount == null && cols.debit == null && cols.credit == null)) {
    return fail("Could not find a date column and an amount (or debit/credit) column. Check the export includes headers.");
  }

  const preferDMY = detectDMY(table.slice(dataStart), cols.date);
  const yearHint = inferYear(text);
  const amountSamples: number[] = [];
  const parsed: { date: string; amountRaw: number | null; debit: number | null; credit: number | null; note: string; typeRaw: string }[] = [];

  let skipped = 0;
  for (const row of table.slice(dataStart)) {
    const dateRaw = cell(row, cols.date);
    const note = joinNote((cols.desc.length ? cols.desc : []).map((i) => cell(row, i)));
    const typeRaw = cell(row, cols.type);
    const amountRaw = cols.amount != null ? parseAmount(cell(row, cols.amount)) : null;
    const debit = cols.debit != null ? parseAmount(cell(row, cols.debit)) : null;
    const credit = cols.credit != null ? parseAmount(cell(row, cols.credit)) : null;
    if (
      SKIP_NOTE.test(note) ||
      SKIP_NOTE.test(dateRaw) ||
      /^(from|to|created|avail|ledger|bank|account)\b/i.test(dateRaw)
    ) {
      skipped += 1;
      continue;
    }
    const date = parseDate(dateRaw, preferDMY, yearHint);
    if (!date) {
      skipped += 1;
      continue;
    }
    if (amountRaw != null) amountSamples.push(amountRaw);
    parsed.push({ date, amountRaw, debit, credit, note, typeRaw });
  }

  const style = cols.debit != null || cols.credit != null
    ? "debit-credit"
    : amountSamples.some((n) => n < 0)
      ? "signed"
      : "unsigned";

  const raw: Omit<StatementDraft, "key" | "duplicate" | "included">[] = [];
  for (const p of parsed) {
    const resolved = resolveAmountAndType(p, style);
    if (!resolved) {
      skipped += 1;
      continue;
    }
    raw.push({
      date: p.date,
      amount: resolved.amount,
      type: resolved.type,
      note: p.note,
      categoryId: categorize(p.note, resolved.type),
    });
  }

  const bank = fingerprintBank(headers);
  const warnings: string[] = [];
  if (bank && BANK_LABEL[bank]) {
    warnings.push(`Read as ${BANK_LABEL[bank]}.`);
  }
  if (style === "unsigned") {
    warnings.push("Amounts had no minus signs, so income was detected from words like salary or deposit.");
  }
  return finalize(raw, bank ? `${bank}-${style}` : `csv-${style}`, skipped, warnings);
}

function resolveAmountAndType(
  p: { amountRaw: number | null; debit: number | null; credit: number | null; note: string; typeRaw: string },
  style: "signed" | "unsigned" | "debit-credit",
): { amount: number; type: TxType } | null {
  if (style === "debit-credit") {
    const d = Math.abs(p.debit ?? 0);
    const c = Math.abs(p.credit ?? 0);
    if (c > 0 && d === 0) return { amount: c, type: "income" };
    if (d > 0 && c === 0) return { amount: d, type: "expense" };
    if (c > 0 && d > 0) return c >= d ? { amount: c, type: "income" } : { amount: d, type: "expense" };
  }
  if (p.amountRaw == null || p.amountRaw === 0) return null;
  const abs = Math.abs(p.amountRaw);
  if (style === "signed") {
    return { amount: abs, type: p.amountRaw < 0 ? "expense" : "income" };
  }
  if (INCOME_TYPE.test(p.typeRaw) || isIncomeNote(p.note)) return { amount: abs, type: "income" };
  if (EXPENSE_TYPE.test(p.typeRaw)) return { amount: abs, type: "expense" };
  return { amount: abs, type: "expense" };
}

function isIncomeNote(note: string) {
  return /\b(salary|salaire|wages?|payroll|dividend|interest|refund|reimburse|payment received|tax refund|invoice)\b/i.test(note);
}

function headerScore(cells: string[]) {
  let s = 0;
  const folded = cells.map((c) => foldHeader(c));
  const joined = folded.join(" | ");
  if (DATE_H.test(joined)) s += 4;
  if (folded.some((n) => AMOUNT_H.test(n) || isDebitCol(n) || isCreditCol(n)) || /\bamount\b/.test(joined)) s += 4;
  if (DESC_H.test(joined)) s += 2;
  if (folded.some((n) => TYPE_H.test(n))) s += 1;
  for (const c of cells) {
    if (/^\d{1,4}[/-]\d{1,2}[/-]\d{1,4}$/.test(c.trim())) s -= 3;
    if (/^-?\$?\d[\d,]*\.\d{2}$/.test(c.trim())) s -= 2;
  }
  return s;
}

function isDebitCol(n: string) {
  return (
    /amount\s*\(\s*debit\s*\)/.test(n) ||
    /^(debit|withdrawal|withdrawals|money out|paid out|outflow|debits)(\s+amount)?$/.test(n) ||
    /^dr(\s+amount)?$/.test(n)
  );
}

function isCreditCol(n: string) {
  return (
    /amount\s*\(\s*credit\s*\)/.test(n) ||
    /^(credit|deposit|deposits|money in|paid in|receipts|inflow|credits)(\s+amount)?$/.test(n) ||
    /^cr(\s+amount)?$/.test(n)
  );
}

function fingerprintBank(headers: string[]): string | null {
  const h = headers.map(foldHeader);
  const set = new Set(h);
  const blob = h.join(" | ");
  if (set.has("unique id") && set.has("tran type") && set.has("payee")) return "asb";
  if (set.has("foreigncurrencyamount") || set.has("conversioncharge")) return "anz";
  if (set.has("type") && set.has("details") && set.has("particulars") && set.has("amount") && set.has("date")) return "anz";
  if (set.has("withdrawals") && set.has("deposits")) return "anz";
  if (set.has("other party") && (set.has("analysis code") || set.has("particulars"))) return "westpac";
  if (set.has("debit amount") && set.has("credit amount")) return "westpac";
  if (set.has("narration")) return "westpac";
  if (
    blob.includes("source code") ||
    set.has("amount (credit)") ||
    set.has("amount (debit)") ||
    set.has("tp name") ||
    set.has("op name") ||
    set.has("memo/description")
  ) {
    return "kiwibank";
  }
  if (set.has("this party account") || set.has("originating bank/branch")) return "bnz";
  if (set.has("account") && set.has("description") && set.has("amount") && set.has("balance") && set.has("date") && h.length <= 6) {
    return "bnz";
  }
  if (set.has("reference1") && set.has("reference2")) return "national-bank";
  return null;
}

const BANK_LABEL: Record<string, string> = {
  anz: "ANZ",
  asb: "ASB",
  westpac: "Westpac",
  kiwibank: "Kiwibank",
  bnz: "BNZ",
  "national-bank": "National Bank",
  tsb: "TSB",
};


function foldHeader(s: string) {
  return s
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’]/g, "")
    .trim();
}

function mapColumns(headers: string[], sample: string[][]) {
  const cols: { date?: number; amount?: number; debit?: number; credit?: number; desc: number[]; type?: number } = { desc: [] };
  headers.forEach((h, i) => {
    const n = foldHeader(h);
    if (IGNORE_H.test(n) && !DATE_H.test(n)) return;
    if (cols.date == null && DATE_H.test(n) && !/processed|value date/i.test(n)) cols.date = i;
    else if (cols.date == null && DATE_H.test(n)) cols.date = i;
    if (isDebitCol(n)) cols.debit = i;
    else if (isCreditCol(n)) cols.credit = i;
    else if (AMOUNT_H.test(n) || /^amount$/i.test(n)) cols.amount = i;
    if (TYPE_H.test(n)) cols.type = i;
    if (DESC_H.test(n) && !IGNORE_H.test(n) && !isDebitCol(n) && !isCreditCol(n) && !AMOUNT_H.test(n)) cols.desc.push(i);
  });
  if (cols.date == null || (cols.amount == null && cols.debit == null && cols.credit == null)) {
    inferColumns(cols, sample, headers.length || guessWidth(sample), headers);
  }
  if (!cols.desc.length && headers.length) {
    headers.forEach((_, i) => {
      if (i !== cols.date && i !== cols.amount && i !== cols.debit && i !== cols.credit && i !== cols.type) {
        const n = foldHeader(headers[i] ?? "");
        if (!IGNORE_H.test(n)) cols.desc.push(i);
      }
    });
  }
  return cols;
}

function guessWidth(sample: string[][]) {
  return sample.reduce((m, r) => Math.max(m, r.length), 0);
}

function inferColumns(
  cols: { date?: number; amount?: number; debit?: number; credit?: number; desc: number[]; type?: number },
  sample: string[][],
  width: number,
  headers: string[] = [],
) {
  const scores = Array.from({ length: width }, () => ({ date: 0, amount: 0, text: 0 }));
  for (const row of sample) {
    for (let i = 0; i < width; i++) {
      const header = foldHeader(headers[i] ?? "");
      if (IGNORE_H.test(header)) continue;
      const v = cell(row, i);
      if (parseDate(v, true)) scores[i].date += 1;
      if (parseAmount(v) != null) scores[i].amount += 1;
      if (/[a-z]/i.test(v)) scores[i].text += 1;
    }
  }
  if (cols.date == null) {
    let best = -1;
    scores.forEach((s, i) => {
      if (s.date > best) {
        best = s.date;
        cols.date = i;
      }
    });
  }
  if (cols.amount == null && cols.debit == null) {
    const amountCols = scores
      .map((s, i) => ({ i, amount: s.amount }))
      .filter((s) => s.i !== cols.date && s.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    if (amountCols.length >= 2 && complementary(amountCols[0].i, amountCols[1].i, sample)) {
      const a = Math.min(amountCols[0].i, amountCols[1].i);
      const b = Math.max(amountCols[0].i, amountCols[1].i);
      cols.debit = a;
      cols.credit = b;
    } else if (amountCols.length) {
      cols.amount = amountCols[0].i;
    }
  }
  if (!cols.desc.length) {
    scores.forEach((s, i) => {
      if (i !== cols.date && i !== cols.amount && i !== cols.debit && i !== cols.credit && s.text > 0) cols.desc.push(i);
    });
  }
}

function complementary(a: number, b: number, sample: string[][]) {
  let exclusive = 0;
  for (const row of sample) {
    const va = parseAmount(cell(row, a));
    const vb = parseAmount(cell(row, b));
    const ha = va != null && va !== 0;
    const hb = vb != null && vb !== 0;
    if (ha !== hb) exclusive += 1;
  }
  return exclusive >= Math.max(1, Math.ceil(sample.length / 2));
}

function detectDMY(rows: string[][], dateCol: number) {
  let dmy = 0;
  let mdy = 0;
  for (const row of rows) {
    const v = cell(row, dateCol);
    const m = v.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
    if (!m) continue;
    const a = Number(m[1]);
    const b = Number(m[2]);
    if (a > 12) dmy += 1;
    if (b > 12) mdy += 1;
  }
  if (mdy > dmy) return false;
  return true;
}

function detectDelimiter(text: string) {
  const lines = text.split("\n").filter((l) => l.trim()).slice(0, 8);
  const counts = { ",": 0, ";": 0, "\t": 0 };
  for (const line of lines) {
    counts[","] += (line.match(/,/g) ?? []).length;
    counts[";"] += (line.match(/;/g) ?? []).length;
    counts["\t"] += (line.match(/\t/g) ?? []).length;
  }
  const entries = Object.entries(counts) as ["," | ";" | "\t", number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][1] > 0 ? entries[0][0] : ",";
}

function splitCsv(text: string, delimiter: string) {
  const rows: string[][] = [];
  let row: string[] = [];
  let cellVal = "";
  let i = 0;
  let quoted = false;
  while (i < text.length) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cellVal += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      cellVal += c;
      i += 1;
      continue;
    }
    if (c === '"') {
      quoted = true;
      i += 1;
      continue;
    }
    if (c === delimiter) {
      row.push(cellVal);
      cellVal = "";
      i += 1;
      continue;
    }
    if (c === "\n") {
      row.push(cellVal);
      rows.push(row);
      row = [];
      cellVal = "";
      i += 1;
      continue;
    }
    cellVal += c;
    i += 1;
  }
  if (cellVal.length || row.length) {
    row.push(cellVal);
    rows.push(row);
  }
  return rows;
}

function cell(row: string[], i: number | undefined) {
  if (i == null || i < 0) return "";
  return (row[i] ?? "").trim();
}

function joinNote(parts: string[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const t = p.replace(/\s+/g, " ").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out.join(" · ").slice(0, 140);
}

export function parseAmount(raw: string): number | null {
  if (raw == null) return null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—") return null;
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (/\bDR\b/i.test(s) && !/\bCR\b/i.test(s)) {
    sign = -1;
    s = s.replace(/\bDR\b/i, "");
  }
  s = s.replace(/\bCR\b/i, "");
  s = s.replace(/(NZD|USD|AUD|GBP|EUR|CAD|\$|£|€)/gi, "").trim();
  if (s.startsWith("-")) {
    sign *= -1;
    s = s.slice(1);
  }
  if (s.startsWith("+")) s = s.slice(1);
  s = s.replace(/\s/g, "");
  if (!s) return null;
  if (/^\d{1,3}(\.\d{3})+,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  else s = s.replace(/,/g, "");
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * sign * 100) / 100;
}

export function parseDate(raw: string, preferDMY: boolean, yearHint?: number): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  let m = s.match(/^(\d{4})[/.\-](\d{1,2})[/.\-](\d{1,2})/);
  if (m) return iso(m[1], m[2], m[3]);
  m = s.match(/^(\d{4})(\d{2})(\d{2})(?:\d{2,6})?$/);
  if (m) return iso(m[1], m[2], m[3]);
  m = s.match(/^(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2,4})/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    const y = expandYear(m[3]);
    if (a > 12 && b <= 12) return iso(y, b, a);
    if (b > 12 && a <= 12) return iso(y, a, b);
    return preferDMY ? iso(y, b, a) : iso(y, a, b);
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\s+(\d{2,4})/);
  if (m) {
    const month = monthNum(m[2]);
    if (month) return iso(expandYear(m[3]), month, m[1]);
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{2,4})/);
  if (m) {
    const month = monthNum(m[1]);
    if (month) return iso(expandYear(m[3]), month, m[2]);
  }
  m = s.match(/^(\d{1,2})\s+([A-Za-z]{3,9})\.?$/);
  if (m) {
    const month = monthNum(m[2]);
    const y = yearHint ?? new Date().getFullYear();
    if (month) return iso(y, month, m[1]);
  }
  return null;
}

function expandYear(y: string) {
  if (y.length === 2) {
    const n = Number(y);
    return n >= 70 ? 1900 + n : 2000 + n;
  }
  return Number(y);
}

function monthNum(name: string) {
  const key = name.slice(0, 3).toLowerCase();
  const map: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  return map[key];
}

function iso(y: string | number, m: string | number, d: string | number) {
  const year = Number(y);
  const month = Number(m);
  const day = Number(d);
  if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (dt.getFullYear() !== year || dt.getMonth() !== month - 1 || dt.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function categorize(note: string, type: TxType): string {
  for (const rule of RULES) {
    if (rule.re.test(note)) {
      const cat = getCategory(rule.id);
      if (cat.type === type) return rule.id;
      return type === "income" ? incomeFallback(rule.id) : "other";
    }
  }
  return type === "income" ? "other-income" : "other";
}

function incomeFallback(id: string) {
  if (id === "salary" || id === "freelance" || id === "investments" || id === "gifts" || id === "other-income") return id;
  return "other-income";
}

export function categoriesForSelect(type: TxType) {
  return CATEGORIES.filter((c) => c.type === type);
}
