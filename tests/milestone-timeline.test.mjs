import test from "node:test";
import assert from "node:assert/strict";
import { milestoneEmptyState, milestoneTimeline } from "../public/js/components/milestone-timeline.js";

test("linha do tempo diferencia marcos concluído, atual e futuro", () => {
  const html = milestoneTimeline({
    totalProgress: 33,
    completedCount: 1,
    totalCount: 3,
    milestones: [
      { sequence: 1, title: "Primeiro marco", state: "completed" },
      { sequence: 2, title: "Marco atual", detail: "Detalhe da etapa", state: "current", remaining: 2.5 },
      { sequence: 3, title: "Meta final", state: "future" }
    ]
  });

  assert.match(html, /milestone-timeline-item completed/);
  assert.match(html, /milestone-timeline-item current/);
  assert.match(html, /milestone-timeline-item future/);
  assert.match(html, /Progresso total do projeto/);
  assert.match(html, /33%/);
  assert.match(html, /1 de 3 marcos principais concluídos/);
  assert.match(html, /Detalhe da etapa/);
  assert.match(html, /Faltam/);
});

test("linha do tempo não ocupa espaço quando não há marcos", () => {
  assert.equal(milestoneTimeline({ milestones: [] }), "");
});

test("estado vazio orienta como reativar as metas", () => {
  const html = milestoneEmptyState();
  assert.match(html, /Todas as metas foram desativadas/);
  assert.match(html, /Perfil &gt; Objetivo e planejamento/);
});
