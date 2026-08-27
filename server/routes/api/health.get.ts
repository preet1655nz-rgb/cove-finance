import { coveStatus } from "../../../src/lib/site";

export default defineEventHandler(() => {
  const status = coveStatus();
  return { ok: status.ok, service: status.service, time: status.time };
});
