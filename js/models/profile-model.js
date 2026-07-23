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
  baselineLocked: false,
  baselineLockedAt: null,
  goalWeightKg: null,
  targetBmi: 24.9,
  weeklyChangeGoalKg: 0.5,
  weeklyLossGoalKg: 0.5,
  goalDeadlineMonths: null
};
