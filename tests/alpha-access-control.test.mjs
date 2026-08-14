import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const loginSource = await readFile(new URL("../public/js/login.js", import.meta.url), "utf8");
const loginHtml = await readFile(new URL("../public/login.html", import.meta.url), "utf8");
const adminSource = await readFile(new URL("../public/js/views/admin-view.js", import.meta.url), "utf8");

test("criação de conta exige convite, liberação pessoal ou pré-autorização profissional", () => {
  assert.match(functionsSource, /beforeUserCreated/);
  assert.match(functionsSource, /hasActiveInvitation\(emailLower\)/);
  assert.match(functionsSource, /personalAccessGrants/);
  assert.match(functionsSource, /professionalRegistrations/);
  assert.match(functionsSource, /A fase alfa está disponível somente por convite ou liberação administrativa/);
});

test("solicitação profissional pública não concede role e usa resposta neutra", () => {
  const requestBlock = functionsSource.slice(
    functionsSource.indexOf("export const requestProfessionalAccess"),
    functionsSource.indexOf("export const decideProfessionalAccessRequest")
  );
  assert.match(requestBlock, /status: "pending"/);
  assert.match(requestBlock, /status: "received"/);
  assert.doesNotMatch(requestBlock, /role:\s*"professional"/);
  assert.match(loginHtml, /professional-request-dialog/);
  assert.match(loginSource, /Solicitação recebida/);
});

test("solicitação pessoal pública depende de decisão administrativa", () => {
  const requestBlock = functionsSource.slice(
    functionsSource.indexOf("export const requestPersonalAccess"),
    functionsSource.indexOf("export const decidePersonalAccessRequest")
  );
  assert.match(requestBlock, /personalAccessRequests/);
  assert.match(requestBlock, /status: "pending"/);
  assert.doesNotMatch(requestBlock, /personalAccessGrants.*status: "active"/s);
  assert.match(loginHtml, /personal-request-dialog/);
  assert.match(loginSource, /requestPersonalAlphaAccess/);
  assert.match(loginSource, /error-code:-47/);
});

test("administração decide solicitações e libera acesso pessoal pelo backend", () => {
  assert.match(adminSource, /decideProfessionalAlphaAccess/);
  assert.match(adminSource, /decidePersonalAlphaAccess/);
  assert.match(adminSource, /grantPersonalAlphaAccess/);
  assert.match(adminSource, /revokePersonalAlphaAccess/);
  assert.match(functionsSource, /await adminActor\(request\)/);
});

test("decisões administrativas enviam notificação pelo Resend sem expor a chave", () => {
  assert.match(functionsSource, /defineSecret\("RESEND_API_KEY"\)/);
  assert.match(functionsSource, /secrets: \[RESEND_API_KEY\]/);
  assert.match(functionsSource, /https:\/\/api\.resend\.com\/emails/);
  assert.match(functionsSource, /FitBodyStat <suporte@fitbodystat\.com\.br>/);
  assert.match(functionsSource, /notificationStatus: "sent"/);
  assert.match(functionsSource, /notificationStatus: "failed"/);
  assert.doesNotMatch(functionsSource, /re_[A-Za-z0-9_-]{12,}/);
});
