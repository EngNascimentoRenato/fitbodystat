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

test("fase alfa exibe capacidade e usa a rota protegida de convites", () => {
  assert.match(source, /vagas utilizadas/);
  assert.match(source, /access\.availableSeats > 0/);
  assert.match(source, /createProfessionalInvitation\(email\)/);
  assert.doesNotMatch(source, /createCareInvitation\(/);
});

test("lista profissional oferece filtros operacionais sem prontuário clínico", () => {
  assert.match(source, /patient-project-filter/);
  assert.match(source, /patient-record-filter/);
  assert.match(source, /Sem registro de medidas/);
  assert.match(source, /Sem registro de atividade/);
  assert.match(source, /Último registro há mais de 30 dias/);
  assert.doesNotMatch(source, /Último registro há mais de (7|15|60|90) dias/);
  assert.match(source, /patient-sort/);
  assert.doesNotMatch(source, /diagnóstico|anamnese|prontuário/i);
});

test("filtros seguem a interação da agenda e ordenação fica nos cabeçalhos", () => {
  assert.match(source, /toggle-patient-filters/);
  assert.match(source, /filter-icon/);
  assert.match(source, /data-patient-sort="name"/);
  assert.match(source, /data-patient-sort="record"/);
  assert.match(source, /document\.addEventListener\("click"/);
  assert.match(source, /filterFields\.hidden = true/);
  assert.match(source, /aria-expanded", "false"/);
  assert.doesNotMatch(source, /id="patient-sort"/);
});
