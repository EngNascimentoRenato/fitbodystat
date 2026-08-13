import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/js/views/patients-view.js", import.meta.url), "utf8");

test("lista de pacientes prioriza acompanhamento sem expor telefone ou remoção", () => {
  assert.match(source, /Acompanhar/);
  assert.match(source, /maskEmail\(patient\.email\)/);
  assert.doesNotMatch(source, /data-revoke-patient/);
  assert.doesNotMatch(source, /Telefone compartilhado<\/th>/);
});

test("detalhes pessoais e projeto são abertos por ações distintas", () => {
  assert.match(source, /data-show-patient/);
  assert.match(source, /data-show-project/);
  assert.match(source, /patient-project-/);
});

test("convite é criado em modal e pendências ficam em seção secundária", () => {
  assert.match(source, /invite-patient-dialog/);
  assert.match(source, /<details class="card pending-invitations"/);
});
