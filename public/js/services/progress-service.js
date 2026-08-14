import { calculateBmi, classifyBmi, weightForBmi } from "./bmi-service.js";
import { resolveBodyFat, classifyBodyFat } from "./body-fat-service.js";

export function getWeeklyChangeGoal(profile) {
  return Math.abs(Number(profile.weeklyChangeGoalKg ?? profile.weeklyLossGoalKg ?? 0.5)) || 0.5;
}

export function getSuggestedGoalWeight(profile) {
  const start = finiteNumber(profile.startWeightKg);
  const height = finiteNumber(profile.heightCm);
  if (start === null || height === null) return null;

  const bmi = calculateBmi(start, height);
  if (profile.goalType === "maintenance") return start;
  if (profile.goalType === "weight-loss") {
    if (!bmi || bmi < 25) return null;
    const target = finiteNumber(profile.targetBmi) ?? 24.9;
    const calculated = weightForBmi(height, target);
    return calculated ? Number(calculated.toFixed(1)) : null;
  }
  if (["weight-gain", "muscle-gain", "recovery"].includes(profile.goalType)) {
    if (!bmi || bmi >= 18.5) return null;
    const calculated = weightForBmi(height, 18.5);
    return calculated ? Number(calculated.toFixed(1)) : null;
  }

  const target = finiteNumber(profile.targetBmi) ?? 24.9;
  const calculated = weightForBmi(height, target);
  return calculated ? Number(calculated.toFixed(1)) : start;
}

export function getGoalWeight(profile) {
  if (profile.goalWeightKg !== null && profile.goalWeightKg !== undefined && profile.goalWeightKg !== "" && Number.isFinite(Number(profile.goalWeightKg))) {
    return Number(profile.goalWeightKg);
  }
  return getSuggestedGoalWeight(profile);
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

export function resolveGoalTiming(profile) {
  const next = {
    ...profile,
    goalDeadlineMode: profile.goalDeadlineMode === "custom" ? "custom" : "auto"
  };
  const start = finiteNumber(next.startWeightKg);
  const goal = finiteNumber(getGoalWeight(next));
  const mode = getProgressMode(next);

  if (start === null || goal === null) return next;
  if (mode === "maintain" || Math.abs(start - goal) < 0.05) {
    next.goalWeightKg = goal;
    next.goalDeadlineMonths = 0;
    next.weeklyChangeGoalKg = 0;
    next.weeklyLossGoalKg = 0;
    return next;
  }

  if (next.goalDeadlineMode === "custom" && finiteNumber(next.goalDeadlineMonths) > 0) {
    next.weeklyChangeGoalKg = calculateWeeklyChangeForDeadline(next);
  } else {
    next.goalDeadlineMode = "auto";
    next.weeklyChangeGoalKg = getWeeklyChangeGoal(next);
    next.goalDeadlineMonths = calculateGoalDeadlineMonths(next);
  }
  next.weeklyLossGoalKg = next.weeklyChangeGoalKg;
  return next;
}

export function getGoalDeadlineMonths(profile) {
  const mode = getProgressMode(profile);
  if (mode === "maintain") return 12;
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
    circumferences: { ...(profile.startCircumferences || {}) },
    bodyFatMethod: profile.startBodyFatMethod || "circumference",
    bodyFatManual: profile.startBodyFatManual ?? null,
    notes: "Registro inicial do perfil",
    source: "profile",
    isBaseline: true
  };
}

export function enrichEntries(profile, entries) {
  const baseline = createBaselineEntry(profile);
  const regularEntries = (entries || []).filter((entry) => {
    const belongsToActiveCycle = !profile.activeCycleId
      || !entry.cycleId
      || entry.cycleId === profile.activeCycleId;
    return belongsToActiveCycle
      && entry.id !== "profile-initial"
      && (!baseline || entry.date !== baseline.date);
  });

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

export function getSuggestedMilestones(profile, latest) {
  const start = finiteNumber(profile.startWeightKg) ?? finiteNumber(latest?.weightKg);
  const current = finiteNumber(latest?.weightKg) ?? start;
  const goal = finiteNumber(getGoalWeight(profile));
  const mode = getProgressMode(profile);
  if (start === null || current === null) return [];

  if (mode === "maintain") {
    const maintenance = getMaintenanceStatus(profile, latest);
    if (!maintenance) return [];
    return [{
      id: "maintenance-range",
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
          id: `weight-loss-${percentage}-percent`,
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
        id: "bmi-obesity-exit",
        title: "Sair da obesidade",
        target: obesityExit,
        detail: "IMC abaixo de 30",
        mode
      });
    }

    const normalLimit = finiteNumber(weightForBmi(profile.heightCm, 24.9));
    if (normalLimit !== null && targetIsOnPath(normalLimit, start, goal, mode)) {
      candidates.push({
        id: "bmi-normal-range",
        title: "Entrar na faixa de peso normal",
        target: normalLimit,
        detail: "IMC abaixo de 25",
        mode
      });
    }
  } else {
    const gainDetail = profile.goalType === "recovery"
      ? "recuperação de peso acumulada"
      : profile.goalType === "muscle-gain"
        ? "variação de peso acumulada no projeto"
        : "ganho de peso acumulado";
    [25, 50, 75].forEach((percentage) => {
      const target = start + (goal - start) * (percentage / 100);
      candidates.push({
        id: `goal-path-${percentage}`,
        title: `${percentage}% do caminho até a meta`,
        target,
        detail: `${Math.abs(target - start).toFixed(1).replace(".", ",")} kg de ${gainDetail}`,
        mode
      });
    });

    const lowWeightExit = finiteNumber(weightForBmi(profile.heightCm, 18.5));
    if (lowWeightExit !== null && targetIsOnPath(lowWeightExit, start, goal, mode)) {
      candidates.push({
        id: "bmi-low-weight-exit",
        title: "Sair do baixo peso",
        target: lowWeightExit,
        detail: "IMC igual ou superior a 18,5",
        mode
      });
    }
  }

  candidates.push({
    id: "weight-goal",
    title: "Meta de peso",
    target: goal,
    detail: mode === "gain"
      ? profile.goalType === "recovery"
        ? "Peso final planejado para recuperação"
        : profile.goalType === "muscle-gain"
          ? "Peso de referência do projeto de hipertrofia"
          : "Peso final planejado para ganho"
      : "Peso final planejado para perda",
    mode,
    isGoal: true
  });

  const weightMilestones = uniqueWeightMilestones(candidates)
    .sort((a, b) => mode === "gain" ? a.target - b.target : b.target - a.target)
    .map((milestone) => enrichWeightMilestone(milestone, current));

  const startWaist = finiteNumber(profile.startWaistCm);
  const currentWaist = finiteNumber(latest?.waistCm) ?? startWaist;
  const waistTarget = profile.sex === "female" ? 88 : profile.sex === "male" ? 102 : null;
  const expectedGoalWaist = startWaist !== null && goal !== null && start !== null
    ? startWaist + (goal - start)
    : null;
  if (mode === "loss"
    && startWaist !== null
    && currentWaist !== null
    && waistTarget !== null
    && startWaist > waistTarget
    && expectedGoalWaist !== null
    && expectedGoalWaist < waistTarget) {
    weightMilestones.push({
      id: "waist-reference",
      title: `Cintura abaixo de ${waistTarget} cm`,
      waistTarget,
      detail: "Marco complementar de circunferência abdominal",
      mode: "waist",
      complementary: true,
      reached: currentWaist < waistTarget,
      remaining: currentWaist - waistTarget
    });
  }

  return weightMilestones;
}

function customMetricMilestone(profile, latest, goal) {
  const target = finiteNumber(goal.target);
  if (target === null) return null;
  const startWeight = finiteNumber(profile.startWeightKg);
  const currentWeight = finiteNumber(latest?.weightKg) ?? startWeight;
  const id = String(goal.id || `custom-${goal.type}-${target}`);
  const title = String(goal.title || "").trim();

  if (goal.type === "weight" || goal.type === "bmi") {
    const projectMode = getProgressMode(profile);
    const projectGoal = finiteNumber(getGoalWeight(profile));
    const projectChange = projectGoal === null || startWeight === null
      ? null
      : Math.abs(projectGoal - startWeight);
    const weightTarget = goal.type === "bmi"
      ? finiteNumber(weightForBmi(profile.heightCm, target))
      : projectMode === "loss" && projectChange !== null && target <= projectChange
        ? startWeight - target
        : projectMode === "gain" && projectChange !== null && target <= projectChange
          ? startWeight + target
          : null;
    if (weightTarget === null || startWeight === null || currentWeight === null) return null;
    const mode = weightTarget < startWeight ? "loss" : weightTarget > startWeight ? "gain" : "maintain";
    if (mode !== "maintain" && projectGoal !== null && !targetIsOnPath(weightTarget, startWeight, projectGoal, mode)) {
      return null;
    }
    return enrichWeightMilestone({
      id,
      title: title || (goal.type === "bmi"
        ? `IMC ${target.toFixed(1).replace(".", ",")}`
        : `${mode === "loss" ? "Perda" : "Ganho"} de ${target.toFixed(1).replace(".", ",")} kg`),
      target: weightTarget,
      detail: goal.type === "bmi"
        ? `Meta personalizada de IMC (${weightTarget.toFixed(1).replace(".", ",")} kg)`
        : `${target.toFixed(1).replace(".", ",")} kg de ${mode === "loss" ? "perda" : "ganho"} acumulado`,
      mode,
      custom: true
    }, currentWeight);
  }

  if (goal.type === "waist") {
    const start = finiteNumber(profile.startWaistCm);
    const current = finiteNumber(latest?.waistCm) ?? start;
    if (start === null || current === null) return null;
    const direction = target < start ? "loss" : "gain";
    const reached = direction === "loss" ? current <= target : current >= target;
    return {
      id,
      title: title || `Cintura ${target.toFixed(1).replace(".", ",")} cm`,
      detail: "Meta personalizada de cintura",
      waistTarget: target,
      mode: "waist",
      unit: "cm",
      custom: true,
      complementary: true,
      reached,
      remaining: direction === "loss" ? current - target : target - current
    };
  }

  if (goal.type === "body-fat") {
    const start = finiteNumber(resolveBodyFat({
      waistCm: profile.startWaistCm,
      neckCm: profile.startNeckCm,
      hipCm: profile.startHipCm,
      bodyFatManual: profile.startBodyFatManual
    }, profile));
    const current = finiteNumber(resolveBodyFat(latest || {}, profile)) ?? start;
    if (start === null || current === null) return null;
    const direction = target < start ? "loss" : "gain";
    const reached = direction === "loss" ? current <= target : current >= target;
    return {
      id,
      title: title || `Gordura corporal ${target.toFixed(1).replace(".", ",")}%`,
      detail: "Meta personalizada de gordura corporal",
      bodyFatTarget: target,
      mode: "body-fat",
      unit: "%",
      custom: true,
      complementary: true,
      reached,
      remaining: direction === "loss" ? current - target : target - current
    };
  }
  return null;
}

export function getMilestones(profile, latest) {
  const suggested = getSuggestedMilestones(profile, latest);
  const config = profile.milestoneConfig;
  if (!config) return suggested;
  const disabled = new Set(Array.isArray(config.disabledSuggestedIds) ? config.disabledSuggestedIds : []);
  const selected = suggested.filter((milestone) =>
    milestone.isGoal
    || milestone.id === "maintenance-range"
    || !disabled.has(milestone.id)
  );
  const custom = (Array.isArray(config.customGoals) ? config.customGoals : [])
    .map((goal) => customMetricMilestone(profile, latest, goal))
    .filter(Boolean);
  const primary = [...selected.filter((item) => !item.complementary), ...custom.filter((item) => !item.complementary)]
    .sort((a, b) => {
      const mode = getProgressMode(profile);
      return mode === "gain" ? a.target - b.target : b.target - a.target;
    });
  return [...primary, ...selected.filter((item) => item.complementary), ...custom.filter((item) => item.complementary)];
}

function milestoneStageProgress(profile, latest, next) {
  if (!next) return { value: 100, completed: 0, total: 0, unit: "kg" };
  if (next.mode === "maintain") {
    return {
      value: next.reached ? 100 : 0,
      completed: next.reached ? 1 : 0,
      total: 1,
      unit: "faixa"
    };
  }
  if (next.mode === "waist") {
    const start = finiteNumber(profile.startWaistCm);
    const current = finiteNumber(latest?.waistCm) ?? start;
    if (start === null || current === null || !Number.isFinite(next.waistTarget)) {
      return { value: 0, completed: 0, total: 0, unit: "cm" };
    }
    const total = Math.abs(start - next.waistTarget);
    const completed = Math.min(Math.max(start - current, 0), total);
    return {
      value: total ? Math.round((completed / total) * 100) : 100,
      completed,
      total,
      unit: "cm"
    };
  }

  const startWeight = finiteNumber(profile.startWeightKg);
  const current = finiteNumber(latest?.weightKg) ?? startWeight;
  if (startWeight === null || current === null || !Number.isFinite(next.target)) {
    return { value: 0, completed: 0, total: 0, unit: "kg" };
  }

  const total = Math.abs(next.target - startWeight);
  const change = next.mode === "gain" ? current - startWeight : startWeight - current;
  const completed = Math.min(Math.max(change, 0), total);

  return {
    value: total ? Math.round((completed / total) * 100) : 100,
    completed,
    total,
    unit: "kg"
  };
}

export function getGoalJourney(profile, latest) {
  const milestones = getMilestones(profile, latest);
  const primary = milestones.filter((milestone) => !milestone.complementary);
  const complementary = milestones.filter((milestone) => milestone.complementary);
  const next = primary.find((milestone) => !milestone.reached) || null;
  const currentIndex = next ? primary.indexOf(next) : -1;
  const timeline = primary.map((milestone, index) => ({
    ...milestone,
    sequence: index + 1,
    state: milestone.reached
      ? "completed"
      : index === currentIndex
        ? "current"
        : "future"
  }));
  const mode = getProgressMode(profile);
  const totalProgress = mode === "maintain"
    ? primary[0]?.reached ? 100 : 0
    : goalProgress(profile, latest);

  return {
    mode,
    status: next ? "active" : primary.length ? "completed" : "unavailable",
    totalProgress,
    stageProgress: milestoneStageProgress(profile, latest, next),
    milestones: timeline,
    complementary,
    next,
    completedCount: primary.filter((milestone) => milestone.reached).length,
    totalCount: primary.length
  };
}

export function nextMilestone(profile, latest) {
  return getGoalJourney(profile, latest).next;
}

export function nextMilestoneProgress(profile, latest) {
  return getGoalJourney(profile, latest).stageProgress;
}

export function goalProgress(profile, latest) {
  const goal = getGoalWeight(profile);
  if (!profile.startWeightKg || !goal || !latest?.weightKg) return 0;
  const total = goal - profile.startWeightKg;
  const done = latest.weightKg - profile.startWeightKg;
  if (total === 0) return 100;
  return Math.round(Math.min(Math.max((done / total) * 100, 0), 100));
}
