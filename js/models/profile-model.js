import { todayISO } from "../utils/date-utils.js";

export const defaultProfile = {
  name: "",
  sex: "",
  birthDate: "",
  heightCm: null,
  startDate: todayISO(),
  startWeightKg: null,
  startWaistCm: null,
  startNeckCm: null,
  startHipCm: null,
  startBodyFatManual: null,
  startBodyFatMethod: "circumference",
  baselineLocked: false,
  baselineLockedAt: null,
  goalWeightKg: null,
  targetBmi: 24.9,
  weeklyChangeGoalKg: 0.5,
  weeklyLossGoalKg: 0.5,
  goalDeadlineMonths: null,
  goalDeadlineMode: "auto",
  goalType: "",
  customGoalLabel: "",
  weeklyActivityGoalDays: 3,
  trackActivityDuration: true,
  averageActivityDurationMinutes: 30,
  preferredActivities: []
};
