import { defaultProfile } from "../models/profile-model.js";
import { createDefaultMonthlyPlan, defaultMonthlyPlan } from "./seed-plan.js";

const LEGACY_STORAGE_KEY = "minha-evolucao-state-v1";
const STORAGE_PREFIX = "fitbodystat-state-v2";

function storageKey(userId = "guest") {
  return `${STORAGE_PREFIX}-${userId}`;
}

export function createBlankState() {
  return {
    profile: defaultProfile,
    entries: [],
    goalPlan: createDefaultMonthlyPlan(defaultProfile),
    settings: {
      theme: "light"
    }
  };
}

export function normalizeState(parsed = {}) {
  const entries = (parsed.entries || []).filter((entry) => entry.id !== "profile-initial");
  const profile = {
    ...defaultProfile,
    ...(parsed.profile || {}),
    weeklyChangeGoalKg: parsed.profile?.weeklyChangeGoalKg ?? parsed.profile?.weeklyLossGoalKg ?? defaultProfile.weeklyChangeGoalKg
  };
  profile.baselineLocked = profile.baselineLocked === true || entries.length > 0;

  return {
    ...createBlankState(),
    ...parsed,
    profile,
    entries,
    goalPlan: parsed.goalPlan || parsed.monthlyPlan || defaultMonthlyPlan
  };
}

export function loadState(userId = "guest") {
  const raw = localStorage.getItem(storageKey(userId));
  if (!raw) return createBlankState();
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return createBlankState();
  }
}

export function saveState(state, userId = "guest") {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function resetState(userId = "guest") {
  const state = createBlankState();
  saveState(state, userId);
  return state;
}

export function loadLegacyState() {
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}
