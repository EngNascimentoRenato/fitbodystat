import { defaultProfile } from "../models/profile-model.js";
import { createDefaultMonthlyPlan, defaultMonthlyPlan } from "./seed-plan.js";

const STORAGE_KEY = "minha-evolucao-state-v1";

function seedState() {
  return {
    profile: defaultProfile,
    entries: [],
    goalPlan: createDefaultMonthlyPlan(defaultProfile),
    settings: {
      theme: "light"
    }
  };
}

export function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return seedState();
  try {
    const parsed = JSON.parse(raw);
    return {
      ...seedState(),
      ...parsed,
      profile: {
        ...defaultProfile,
        ...(parsed.profile || {}),
        weeklyChangeGoalKg: parsed.profile?.weeklyChangeGoalKg ?? parsed.profile?.weeklyLossGoalKg ?? defaultProfile.weeklyChangeGoalKg
      },
      entries: parsed.entries || [],
      goalPlan: parsed.goalPlan || parsed.monthlyPlan || defaultMonthlyPlan
    };
  } catch {
    return seedState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  const state = seedState();
  saveState(state);
  return state;
}
