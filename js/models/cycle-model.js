const CYCLE_FIELDS = [
  "startDate",
  "startWeightKg",
  "startWaistCm",
  "startNeckCm",
  "startHipCm",
  "startBodyFatMethod",
  "startBodyFatManual",
  "goalType",
  "customGoalLabel",
  "targetBmi",
  "goalWeightKg",
  "weeklyChangeGoalKg",
  "weeklyLossGoalKg",
  "goalDeadlineMonths",
  "goalDeadlineMode",
  "weeklyActivityGoalDays",
  "averageActivityDurationMinutes"
];

export const INITIAL_CYCLE_ID = "initial-cycle";

export function profileHasCycleData(profile = {}) {
  return Boolean(profile.startDate && Number.isFinite(Number(profile.startWeightKg)));
}

export function cycleFromProfile(profile = {}, overrides = {}) {
  const cycle = {
    id: overrides.id || INITIAL_CYCLE_ID,
    name: overrides.name || "Acompanhamento inicial",
    status: overrides.status || "active",
    createdAt: overrides.createdAt || new Date().toISOString(),
    startedAt: overrides.startedAt || profile.startDate || null,
    endedAt: overrides.endedAt || null,
    endReason: overrides.endReason || null
  };
  CYCLE_FIELDS.forEach((field) => {
    cycle[field] = profile[field] ?? null;
  });
  return cycle;
}

export function activeCycle(state = {}) {
  const cycles = state.cycles || [];
  return cycles.find((cycle) => cycle.id === state.activeCycleId)
    || cycles.find((cycle) => cycle.status === "active")
    || null;
}

export function applyCycleToProfile(profile = {}, cycle = null) {
  if (!cycle) return { ...profile };
  const next = { ...profile };
  CYCLE_FIELDS.forEach((field) => {
    if (cycle[field] !== undefined) next[field] = cycle[field];
  });
  return next;
}

export function ensureCycleState(state = {}) {
  let cycles = Array.isArray(state.cycles) ? state.cycles.map((cycle) => ({ ...cycle })) : [];
  let activeCycleId = state.activeCycleId || null;

  if (!cycles.length && profileHasCycleData(state.profile)) {
    cycles = [cycleFromProfile(state.profile)];
    activeCycleId = INITIAL_CYCLE_ID;
  }

  const selected = cycles.find((cycle) => cycle.id === activeCycleId)
    || cycles.find((cycle) => cycle.status === "active")
    || null;
  if (selected) {
    activeCycleId = selected.id;
    cycles = cycles.map((cycle) => ({
      ...cycle,
      status: cycle.id === selected.id && cycle.status === "active"
        ? "active"
        : cycle.status
    }));
  }

  return {
    ...state,
    cycles,
    activeCycleId,
    profile: applyCycleToProfile(state.profile, selected),
    entries: (state.entries || []).map((entry) => ({
      ...entry,
      cycleId: entry.cycleId || activeCycleId || null
    }))
  };
}

export function syncActiveCycleFromProfile(state = {}) {
  const current = activeCycle(state);
  if (!current || !profileHasCycleData(state.profile)) return ensureCycleState(state);
  const updated = cycleFromProfile(state.profile, {
    ...current,
    id: current.id,
    name: current.name,
    status: current.status,
    createdAt: current.createdAt
  });
  return {
    ...state,
    cycles: state.cycles.map((cycle) => cycle.id === current.id ? updated : cycle),
    activeCycleId: current.id
  };
}
