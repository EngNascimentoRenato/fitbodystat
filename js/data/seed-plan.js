import { calculateBmi, classifyBmi, weightForBmi } from "../services/bmi-service.js";
import {
  getGoalDeadlineMonths,
  plannedWaistAtMonth,
  plannedWeightAtMonth
} from "../services/progress-service.js";

export function calculateGoalWeightByBmi(heightCm, targetBmi = 24.9) {
  const weight = weightForBmi(heightCm, targetBmi);
  return weight ? Number(weight.toFixed(1)) : null;
}

export const defaultMonthlyPlan = [];

export function createDefaultMonthlyPlan(profile) {
  const totalMonths = Math.max(12, Math.ceil(getGoalDeadlineMonths(profile)));
  const rows = [];

  for (let month = 0; month <= totalMonths; month += 1) {
    const weightKg = plannedWeightAtMonth(profile, month);
    const waistCm = plannedWaistAtMonth(profile, month);
    const bmi = calculateBmi(weightKg, profile.heightCm);

    rows.push({
      label: month === 0 ? "Hoje" : `${month} ${month === 1 ? "mês" : "meses"}`,
      month,
      weightKg,
      waistCm,
      status: classifyBmi(bmi)
    });
  }

  return rows;
}

export function normalizeMonthlyPlan(profile, plan = []) {
  const source = plan.length ? plan : createDefaultMonthlyPlan(profile);
  const startWeight = Number(profile.startWeightKg);
  return source.map((item, index) => {
    const fallbackWeight = plannedWeightAtMonth(profile, index);
    const fallbackWaist = plannedWaistAtMonth(profile, index);
    const weightKg = Number.isFinite(Number(item.weightKg)) ? Number(item.weightKg) : fallbackWeight;
    const waistCm = Number.isFinite(Number(item.waistCm)) ? Number(item.waistCm) : fallbackWaist;
    const bmi = calculateBmi(weightKg, profile.heightCm);

    return {
      label: item.label || (index === 0 ? "Hoje" : `${index} meses`),
      month: Number.isFinite(Number(item.month)) ? Number(item.month) : index,
      weightKg,
      lossKg: Number.isFinite(startWeight) && Number.isFinite(weightKg) ? Number((startWeight - weightKg).toFixed(1)) : null,
      bmi,
      waistCm,
      status: item.status || classifyBmi(bmi)
    };
  });
}
