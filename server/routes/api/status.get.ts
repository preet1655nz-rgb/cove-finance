import { defineEventHandler } from "h3";
import { coveStatus } from "../../../src/lib/site";

export default defineEventHandler(() => coveStatus());
