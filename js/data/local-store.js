import { defaultProfile } from "../models/profile-model.js";
import { createDefaultMonthlyPlan, defaultMonthlyPlan } from "./seed-plan.js";

const LEGACY_STORAGE_KEY = "minha-evolucao-state-v1";
const STORAGE_PREFIX = "fitbodystat-state";

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

function normalizeState(parsed) {
  return {
    ...createBlankState(),
    ...parsed,
    profile: {
      ...defaultProfile,
      ...(parsed.profile || {}),
      weeklyChangeGoalKg: parsed.profile?.weeklyChangeGoalKg ?? parsed.profile?.weeklyLossGoalKg ?? defaultProfile.weeklyChangeGoalKg
    },
    entries: parsed.entries || [],
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
