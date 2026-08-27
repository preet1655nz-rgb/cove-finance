import { defineEventHandler } from "h3";

export default defineEventHandler(() => ({
  ok: true,
  service: "cove-finance",
  time: new Date().toISOString(),
}));
