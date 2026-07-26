import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CYCLE_ID,
  activeCycle,
  ensureCycleState,
  syncActiveCycleFromProfile
} from "../js/models/cycle-model.js";

const profile = {
  name: "Teste",
  heightCm: 170,
  startDate: "2026-07-01",
  startWeightKg: 90,
  startWaistCm: 105,
  goalType: "weight-loss",
  goalWeightKg: 75,
  weeklyChangeGoalKg: 0.5
};

test("migra o perfil atual para um único ciclo inicial", () => {
  const first = ensureCycleState({ profile, entries: [], cycles: [] });
  const second = ensureCycleState(first);

  assert.equal(first.cycles.length, 1);
  assert.equal(second.cycles.length, 1);
  assert.equal(first.activeCycleId, INITIAL_CYCLE_ID);
  assert.equal(activeCycle(first).startWeightKg, 90);
});

test("associa registros antigos ao ciclo ativo", () => {
  const state = ensureCycleState({
    profile,
    cycles: [],
    entries: [{ id: "m1", date: "2026-07-08", weightKg: 89.5 }]
  });

  assert.equal(state.entries[0].cycleId, INITIAL_CYCLE_ID);
});

test("sincroniza alterações de meta com o ciclo ativo", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  state.profile = { ...state.profile, goalWeightKg: 72 };
  const synced = syncActiveCycleFromProfile(state);

  assert.equal(activeCycle(synced).goalWeightKg, 72);
  assert.equal(synced.cycles.length, 1);
});
