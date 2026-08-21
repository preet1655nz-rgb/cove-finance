export type KnowledgeCard = {
  id: string;
  tags: string[];
  title: string;
  body: string;
};

export const KNOWLEDGE: KnowledgeCard[] = [
  {
    id: "tax-bands",
    tags: ["tax", "paye", "ird", "income tax", "bracket", "rate", "2026"],
    title: "NZ income tax bands 2026/27",
    body: "From 1 April 2025 (still used 2026/27): 10.5% to $15,600; 17.5% to $53,500; 30% to $78,100; 33% to $180,000; 39% above. Tax is progressive — only the slice in each band is taxed at that rate. Ask “tax on 90000” for a worked estimate.",
  },
  {
    id: "acc",
    tags: ["acc", "levy", "earners"],
    title: "ACC earners’ levy",
    body: "2026/27 ACC earners’ levy is $1.75 per $100 of liable earnings, capped at $156,641. It is deducted with PAYE and is extra to income tax.",
  },
  {
    id: "kiwisaver",
    tags: ["kiwisaver", "ks", "super", "retirement", "employer", "contribution"],
    title: "KiwiSaver 2026",
    body: "From 1 April 2026 the default employee and matching employer rates are 3.5% (rising to 4% on 1 April 2028). You can apply for a temporary drop back to 3%. Common member rates: 3.5, 4, 6, 8, 10%. Employer contributions are on top of your wage, not taken from take-home.",
  },
  {
    id: "ks-govt",
    tags: ["kiwisaver", "government", "member tax credit", "kickstart"],
    title: "KiwiSaver government contribution",
    body: "From 1 July 2025 the Crown pays 25c per $1 you contribute, max $260.72 a year. It stops if taxable income is over $180,000. 16- and 17-year-olds now qualify.",
  },
  {
    id: "pir",
    tags: ["pir", "pie", "sharesies", "fund", "prescribed investor"],
    title: "Prescribed investor rate (PIR)",
    body: "PIEs (KiwiSaver funds, Sharesies PIE funds) tax you at 10.5%, 17.5% or 28% based on your last two years’ taxable income. $0–$15,600 → 10.5%; to $53,500 → 17.5%; above → 28%. Using the wrong PIR means IRD later squares you up.",
  },
  {
    id: "gst",
    tags: ["gst", "goods and services", "15%", "inclusive", "exclusive"],
    title: "GST",
    body: "GST is 15%. Inclusive → exclusive: divide by 1.15. Exclusive → inclusive: multiply by 1.15. The GST portion of an inclusive price is amount − amount/1.15. Most supermarket and café prices you see are GST-inclusive.",
  },
  {
    id: "student-loan",
    tags: ["student loan", "sl", "repayment", "studylink"],
    title: "Student loan repayments",
    body: "If you live in NZ, 12% of income above $24,128 a year (2026 and 2027 tax years) is repaid via PAYE. Weekly threshold about $464. No repayment below the threshold. Ask “student loan on 70000” for a number.",
  },
  {
    id: "emergency",
    tags: ["emergency fund", "rainy day", "buffer", "cash"],
    title: "Emergency fund",
    body: "Hold 3–6 months of lived spending in an easy-access account. Count rent, food, transport, utilities, insurance — not transfers to your own savings and not one-off holidays. Cove can size this from your ledger.",
  },
  {
    id: "503020",
    tags: ["50/30/20", "budget", "needs", "wants", "save"],
    title: "50/30/20",
    body: "Of take-home pay: ~50% needs (housing, groceries, transport, utilities, insurance), 30% wants (dining, cafés, leisure, shopping), 20% saving and investing. It is a compass, not a law. Housing over 30–35% of take-home is a squeeze for most NZ households.",
  },
  {
    id: "transfers",
    tags: ["transfer", "savings", "westpac", "bill payment", "not spending"],
    title: "Transfers are not spending",
    body: "Moving money to your own savings, another bank, Gem Visa, or a credit-card payment is a transfer. Cove excludes those from lived spend and savings rate. Teach it: “guri wstpac saving is a transfer to Westpac savings”.",
  },
  {
    id: "investing",
    tags: ["investing", "sharesies", "hatch", "investnow", "kernel", "index", "etf"],
    title: "Investing vs shopping",
    body: "Sharesies, Hatch, InvestNow, Kernel, Smartshares are investing (or transfers into investments), not shopping. Low-fee broadly diversified index funds beat most stock-picking for long horizons. Fees and PIR matter more than last month’s return.",
  },
  {
    id: "mortgage",
    tags: ["mortgage", "home loan", "lvr", "house", "rent vs buy"],
    title: "Mortgage comfort",
    body: "A common comfort band is 25–30% of take-home on the home loan. Banks use their own serviceability tests (often stressing rates). LVR rules and deposits still apply. Cove can size 25% and 30% of your monthly net from the books.",
  },
  {
    id: "min-wage",
    tags: ["minimum wage", "hourly", "employment"],
    title: "Minimum wage",
    body: "From 1 April 2026 the adult minimum wage is $23.95 an hour (before tax). Starting-out and training rates are $19.16. That is about $49,800 a year on 40 hours if work is steady.",
  },
  {
    id: "subscriptions",
    tags: ["subscription", "netflix", "spotify", "recurring"],
    title: "Subscriptions",
    body: "List every recurring pull. If you would not buy it again today, cancel. A $20/month unused sub is $240 a year. Cove can cap a subscriptions budget and log bills on a day of month.",
  },
  {
    id: "groceries-nz",
    tags: ["groceries", "countdown", "pak n save", "new world", "farro", "woolworths"],
    title: "NZ groceries",
    body: "Pak’nSave, Woolworths/Countdown, New World, Farro, and the warehouse food aisle are groceries. Meal deals and cafés are dining/cafés, not groceries. A weekly shop that quietly climbs is usually the first place a budget breaks.",
  },
  {
    id: "banks",
    tags: ["anz", "asb", "bnz", "westpac", "kiwibank", "tsb", "statement"],
    title: "NZ bank statements",
    body: "Cove reads ANZ, ASB, BNZ, Westpac, Kiwibank, TSB (and similar) PDF/CSV/OFX. Direct credits = income, withdrawals = expenses. Password-protected PDFs can be unlocked in the importer. Photo-scans of paper statements often have no text — export from internet banking instead.",
  },
  {
    id: "savings-rate",
    tags: ["savings rate", "how am i doing", "net"],
    title: "Savings rate",
    body: "Cove’s savings rate is (lived income − lived spend) / lived income. Transfers between your own accounts are excluded so moving $1,400 to Westpac savings does not look like a $1,400 binge.",
  },
  {
    id: "fire",
    tags: ["fire", "retire", "independence", "fi"],
    title: "Financial independence (rough)",
    body: "A back-of-envelope FI number is 25× annual lived spend (4% rule). It is a US-rooted heuristic, not a NZ pension model. NZ Super still exists; KiwiSaver and a mortgage-free home change the maths. Use it as a horizon, not a promise.",
  },
  {
    id: "inflation",
    tags: ["inflation", "ocr", "rbnz", "interest"],
    title: "Inflation and rates",
    body: "The RBNZ sets the OCR; floating mortgages and term deposits follow. When inflation is sticky, grocery and rent lines in Cove are the first to show it. Don’t lock a long fixed mortgage solely off last month’s OCR print.",
  },
  {
    id: "debt",
    tags: ["debt", "credit card", "afterpay", "gem", "interest"],
    title: "High-interest debt",
    body: "Pay the most expensive debt first (credit cards, store cards, Afterpay missed fees) while keeping the emergency buffer. A 20% card rate beats almost any investment return. Transfers to a card are not “shopping”.",
  },
  {
    id: "insurance",
    tags: ["insurance", "life", "contents", "health", "car"],
    title: "Insurance",
    body: "Insure catastrophes you cannot cash-flow: house, contents, car (if you could not replace it), income/health if others depend on your wage. Don’t over-insure small stuff you can pay from the emergency fund.",
  },
  {
    id: "giving",
    tags: ["charity", "donation", "gift"],
    title: "Giving",
    body: "Donations to donee organisations can be worth a tax credit (usually 33.33% via IRD). Keep receipts. Tag them so they don’t vanish into Other.",
  },
  {
    id: "side-hustle",
    tags: ["gst registered", "freelance", "sole trader", "ird"],
    title: "Side income",
    body: "GST registration is generally required once taxable supplies exceed $60,000 in 12 months. Keep freelance income separate from salary. Provisional tax may apply. Cove can file invoices as freelance; it is not your GST return.",
  },
  {
    id: "brightline",
    tags: ["brightline", "property", "capital gain", "house sale"],
    title: "Selling a house",
    body: "Brightline and the main-home exclusion are specific IRD rules that have changed. Do not assume a sale is tax-free. Talk to a tax agent before you treat sale proceeds as ordinary income in Cove.",
  },
  {
    id: "working-for-families",
    tags: ["working for families", "wff", "best start", "family tax"],
    title: "Working for Families",
    body: "WFF and Best Start are income-tested IRD payments. Abatement rates and thresholds changed in 2026. Cove cannot file your family tax credit — it can only show the cash if it lands in the statement.",
  },
  {
    id: "paye-codes",
    tags: ["tax code", "m sl", "me", "primary"],
    title: "Tax codes",
    body: "M or ME is the usual primary-job code. Add SL if you have a student loan (M SL). A second job often uses SB/S. Wrong code → too little or too much PAYE. IRD’s calculator is the source of truth.",
  },
  {
    id: "ietc",
    tags: ["ietc", "independent earner", "tax credit"],
    title: "Independent earner tax credit",
    body: "IETC can apply to some people in a middle-income band who don’t get WFF or NZ Super. Eligibility is fussy. Don’t budget on it until IRD has paid it.",
  },
  {
    id: "net-wealth",
    tags: ["net worth", "assets", "liabilities"],
    title: "Net worth vs cash flow",
    body: "Cove tracks cash flow (what moved through the accounts you imported), not a full net-worth statement. KiwiSaver balance, home equity, and student-loan principal live outside this ledger unless you log them.",
  },
  {
    id: "sinking",
    tags: ["sinking fund", "car", "rego", "wof", "christmas"],
    title: "Sinking funds",
    body: "Rego, WOF, Christmas, rates, insurance annuals: divide by 12 and treat as a monthly bill so they don’t ambush the month they fall due. Cove bills with a day-of-month are for that.",
  },
  {
    id: "cafes",
    tags: ["coffee", "cafe", "allpress", "flat white"],
    title: "Cafés",
    body: "Allpress, Mojo, Starbucks, and “coffee” lines are Cafés in Cove, not groceries. A $6.50 coffee every weekday is about $1,430 a year. Harmless if you love it; expensive if you don’t.",
  },
  {
    id: "accuracy",
    tags: ["accuracy", "numbers", "hallucination"],
    title: "How Cove quotes numbers",
    body: "Ledger figures are copied from your imported and typed entries. Tax, ACC, KiwiSaver, GST, and student-loan figures are calculated from the 2026/27 public tables. If a payee is missing, upload that bank’s statement — I will not invent a balance.",
  },
];

const STOP = new Set(["a", "an", "the", "of", "to", "and", "or", "for", "in", "on", "my", "me", "i", "is", "what", "how", "do", "does", "please", "tell", "about"]);

export function tokenize(q: string) {
  return q
    .toLowerCase()
    .replace(/[’']/g, "'")
    .split(/[^a-z0-9$%/]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP.has(w));
}

export function retrieveKnowledge(question: string, limit = 3) {
  const tokens = tokenize(question);
  if (!tokens.length) return [];
  const scored = KNOWLEDGE.map((card) => {
    const hay = `${card.title} ${card.tags.join(" ")} ${card.body}`.toLowerCase();
    let score = 0;
    for (const t of tokens) {
      if (card.tags.some((tag) => tag === t || tag.includes(t) || t.includes(tag))) score += 4;
      if (card.title.toLowerCase().includes(t)) score += 3;
      if (hay.includes(t)) score += 1;
    }
    if (card.tags.some((tag) => question.toLowerCase().includes(tag))) score += 5;
    return { card, score };
  })
    .filter((x) => x.score >= 4)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((x) => x.card);
}

export function formatCards(cards: KnowledgeCard[]) {
  return cards.map((c) => `${c.title}: ${c.body}`).join("\n\n");
}
