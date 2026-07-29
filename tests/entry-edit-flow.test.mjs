import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { defaultProfile } from "../js/models/profile-model.js";
import { createBlankState } from "../js/data/local-store.js";

test("novos perfis iniciam com meta opcional de trinta minutos", () => {
  assert.equal(defaultProfile.trackActivityDuration, true);
  assert.equal(defaultProfile.averageActivityDurationMinutes, 30);
});

test("novas instalações usam o tema escuro por padrão", () => {
  assert.equal(createBlankState().settings.theme, "dark");
});

test("histórico encaminha a medição para o formulário completo de edição", async () => {
  const [historySource, entrySource] = await Promise.all([
    readFile(new URL("../js/views/history-view.js", import.meta.url), "utf8"),
    readFile(new URL("../js/views/entry-view.js", import.meta.url), "utf8")
  ]);

  assert.match(historySource, /fitbodystat-edit-entry-id/);
  assert.match(entrySource, /editingMeasurementId/);
  assert.match(entrySource, /delete-measurement-edit/);
  assert.match(entrySource, /editingMeasurementId \? "disabled" : ""/);
});
