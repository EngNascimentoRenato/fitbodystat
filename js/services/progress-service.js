import { calculateBmi, classifyBmi, weightForBmi } from "./bmi-service.js";
import { resolveBodyFat, classifyBodyFat } from "./body-fat-service.js";

export function getWeeklyChangeGoal(profile) {
  return Math.abs(Number(profile.weeklyChangeGoalKg ?? profile.weeklyLossGoalKg ?? 0.5)) || 0.5;
}

export function getGoalWeight(profile) {
  if (profile.goalWeightKg !== null && profile.goalWeightKg !== undefined && profile.goalWeightKg !== "" && Number.isFinite(Number(profile.goalWeightKg))) {
    return Number(profile.goalWeightKg);
  }
  const targetBmi = Number(profile.targetBmi || 24.9);
  const calculated = weightForBmi(profile.heightCm, targetBmi);
  return calculated ? Number(calculated.toFixed(1)) : null;
}

export function getGoalDirection(profile) {
  const start = profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "" ? null : Number(profile.startWeightKg);
  const goal = getGoalWeight(profile);
  if (!Number.isFinite(start) || !Number.isFinite(goal) || start === goal) return "maintain";
  return goal < start ? "loss" : "gain";
}

export function calculateGoalDeadlineMonths(profile) {
  const start = profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "" ? null : Number(profile.startWeightKg);
  const goal = getGoalWeight(profile);
  const weekly = getWeeklyChangeGoal(profile);
  if (!Number.isFinite(start) || !Number.isFinite(goal) || !weekly) return null;
  const months = Math.abs(start - goal) / weekly / 4.33;
  return Number(Math.max(months, 0).toFixed(1));
}

export function calculateWeeklyChangeForDeadline(profile) {
  const start = profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "" ? null : Number(profile.startWeightKg);
  const goal = getGoalWeight(profile);
  const months = Number(profile.goalDeadlineMonths);
  if (!Number.isFinite(start) || !Number.isFinite(goal) || !months) return getWeeklyChangeGoal(profile);
  return Number((Math.abs(start - goal) / (months * 4.33)).toFixed(2));
}

export function getGoalDeadlineMonths(profile) {
  return Number(profile.goalDeadlineMonths) || calculateGoalDeadlineMonths(profile) || 12;
}

export function plannedWeightAtMonth(profile, month) {
  const start = profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "" ? null : Number(profile.startWeightKg);
  const goal = getGoalWeight(profile);
  const deadline = getGoalDeadlineMonths(profile);
  if (!Number.isFinite(start) || !Number.isFinite(goal) || !deadline) return null;
  if (month >= deadline) return goal;
  return Number((start + (goal - start) * (month / deadline)).toFixed(1));
}

export function plannedWaistAtMonth(profile, month) {
  const startWaist = profile.startWaistCm === null || profile.startWaistCm === undefined || profile.startWaistCm === "" ? null : Number(profile.startWaistCm);
  const startWeight = profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "" ? null : Number(profile.startWeightKg);
  const plannedWeight = plannedWeightAtMonth(profile, month);
  if (!Number.isFinite(startWaist) || !Number.isFinite(startWeight) || !Number.isFinite(plannedWeight)) return null;
  const weightDelta = plannedWeight - startWeight;
  return Number(Math.max(0, startWaist + weightDelta).toFixed(0));
}

export function plannedWeightAtDay(profile, day) {
  const month = day / 30.4375;
  return plannedWeightAtMonth(profile, month);
}

export function plannedWaistAtDay(profile, day) {
  const month = day / 30.4375;
  return plannedWaistAtMonth(profile, month);
}

export function generatePlannedSeries(profile, unit = "weight") {
  const deadline = getGoalDeadlineMonths(profile);
  const totalMonths = Math.max(12, Math.ceil(deadline));
  const totalDays = Math.ceil(totalMonths * 30.4375);
  const points = [];
  for (let day = 0; day <= totalDays; day += 7) {
    const value = unit === "waist" ? plannedWaistAtDay(profile, day) : plannedWeightAtDay(profile, day);
    if (Number.isFinite(value)) {
      points.push({ label: `${day} dias`, value, x: day });
    }
  }
  if (points.at(-1)?.x !== totalDays) {
    const value = unit === "waist" ? plannedWaistAtDay(profile, totalDays) : plannedWeightAtDay(profile, totalDays);
    if (Number.isFinite(value)) points.push({ label: `${totalDays} dias`, value, x: totalDays });
  }
  return points;
}

export function enrichEntries(profile, entries) {
  return [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((entry, index, sorted) => {
      const previous = sorted[index - 1];
      const bmi = calculateBmi(entry.weightKg, profile.heightCm);
      const bodyFat = resolveBodyFat(entry, profile);
      return {
        ...entry,
        bmi,
        bmiClass: classifyBmi(bmi),
        bodyFat,
        bodyFatClass: classifyBodyFat(profile.sex, bodyFat),
        weekDiff: previous ? entry.weightKg - previous.weightKg : 0,
        accumulatedLoss: profile.startWeightKg ? profile.startWeightKg - entry.weightKg : 0
      };
    });
}

export function getLatestEntry(profile, entries) {
  const enriched = enrichEntries(profile, entries);
  return enriched.at(-1) || null;
}

export function getMilestones(profile, latest) {
  const start = profile.startWeightKg || latest?.weightKg || 0;
  const height = profile.heightCm;
  const current = latest?.weightKg || start;
  const currentWaist = latest?.waistCm || profile.startWaistCm;
  const obesityExit = weightForBmi(height, 30);
  const normalLimit = weightForBmi(height, 25);
  const goal = getGoalWeight(profile);
  const direction = getGoalDirection(profile);

  if (!start || !current) return [];

  const weightMilestones = direction === "gain"
    ? [
        {
          title: "Ganho de 5% do peso",
          target: start * 1.05,
          detail: `${(start * 0.05).toFixed(1).replace(".", ",")} kg de ganho acumulado`,
          mode: "gain"
        },
        {
          title: "Ganho de 10% do peso",
          target: start * 1.1,
          detail: `${(start * 0.1).toFixed(1).replace(".", ",")} kg de ganho acumulado`,
          mode: "gain"
        }
      ]
    : [
    {
      title: "Perda de 5% do peso",
      target: start * 0.95,
      detail: `${(start * 0.05).toFixed(1).replace(".", ",")} kg de perda acumulada`,
      mode: "loss"
    },
    {
      title: "Perda de 10% do peso",
      target: start * 0.9,
      detail: `${(start * 0.1).toFixed(1).replace(".", ",")} kg de perda acumulada`,
      mode: "loss"
    }
  ];

  return [
    ...weightMilestones,
    {
      title: "Meta de peso",
      target: goal,
      detail: direction === "gain" ? "Peso final planejado para ganho" : "Peso final planejado para perda",
      mode: direction
    },
    {
      title: "Sair da obesidade",
      target: obesityExit,
      detail: "IMC abaixo de 30",
      mode: "loss"
    },
    {
      title: "Cintura abaixo de 102 cm",
      waistTarget: 102,
      detail: "Marco importante de circunferencia abdominal"
    },
    {
      title: "Limite do peso normal",
      target: normalLimit,
      detail: "IMC abaixo de 25",
      mode: "loss"
    }
  ].filter((milestone) => Number.isFinite(Number(milestone.target)) || Number.isFinite(Number(milestone.waistTarget))).map((milestone) => {
    const isGain = milestone.mode === "gain";
    const reached = milestone.waistTarget ? currentWaist < milestone.waistTarget : isGain ? current >= milestone.target : current <= milestone.target;
    const remaining = milestone.waistTarget ? currentWaist - milestone.waistTarget : isGain ? milestone.target - current : current - milestone.target;
    return { ...milestone, reached, remaining };
  });
}

export function nextMilestone(profile, latest) {
  return getMilestones(profile, latest).find((milestone) => !milestone.reached) || null;
}

export function goalProgress(profile, latest) {
  const goal = getGoalWeight(profile);
  if (!profile.startWeightKg || !goal || !latest?.weightKg) return 0;
  const total = goal - profile.startWeightKg;
  const done = latest.weightKg - profile.startWeightKg;
  if (total === 0) return 100;
  return Math.round(Math.min(Math.max((done / total) * 100, 0), 100));
}
