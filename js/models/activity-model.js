import { todayISO } from "../utils/date-utils.js";

export function createActivity(overrides = {}) {
  const date = overrides.date || todayISO();
  return {
    id: date,
    date,
    completed: true,
    activityTypeIds: [],
    customActivityName: "",
    durationMinutes: null,
    intensity: "",
    notes: "",
    ...overrides
  };
}
