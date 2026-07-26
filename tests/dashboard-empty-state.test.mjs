import assert from "node:assert/strict";
import test from "node:test";

import { renderDashboard } from "../js/views/dashboard-view.js";

const emptyState = {
  activeCycleId: null,
  profile: {
    weeklyActivityGoalDays: 3,
    averageActivityDurationMinutes: null
  },
  activities: []
};

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
