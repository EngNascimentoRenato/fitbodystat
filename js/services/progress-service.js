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

export function createBaselineEntry(profile) {
  if (profile.startWeightKg === null || profile.startWeightKg === undefined || profile.startWeightKg === "") return null;
  const weightKg = Number(profile.startWeightKg);
  if (!profile.startDate || !Number.isFinite(weightKg)) return null;

  return {
    id: "profile-initial",
    date: profile.startDate,
    weightKg,
    waistCm: profile.startWaistCm,
    neckCm: profile.startNeckCm,
    hipCm: profile.startHipCm,
    bodyFatMethod: "navy",
    bodyFatManual: null,
    notes: "Registro inicial do perfil",
    source: "profile",
    isBaseline: true
  };
}

export function enrichEntries(profile, entries) {
  const baseline = createBaselineEntry(profile);
  const regularEntries = (entries || []).filter((entry) =>
    entry.id !== "profile-initial" && (!baseline || entry.date !== baseline.date)
  );

  return [...(baseline ? [baseline] : []), ...regularEntries]
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

function finiteNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export function getProgressMode(profile) {
  if (profile.goalType === "maintenance") return "maintain";
  if (profile.goalType === "weight-loss") return "loss";
  if (["weight-gain", "muscle-gain", "recovery"].includes(profile.goalType)) return "gain";
  return getGoalDirection(profile);
}

export function getMaintenanceStatus(profile, latest, toleranceKg = 1) {
  const start = finiteNumber(profile.startWeightKg);
  const goal = finiteNumber(getGoalWeight(profile));
  const current = finiteNumber(latest?.weightKg) ?? start;
  const center = goal ?? start;
  if (center === null || current === null) return null;

  const tolerance = Math.max(0.1, finiteNumber(profile.maintenanceToleranceKg) ?? toleranceKg);
  const minimum = center - tolerance;
  const maximum = center + tolerance;
  const reached = current >= minimum && current <= maximum;
  const distance = reached ? 0 : current < minimum ? minimum - current : current - maximum;
  return { center, current, minimum, maximum, tolerance, reached, distance };
}

function targetIsOnPath(target, start, goal, mode) {
  if (![target, start, goal].every(Number.isFinite)) return false;
  if (mode === "loss") return target < start && target >= goal;
  if (mode === "gain") return target > start && target <= goal;
  return false;
}

function enrichWeightMilestone(milestone, current) {
  const reached = milestone.mode === "gain"
    ? current >= milestone.target
    : current <= milestone.target;
  const remaining = milestone.mode === "gain"
    ? milestone.target - current
    : current - milestone.target;
  return { ...milestone, reached, remaining };
}

function uniqueWeightMilestones(milestones) {
  return milestones.reduce((unique, milestone) => {
    const duplicateIndex = unique.findIndex((candidate) =>
      Math.abs(candidate.target - milestone.target) < 0.05
    );
    if (duplicateIndex === -1) unique.push(milestone);
    else if (milestone.isGoal) unique[duplicateIndex] = milestone;
    return unique;
  }, []);
}

export function getMilestones(profile, latest) {
  const start = finiteNumber(profile.startWeightKg) ?? finiteNumber(latest?.weightKg);
  const current = finiteNumber(latest?.weightKg) ?? start;
  const goal = finiteNumber(getGoalWeight(profile));
  const mode = getProgressMode(profile);
  if (start === null || current === null) return [];

  if (mode === "maintain") {
    const maintenance = getMaintenanceStatus(profile, latest);
    if (!maintenance) return [];
    return [{
      title: "Faixa de manutenção",
      detail: `${maintenance.minimum.toFixed(1).replace(".", ",")} a ${maintenance.maximum.toFixed(1).replace(".", ",")} kg`,
      mode: "maintain",
      reached: maintenance.reached,
      remaining: maintenance.distance,
      statusText: maintenance.reached
        ? "Dentro da faixa"
        : `${maintenance.distance.toFixed(1).replace(".", ",")} kg para retornar à faixa`
    }];
  }

  if (goal === null || start === goal) return [];
  const candidates = [];

  if (mode === "loss") {
    [
      [5, start * 0.95],
      [10, start * 0.9]
    ].forEach(([percentage, target]) => {
      if (targetIsOnPath(target, start, goal, mode)) {
        candidates.push({
          title: `Perda de ${percentage}% do peso`,
          target,
          detail: `${(start * percentage / 100).toFixed(1).replace(".", ",")} kg de perda acumulada`,
          mode
        });
      }
    });

    const obesityExit = finiteNumber(weightForBmi(profile.heightCm, 29.9));
    if (obesityExit !== null && targetIsOnPath(obesityExit, start, goal, mode)) {
      candidates.push({
        title: "Sair da obesidade",
        target: obesityExit,
        detail: "IMC abaixo de 30",
        mode
      });
    }

    const normalLimit = finiteNumber(weightForBmi(profile.heightCm, 24.9));
    if (normalLimit !== null && targetIsOnPath(normalLimit, start, goal, mode)) {
      candidates.push({
        title: "Entrar na faixa de peso normal",
        target: normalLimit,
        detail: "IMC abaixo de 25",
        mode
      });
    }
  } else {
    [25, 50, 75].forEach((percentage) => {
      const target = start + (goal - start) * (percentage / 100);
      candidates.push({
        title: `${percentage}% do caminho até a meta`,
        target,
        detail: `${Math.abs(target - start).toFixed(1).replace(".", ",")} kg de ganho acumulado`,
        mode
      });
    });
  }

  candidates.push({
    title: "Meta de peso",
    target: goal,
    detail: mode === "gain" ? "Peso final planejado para ganho" : "Peso final planejado para perda",
    mode,
    isGoal: true
  });

  const weightMilestones = uniqueWeightMilestones(candidates)
    .sort((a, b) => mode === "gain" ? a.target - b.target : b.target - a.target)
    .map((milestone) => enrichWeightMilestone(milestone, current));

  const startWaist = finiteNumber(profile.startWaistCm);
  const currentWaist = finiteNumber(latest?.waistCm) ?? startWaist;
  const waistTarget = profile.sex === "female" ? 88 : profile.sex === "male" ? 102 : null;
  if (mode === "loss"
    && startWaist !== null
    && currentWaist !== null
    && waistTarget !== null
    && startWaist > waistTarget) {
    weightMilestones.push({
      title: `Cintura abaixo de ${waistTarget} cm`,
      waistTarget,
      detail: "Marco complementar de circunferência abdominal",
      mode: "waist",
      reached: currentWaist < waistTarget,
      remaining: currentWaist - waistTarget
    });
  }

  return weightMilestones;
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
