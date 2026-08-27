import { defineEventHandler } from "h3";
import { handlePreflight } from "../lib/cove-cors";

export default defineEventHandler((event) => {
  const path = event.path || "";
  if (!path.startsWith("/api/")) return;
  if (handlePreflight(event)) return "";
});
