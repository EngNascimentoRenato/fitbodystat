import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CYCLE_ID,
  activeCycle,
  closeActiveCycle,
  ensureCycleState,
  startNewCycle,
  syncActiveCycleFromProfile
} from "../js/models/cycle-model.js";
import { enrichEntries } from "../js/services/progress-service.js";

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

test("encerra o ciclo ativo sem excluir seu histórico", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  const closed = closeActiveCycle(state, "completed", {
    endedAt: "2026-12-01",
    endReason: "Meta alcançada"
  });

  assert.equal(closed.activeCycleId, null);
  assert.equal(closed.cycles[0].status, "completed");
  assert.equal(closed.cycles[0].endReason, "Meta alcançada");
});

test("inicia novo ciclo somente quando não existe outro ativo", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  assert.throws(() => startNewCycle(state, {
    startDate: "2027-01-01",
    startWeightKg: 74
  }));

  const closed = closeActiveCycle(state, "completed");
  const next = startNewCycle(closed, {
    id: "cycle-2",
    name: "Manutenção",
    startDate: "2027-01-02",
    startWeightKg: 74,
    goalType: "maintenance",
    goalWeightKg: 74
  });
  assert.equal(next.activeCycleId, "cycle-2");
  assert.equal(next.cycles.length, 2);
  assert.equal(activeCycle(next).name, "Manutenção");
  assert.equal(next.profile.baselineLocked, false);
});

test("cálculos do ciclo ativo não misturam medições anteriores", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  const closed = closeActiveCycle(state, "completed");
  const next = startNewCycle(closed, {
    id: "cycle-2",
    startDate: "2027-01-02",
    startWeightKg: 74,
    goalType: "maintenance",
    goalWeightKg: 74
  });
  const rows = enrichEntries(next.profile, [
    { id: "old", cycleId: INITIAL_CYCLE_ID, date: "2026-08-01", weightKg: 85 },
    { id: "new", cycleId: "cycle-2", date: "2027-01-09", weightKg: 74.2 }
  ]);

  assert.equal(rows.some((entry) => entry.id === "old"), false);
  assert.equal(rows.some((entry) => entry.id === "new"), true);
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
