export const COVE_SITE = {
  name: "Cove",
  tagline: "Quiet money",
  website: "https://cove-website-phi.vercel.app/",
  app: "https://cove-finance.vercel.app/",
  api: "https://cove-finance.vercel.app",
  github: "https://github.com/preet1655nz-rgb/cove-finance",
  surfaces: ["website", "pwa"] as const,
  features: [
    "overview",
    "calendar",
    "activity",
    "reconcile",
    "bills",
    "budgets",
    "insights",
    "reports",
    "statement-import",
    "ask-cove",
  ],
};

export function coveStatus() {
  return {
    ok: true,
    service: "cove-finance",
    stack: "fullstack",
    frontend: "tanstack-start+react",
    backend: "nitro+vercel-server",
    storage: "browser-local + optional pglite auth",
    pwa: true,
    website: true,
    askCove: "local-repo",
    surfaces: COVE_SITE.surfaces,
    features: COVE_SITE.features,
    github: COVE_SITE.github,
    app: COVE_SITE.app,
    websiteUrl: COVE_SITE.website,
    api: COVE_SITE.api,
    time: new Date().toISOString(),
  };
}

export function coveApiUrl(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (typeof window === "undefined") return p;
  const host = window.location.hostname;
  if (
    host === "cove-finance.vercel.app" ||
    host === "localhost" ||
    host === "127.0.0.1" ||
    host.endsWith(".grok-sandbox.com")
  ) {
    return p;
  }
  return `${COVE_SITE.api}${p}`;
}
