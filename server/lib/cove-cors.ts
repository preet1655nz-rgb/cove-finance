import { getHeader, getMethod, setHeader, setResponseStatus, type H3Event } from "h3";

const ALLOWED = new Set([
  "https://cove-finance.vercel.app",
  "https://cove-website-phi.vercel.app",
]);

function allowedOrigin(origin: string) {
  if (!origin) return "";
  if (ALLOWED.has(origin)) return origin;
  try {
    const host = new URL(origin).hostname;
    if (host.endsWith("-singh-gp-s-projects.vercel.app")) return origin;
    if (host === "localhost" || host === "127.0.0.1") return origin;
  } catch {
    return "";
  }
  return "";
}

export function applyCors(event: H3Event) {
  const origin = allowedOrigin(String(getHeader(event, "origin") || ""));
  if (!origin) return false;
  setHeader(event, "Access-Control-Allow-Origin", origin);
  setHeader(event, "Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  setHeader(event, "Access-Control-Allow-Headers", "content-type");
  setHeader(event, "Access-Control-Max-Age", "86400");
  setHeader(event, "Vary", "Origin");
  return true;
}

export function handlePreflight(event: H3Event) {
  applyCors(event);
  if (getMethod(event) === "OPTIONS") {
    setResponseStatus(event, 204);
    return true;
  }
  return false;
}
