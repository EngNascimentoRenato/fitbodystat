const CYCLE_FIELDS = [
  "sex",
  "heightCm",
  "startDate",
  "startWeightKg",
  "startWaistCm",
  "startNeckCm",
  "startHipCm",
  "startBodyFatMethod",
  "startBodyFatManual",
  "startSkinfolds",
  "trackedCircumferences",
  "startCircumferences",
  "goalType",
  "customGoalLabel",
  "targetBmi",
  "goalWeightKg",
  "milestoneConfig",
  "weeklyChangeGoalKg",
  "weeklyLossGoalKg",
  "goalDeadlineMonths",
  "goalDeadlineMode",
  "planningOriginal",
  "planningRevisions",
  "weeklyActivityGoalDays",
  "trackActivityDuration",
  "averageActivityDurationMinutes"
];

export const INITIAL_CYCLE_ID = "initial-cycle";

export function profileHasCycleData(profile = {}) {
  const startWeightKg = Number(profile.startWeightKg);
  return Boolean(
    profile.startDate
    && profile.startWeightKg !== null
    && profile.startWeightKg !== ""
    && Number.isFinite(startWeightKg)
    && startWeightKg > 0
  );
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
  return cycles.find((cycle) => cycle.id === state.activeCycleId && cycle.status === "active")
    || cycles.find((cycle) => cycle.status === "active")
    || null;
}

function cycleDate(value) {
  const date = String(value || "").slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function cycleIdForLegacyEntry(entry = {}, cycles = []) {
  const entryDate = cycleDate(entry.date);
  const ordered = [...cycles]
    .filter((cycle) => cycle?.id)
    .sort((a, b) => String(cycleDate(a.startedAt) || "").localeCompare(cycleDate(b.startedAt) || ""));
  if (!ordered.length) return null;
  if (!entryDate) return ordered.length === 1 ? ordered[0].id : null;

  const withinCycle = ordered.filter((cycle) => {
    const start = cycleDate(cycle.startedAt);
    const end = cycleDate(cycle.endedAt);
    return (!start || start <= entryDate) && (!end || entryDate <= end);
  });
  if (withinCycle.length) return withinCycle.at(-1).id;

  const preceding = ordered.filter((cycle) => {
    const start = cycleDate(cycle.startedAt);
    return start && start <= entryDate;
  });
  return preceding.at(-1)?.id || ordered[0].id;
}

export function cycleHasMeasurements(state = {}, cycleId = state.activeCycleId) {
  if (!cycleId) return false;
  return (state.entries || []).some((entry) => entry.cycleId === cycleId);
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
  const hasInitialCycleEntries = (state.entries || [])
    .some((entry) => entry.cycleId === INITIAL_CYCLE_ID);
  const invalidEmptyInitialCycle = cycles.find((cycle) =>
    cycle.id === INITIAL_CYCLE_ID
    && !profileHasCycleData(cycle)
    && !hasInitialCycleEntries
  );
  if (invalidEmptyInitialCycle) {
    cycles = cycles.filter((cycle) => cycle.id !== INITIAL_CYCLE_ID);
    if (activeCycleId === INITIAL_CYCLE_ID) activeCycleId = null;
  }

  if (!cycles.length && profileHasCycleData(state.profile)) {
    cycles = [cycleFromProfile(state.profile)];
    activeCycleId = INITIAL_CYCLE_ID;
  }

  const activeCycles = cycles.filter((cycle) => cycle.status === "active");
  const selected = activeCycles.find((cycle) => cycle.id === activeCycleId)
    || activeCycles.at(-1)
    || null;
  if (selected) {
    activeCycleId = selected.id;
    cycles = cycles.map((cycle) => ({
      ...cycle,
      status: cycle.status === "active" && cycle.id !== selected.id ? "replaced" : cycle.status,
      endedAt: cycle.status === "active" && cycle.id !== selected.id
        ? cycle.endedAt || cycleDate(selected.startedAt) || new Date().toISOString().slice(0, 10)
        : cycle.endedAt,
      endReason: cycle.status === "active" && cycle.id !== selected.id
        ? cycle.endReason || "Projeto ativo duplicado encerrado durante a normalização dos dados."
        : cycle.endReason
    }));
  } else {
    activeCycleId = null;
  }

  return {
    ...state,
    cycles,
    activeCycleId,
    profile: {
      ...applyCycleToProfile(state.profile, selected),
      activeCycleId
    },
    entries: (state.entries || []).map((entry) => ({
      ...entry,
      cycleId: entry.cycleId || cycleIdForLegacyEntry(entry, cycles) || activeCycleId || null
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

export function closeActiveCycle(state = {}, status, details = {}) {
  if (!["completed", "abandoned", "expired", "replaced"].includes(status)) {
    throw new Error("Estado de encerramento inválido.");
  }
  const current = activeCycle(state);
  if (!current) throw new Error("Não há projeto ativo para encerrar.");
  const endedAt = details.endedAt || new Date().toISOString().slice(0, 10);
  return {
    ...state,
    activeCycleId: null,
    profile: { ...state.profile, activeCycleId: null },
    cycles: state.cycles.map((cycle) => cycle.id === current.id
      ? {
          ...cycle,
          status,
          endedAt,
          endReason: String(details.endReason || "").trim() || null
        }
      : cycle)
  };
}

export function startNewCycle(state = {}, input = {}) {
  if (activeCycle(state)) throw new Error("Encerre o projeto ativo antes de iniciar outro.");
  const startedAt = input.startDate || input.startedAt;
  const startWeightKg = Number(input.startWeightKg);
  if (!startedAt || !Number.isFinite(startWeightKg)) {
    throw new Error("Informe a data e o peso inicial do novo projeto.");
  }
  const id = input.id
    || globalThis.crypto?.randomUUID?.()
    || `cycle-${Date.now()}`;
  const cycleProfile = {
    ...state.profile,
    ...input,
    startDate: startedAt,
    startWeightKg,
    baselineLocked: false,
    baselineLockedAt: null
  };
  const cycle = cycleFromProfile(cycleProfile, {
    id,
    name: String(input.name || "").trim() || "Novo acompanhamento",
    status: "active",
    createdAt: new Date().toISOString(),
    startedAt
  });
  return {
    ...state,
    activeCycleId: id,
    cycles: [...(state.cycles || []), cycle],
    profile: {
      ...applyCycleToProfile(state.profile, cycle),
      activeCycleId: id,
      baselineLocked: false,
      baselineLockedAt: null
    }
  };
}
