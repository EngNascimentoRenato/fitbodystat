import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const functionsSource = await readFile(new URL("../functions/index.js", import.meta.url), "utf8");
const rulesSource = await readFile(new URL("../private/firestore.rules", import.meta.url), "utf8");

test("convites da fase alfa possuem limites de vaga, hora, dia e validade", () => {
  assert.match(functionsSource, /DEFAULT_SEAT_LIMIT = 20/);
  assert.match(functionsSource, /HOURLY_INVITE_LIMIT = 5/);
  assert.match(functionsSource, /DAILY_INVITE_LIMIT = 20/);
  assert.match(functionsSource, /INVITATION_TTL_DAYS = 7/);
  assert.match(functionsSource, /usage\.usedSeats >= settings\.seatLimit/);
});

test("Firestore não permite criação direta de convite pelo navegador", () => {
  const invitationRules = rulesSource.slice(
    rulesSource.indexOf("match /careInvitations/{invitationId}"),
    rulesSource.indexOf("match /careLinks/{linkId}")
  );
  assert.match(invitationRules, /allow create: if false/);
  assert.doesNotMatch(invitationRules, /isProfessional\(\).*status == "pending"/s);
});

test("coleções administrativas de acesso não aceitam escrita do navegador", () => {
  for (const collectionName of ["professionalAccessRequests", "personalAccessRequests", "personalAccessGrants", "professionalAccess"]) {
    const start = rulesSource.indexOf(`match /${collectionName}/`);
    assert.notEqual(start, -1);
    const block = rulesSource.slice(start, start + 360);
    assert.match(block, /allow create, update, delete: if false/);
  }
});

test("episodios de acompanhamento possuem acesso restrito e nao podem ser excluidos", () => {
  const start = rulesSource.indexOf("match /careEpisodes/{episodeId}");
  const end = rulesSource.indexOf("match /careLinks/{linkId}");
  assert.notEqual(start, -1);
  const episodeRules = rulesSource.slice(start, end);
  assert.match(episodeRules, /acceptedInvitationMatchesEpisode/);
  assert.match(episodeRules, /sharing\.mode == "legacy-full-access"/);
  assert.match(episodeRules, /allow update: if isAdmin\(\)/);
  assert.match(episodeRules, /match \/auditEvents\/\{eventId\}/);
  assert.match(episodeRules, /allow create, update, delete: if false/);
  assert.match(episodeRules, /allow delete: if false/);
});

test("encerramento bilateral passa por callable e registra auditoria", () => {
  assert.match(functionsSource, /export const endCareEpisode = onCall/);
  assert.match(functionsSource, /uid !== link\.patientId && uid !== link\.professionalId && actor\.role !== "admin"/);
  assert.match(functionsSource, /eventType: "care-episode-ended"/);
  assert.match(functionsSource, /notificationStatus: "pending"/);
  assert.match(functionsSource, /transaction\.delete\(assignmentRef\)/);
});
