import { todayISO } from "../utils/date-utils.js";

export function createEntry(overrides = {}) {
  return {
    id: crypto.randomUUID(),
    date: todayISO(),
    weightKg: null,
    waistCm: null,
    neckCm: null,
    hipCm: null,
    bodyFatManual: null,
    bodyFatMethod: "navy",
    notes: "",
    ...overrides
  };
}
