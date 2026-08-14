import assert from "node:assert/strict";
import test from "node:test";

import {
  INITIAL_CYCLE_ID,
  activeCycle,
  closeActiveCycle,
  cycleIdForLegacyEntry,
  cycleHasMeasurements,
  ensureCycleState,
  startNewCycle,
  syncActiveCycleFromProfile
} from "../public/js/models/cycle-model.js";
import { enrichEntries } from "../public/js/services/progress-service.js";

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

test("não cria ciclo para perfil básico sem peso inicial", () => {
  const state = ensureCycleState({
    profile: {
      name: "Usuário novo",
      birthDate: "1990-01-01",
      startDate: "2026-07-26",
      startWeightKg: null
    },
    entries: [],
    cycles: []
  });

  assert.equal(state.cycles.length, 0);
  assert.equal(state.activeCycleId, null);
});

test("remove ciclo inicial vazio criado por versão anterior", () => {
  const state = ensureCycleState({
    profile: { startDate: "2026-07-26", startWeightKg: null },
    entries: [],
    activeCycleId: INITIAL_CYCLE_ID,
    cycles: [{
      id: INITIAL_CYCLE_ID,
      name: "Acompanhamento inicial",
      status: "active",
      startedAt: "2026-07-26",
      startWeightKg: null
    }]
  });

  assert.equal(state.cycles.length, 0);
  assert.equal(state.activeCycleId, null);
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

test("preserva referência corporal e altura dentro do ciclo", () => {
  const state = startNewCycle({
    profile: { name: "Paciente", sex: "", heightCm: null },
    cycles: [],
    entries: [],
    activeCycleId: null
  }, {
    name: "Projeto acompanhado",
    startDate: "2027-02-01",
    sex: "female",
    heightCm: 165,
    startWeightKg: 80,
    goalType: "weight-loss",
    goalWeightKg: 68,
    weeklyChangeGoalKg: 0.5
  });

  assert.equal(activeCycle(state).sex, "female");
  assert.equal(activeCycle(state).heightCm, 165);
  assert.equal(state.profile.sex, "female");
  assert.equal(state.profile.heightCm, 165);
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

test("bloqueia a troca de objetivo somente após uma medição do ciclo ativo", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  assert.equal(cycleHasMeasurements(state), false);
  assert.equal(cycleHasMeasurements({
    ...state,
    entries: [{ id: "m1", cycleId: state.activeCycleId, date: "2026-07-08", weightKg: 89.5 }]
  }), true);
  assert.equal(cycleHasMeasurements({
    ...state,
    entries: [{ id: "old", cycleId: "outro-ciclo", date: "2025-01-01", weightKg: 80 }]
  }), false);
});

test("encerra projeto substituído preservando motivo e histórico", () => {
  const state = ensureCycleState({ profile, cycles: [], entries: [] });
  const closed = closeActiveCycle(state, "replaced", {
    endedAt: "2026-08-01",
    endReason: "Objetivo principal será redefinido em um novo projeto."
  });

  assert.equal(closed.cycles[0].status, "replaced");
  assert.equal(closed.cycles[0].endReason, "Objetivo principal será redefinido em um novo projeto.");
  assert.equal(closed.activeCycleId, null);
});

test("não considera encerrado um ciclo apontado por activeCycleId antigo", () => {
  const state = ensureCycleState({
    profile: {},
    activeCycleId: "encerrado",
    cycles: [{
      id: "encerrado",
      status: "completed",
      startedAt: "2026-01-01",
      endedAt: "2026-06-01",
      startWeightKg: 90
    }],
    entries: []
  });

  assert.equal(state.activeCycleId, null);
  assert.equal(activeCycle(state), null);
});

test("normaliza projetos ativos duplicados preservando apenas o selecionado", () => {
  const state = ensureCycleState({
    profile: {},
    activeCycleId: "atual",
    cycles: [
      { id: "anterior", status: "active", startedAt: "2026-01-01", startWeightKg: 90 },
      { id: "atual", status: "active", startedAt: "2026-06-01", startWeightKg: 84 }
    ],
    entries: []
  });

  assert.equal(state.cycles.filter((cycle) => cycle.status === "active").length, 1);
  assert.equal(activeCycle(state).id, "atual");
  assert.equal(state.cycles.find((cycle) => cycle.id === "anterior").status, "replaced");
});

test("associa registro legado ao ciclo correspondente à sua data", () => {
  const cycles = [
    { id: "primeiro", status: "completed", startedAt: "2026-01-01", endedAt: "2026-05-31" },
    { id: "segundo", status: "active", startedAt: "2026-06-01", endedAt: null }
  ];

  assert.equal(cycleIdForLegacyEntry({ date: "2026-03-10" }, cycles), "primeiro");
  assert.equal(cycleIdForLegacyEntry({ date: "2026-07-10" }, cycles), "segundo");

  const state = ensureCycleState({
    profile: {},
    activeCycleId: "segundo",
    cycles,
    entries: [
      { id: "old", date: "2026-03-10", weightKg: 90 },
      { id: "new", date: "2026-07-10", weightKg: 84 }
    ]
  });
  assert.deepEqual(state.entries.map((entry) => entry.cycleId), ["primeiro", "segundo"]);
});
