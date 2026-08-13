import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../public/js/views/dashboard-view.js";
import { renderGoals } from "../public/js/views/goals-view.js";

const emptyState = {
  activeCycleId: null,
  profile: {
    weeklyActivityGoalDays: 3,
    averageActivityDurationMinutes: null
  },
  activities: []
};

test("dashboard independente prioriza o projeto sem mencionar profissional", () => {
  const html = renderDashboard(emptyState, "", {
    professionalCount: 0,
    pendingInvitations: 0
  });

  assert.match(html, /Comece seu acompanhamento/);
  assert.match(html, /Criar meu projeto/);
  assert.doesNotMatch(html, /profissional/i);
  assert.doesNotMatch(html, /Atividade física/);
});

test("dashboard do usuário informa a quantidade de profissionais vinculados", () => {
  const html = renderDashboard(emptyState, "", {
    professionalCount: 2,
    pendingInvitations: 0
  });

  assert.match(html, /Você possui 2 profissionais vinculados/);
  assert.match(html, /Meus profissionais/);
  assert.match(html, /Criar meu projeto/);
});

test("dashboard visto pelo profissional mostra somente ações do paciente", () => {
  const html = renderDashboard(emptyState, "", {
    patientContext: true,
    professionalCount: 1
  });

  assert.match(html, /Este paciente ainda não possui um projeto ativo/);
  assert.match(html, /Criar projeto/);
  assert.doesNotMatch(html, /Meus profissionais/);
  assert.doesNotMatch(html, /Criar meu projeto/);
  assert.doesNotMatch(html, /Aguardar convite profissional/);
});

test("dashboard e metas respeitam os mesmos marcos desativados", () => {
  const state = {
    activeCycleId: "cycle-1",
    profile: {
      goalType: "weight-loss",
      sex: "male",
      heightCm: 165,
      startDate: "2026-08-01",
      startWeightKg: 90,
      startWaistCm: 112,
      goalWeightKg: 70,
      goalDeadlineMonths: 10,
      goalDeadlineMode: "custom",
      weeklyChangeGoalKg: 0.46,
      weeklyActivityGoalDays: 3,
      milestoneConfig: {
        disabledSuggestedIds: ["waist-reference"],
        customGoals: []
      }
    },
    entries: [{ id: "baseline", cycleId: "cycle-1", date: "2026-08-01", weightKg: 90, waistCm: 112 }],
    activities: [],
    goalPlan: []
  };

  assert.doesNotMatch(renderDashboard(state), /Cintura abaixo de 102 cm/);
  assert.doesNotMatch(renderGoals(state), /Cintura abaixo de 102 cm/);
});
