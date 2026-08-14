import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const dialogSource = await readFile(new URL("../public/js/components/care-end-dialog.js", import.meta.url), "utf8");
const connectionSource = await readFile(new URL("../public/js/views/connections-view.js", import.meta.url), "utf8");
const patientSource = await readFile(new URL("../public/js/views/patients-view.js", import.meta.url), "utf8");
const serviceSource = await readFile(new URL("../public/js/services/professional-access-service.js", import.meta.url), "utf8");

test("modal oferece motivos padronizados e detalhe opcional", () => {
  assert.match(dialogSource, /not-specified/);
  assert.match(dialogSource, /accompaniment-completed/);
  assert.match(dialogSource, /agreement-ended/);
  assert.match(dialogSource, /no-longer-continuing/);
  assert.match(dialogSource, /maxlength="500"/);
  assert.match(dialogSource, /escapeHtml\(counterpartName\)/);
});

test("usuario e profissional usam a mesma callable de encerramento", () => {
  assert.match(serviceSource, /httpsCallable\(functions, "endCareEpisode"\)/);
  assert.match(connectionSource, /data-end-care-link/);
  assert.match(connectionSource, /endProfessionalCareEpisode/);
  assert.match(patientSource, /data-end-patient-care/);
  assert.match(patientSource, /endProfessionalCareEpisode/);
});
