import test from "node:test";
import assert from "node:assert/strict";

import {
  anonymizeAgendaData,
  demonstrationLabel,
  presentationIsActive
} from "../public/js/utils/presentation-utils.js";

globalThis.window = { addEventListener() {} };
globalThis.document = { addEventListener() {} };
const { renderProfile } = await import("../public/js/views/profile-view.js");

test("reconhece os modos de apresentação", () => {
  assert.equal(presentationIsActive("off"), false);
  assert.equal(presentationIsActive("identity"), true);
  assert.equal(presentationIsActive("evolution"), true);
});

test("anonimiza pacientes e conteúdo identificável da agenda", () => {
  const result = anonymizeAgendaData([{
    patientId: "p1",
    patientName: "Nome real",
    location: "Academia real",
    privateNotes: "Informação privada"
  }], [{ uid: "p1", name: "Nome real", email: "real@example.com", phone: "65999999999" }]);

  assert.equal(result.patients[0].name, "Paciente 01");
  assert.equal(result.patients[0].phone, "");
  assert.equal(result.events[0].patientName, "Paciente 01");
  assert.equal(result.events[0].location, demonstrationLabel("location"));
  assert.equal(result.events[0].privateNotes, "");
});

test("perfil oculta nome, nascimento e telefone no modo de apresentação", () => {
  const html = renderProfile({
    activeCycleId: null,
    profile: {
      name: "Pessoa Identificável",
      birthDate: "1990-05-10",
      sex: "male",
      heightCm: 175,
      preferredActivities: []
    },
    contact: { phone: "65999999999" },
    cycles: [],
    entries: []
  }, {
    canEditContact: true,
    canEditIdentity: true,
    presentationMode: "identity"
  });

  assert.match(html, /Usuário de demonstração/);
  assert.match(html, /Informação ocultada/);
  assert.doesNotMatch(html, /Pessoa Identificável/);
  assert.doesNotMatch(html, /10\/05\/1990/);
  assert.doesNotMatch(html, /99999/);
});
