import { calculateBmi, classifyBmi, weightForBmi } from "../services/bmi-service.js";
import {
  getGoalDeadlineMonths,
  getProgressMode,
  plannedWaistAtMonth,
  plannedWeightAtMonth
} from "../services/progress-service.js";
import { addMonths, formatDate, todayISO } from "../utils/date-utils.js";

export function calculateGoalWeightByBmi(heightCm, targetBmi = 24.9) {
  const weight = weightForBmi(heightCm, targetBmi);
  return weight ? Number(weight.toFixed(1)) : null;
}

export const defaultMonthlyPlan = [];

function planRow(profile, month, isFinal = false) {
  const weightKg = plannedWeightAtMonth(profile, month);
  const waistCm = plannedWaistAtMonth(profile, month);
  const bmi = calculateBmi(weightKg, profile.heightCm);
  const wholeMonths = Math.floor(month);
  const fraction = month - wholeMonths;
  const monthDate = profile.startDate ? addMonths(profile.startDate, wholeMonths) : null;
  const date = monthDate && fraction
    ? new Date(`${monthDate}T00:00:00`)
    : null;
  if (date) date.setDate(date.getDate() + Math.round(fraction * 30.4375));
  const dateISO = date
    ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
    : monthDate;
  return {
    label: dateISO ? formatDate(dateISO) : month === 0 ? "Início" : `${month} meses`,
    date: dateISO,
    month,
    isFinal,
    weightKg,
    waistCm,
    status: classifyBmi(bmi)
  };
}

export function createDefaultMonthlyPlan(profile) {
  const maintenance = getProgressMode(profile) === "maintain";
  const deadline = maintenance ? 12 : Math.max(0, getGoalDeadlineMonths(profile));
  const wholeMonths = Math.floor(deadline);
  const rows = [];

  for (let month = 0; month <= wholeMonths; month += 1) {
    rows.push(planRow(profile, month, !maintenance && month === deadline));
  }
  if (!maintenance && deadline > wholeMonths) {
    rows.push(planRow(profile, deadline, true));
  }

  return rows;
}

export function normalizeMonthlyPlan(profile, plan = [], referenceDate = todayISO()) {
  const schedule = createDefaultMonthlyPlan(profile);
  const savedByMonth = new Map(plan.map((item) => [Number(item.month), item]));
  const source = schedule.map((scheduled) => ({
    ...(savedByMonth.get(Number(scheduled.month)) || scheduled),
    label: scheduled.label,
    date: scheduled.date,
    month: scheduled.month,
    isFinal: scheduled.isFinal
  }));
  const startWeight = Number(profile.startWeightKg);
  return source.map((item, index) => {
    const fallbackWeight = plannedWeightAtMonth(profile, index);
    const fallbackWaist = plannedWaistAtMonth(profile, index);
    const weightKg = Number.isFinite(Number(item.weightKg)) ? Number(item.weightKg) : fallbackWeight;
    const waistCm = Number.isFinite(Number(item.waistCm)) ? Number(item.waistCm) : fallbackWaist;
    const bmi = calculateBmi(weightKg, profile.heightCm);
    const month = Number.isFinite(Number(item.month)) ? Number(item.month) : index;
    const date = profile.startDate ? addMonths(profile.startDate, month) : null;
    const nextScheduledDate = source[index + 1]?.date || null;
    const nextDate = nextScheduledDate || (date ? addMonths(date, 1) : null);

    return {
      label: date ? formatDate(date) : item.label || (index === 0 ? "Início" : `${index} meses`),
      date,
      isCurrent: Boolean(date && referenceDate >= date && referenceDate < nextDate),
      isFinal: item.isFinal === true,
      month,
      weightKg,
      lossKg: Number.isFinite(startWeight) && Number.isFinite(weightKg) ? Number((startWeight - weightKg).toFixed(1)) : null,
      bmi,
      waistCm,
      status: item.status || classifyBmi(bmi)
    };
  });
}
