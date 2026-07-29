import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(
  new URL("../js/views/agenda-view.js", import.meta.url),
  "utf8"
);

test("status e cancelamento recorrentes oferecem os três escopos", () => {
  const futureOptions = source.match(/<option value="future">Esta e as próximas<\/option>/g) || [];
  assert.ok(futureOptions.length >= 2);
  assert.match(source, /Estado atualizado nesta e nas próximas ocorrências/);
  assert.match(source, /Esta e as próximas ocorrências foram canceladas/);
});

test("barra da agenda concentra indisponibilidade no modal e recolhe filtros", () => {
  assert.doesNotMatch(source, /data-new-agenda-event="block"/);
  assert.match(source, /id="toggle-agenda-filters"/);
  assert.match(source, /agendaUi\.filtersOpen/);
  assert.match(source, /value="block"/);
});

test("agenda móvel prioriza navegação e criação dentro do dia", () => {
  assert.doesNotMatch(source, /agenda-availability-status/);
  assert.match(source, /agenda-availability-label-mobile/);
  assert.match(source, /agenda-refresh-button/);
  assert.match(source, /agenda-add-date/);
  assert.match(source, /agenda-empty-slot[^>]*[\s\S]*?>\+<\/button>/);
});

test("navegação reúne atualização, filtros e menu na mesma estrutura", () => {
  const navigation = source.match(/<div class="agenda-navigation">([\s\S]*?)<\/div>/)?.[1] || "";
  assert.match(navigation, /id="agenda-previous"/);
  assert.match(navigation, /id="agenda-today"/);
  assert.match(navigation, /id="agenda-next"/);
  assert.match(navigation, /id="refresh-agenda"/);
  assert.match(navigation, /id="toggle-agenda-filters"/);
  assert.match(navigation, /id="open-availability"/);
  assert.match(source, /agenda-day-heading[\s\S]*?<b>/);
});

test("atualização de estado fecha o modal antes de persistir a série", () => {
  const optimisticClose = source.indexOf("agendaUi.detailOpen = false;", source.indexOf("const previousEvents"));
  const saveSeries = source.indexOf("await saveAgendaEvent", optimisticClose);
  assert.ok(optimisticClose > -1);
  assert.ok(saveSeries > optimisticClose);
});
