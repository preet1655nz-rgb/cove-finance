export const COVE_SITE = {
  name: "Cove",
  tagline: "Quiet money",
  website: "https://cove-website-phi.vercel.app/",
  app: "https://cove-finance.vercel.app/",
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
    time: new Date().toISOString(),
  };
}
