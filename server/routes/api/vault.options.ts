import { defineEventHandler } from "h3";
import { handlePreflight } from "../../lib/cove-cors";

export default defineEventHandler((event) => {
  handlePreflight(event);
  return "";
});
