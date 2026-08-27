import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AccountSessionProvider } from "@/lib/account-session";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { PwaRegister } from "@/components/pwa-register";
import { Toaster } from "@/components/ui/sonner";
import appCss from "../styles.css?url";

const APP_NAME = "Cove — Quiet money";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#1C1B18" },
      { name: "apple-mobile-web-app-title", content: "Cove" },
      { name: "mobile-web-app-capable", content: "yes" },
      {
        name: "description",
        content: "Cove is a full-stack website and PWA for income, living spend, budgets, bills, insights and reports. Data stays in your browser.",
      },
      { property: "og:title", content: "Cove — Quiet money" },
      {
        property: "og:description",
        content: "A quiet harbor for income, spending, and reports. Website and home-screen app.",
      },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/cove-mark-32.png" },
      { rel: "apple-touch-icon", href: "/cove-mark-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
    ],
  }),
  component: () => (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body>
        <PreviewHostBridge />
        <PwaRegister />
        <AccountSessionProvider>
          <AuthProvider>
            <Outlet />
            <Toaster />
          </AuthProvider>
        </AccountSessionProvider>
        <Scripts />
      </body>
    </html>
  ),
});
