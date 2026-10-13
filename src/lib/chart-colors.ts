const NAMED: Record<string, string> = {
  salary: "var(--color-chart-1)",
  freelance: "var(--color-chart-6)",
  gig: "var(--color-chart-1)",
  investments: "var(--color-chart-4)",
  gifts: "var(--color-chart-7)",
  "other-income": "var(--color-chart-3)",
  "transfer-in": "var(--color-chart-3)",
  housing: "var(--color-chart-5)",
  groceries: "var(--color-chart-1)",
  dining: "var(--color-chart-2)",
  transport: "var(--color-chart-6)",
  fuel: "var(--color-chart-7)",
  vehicle: "var(--color-chart-8)",
  utilities: "var(--color-chart-6)",
  health: "var(--color-chart-2)",
  insurance: "var(--color-chart-5)",
  entertainment: "var(--color-chart-4)",
  shopping: "var(--color-chart-4)",
  household: "var(--color-chart-8)",
  subscriptions: "var(--color-chart-5)",
  travel: "var(--color-chart-6)",
  education: "var(--color-chart-3)",
  drinks: "var(--color-chart-2)",
  tax: "var(--color-chart-8)",
  "credit-card": "var(--color-chart-7)",
  debt: "var(--color-chart-2)",
  investing: "var(--color-chart-1)",
  savings: "var(--color-chart-4)",
  "transfer-out": "var(--color-chart-3)",
  other: "var(--color-chart-3)",
};

const FALLBACK = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-6)",
  "var(--color-chart-7)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
  "var(--color-chart-8)",
  "var(--color-chart-3)",
];

export function categoryColor(id: string, index = 0) {
  return NAMED[id] ?? FALLBACK[index % FALLBACK.length];
}
