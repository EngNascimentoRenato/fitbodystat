import test from "node:test";
import assert from "node:assert/strict";
import {
  CARE_RELATIONSHIP_SCHEMA_VERSION,
  createCareEpisode,
  normalizeCareLink
} from "../public/js/models/care-episode-model.js";

test("vinculo legado recebe episodio virtual sem alterar os dados originais", () => {
  const link = normalizeCareLink({
    id: "professional_patient",
    invitationId: "invite-legacy",
    status: "active"
  });
  assert.equal(link.relationshipModelVersion, 1);
  assert.equal(link.activeEpisodeId, "invite-legacy");
  assert.equal(link.episodeStatus, "active");
  assert.equal(link.legacyEpisode, true);
});

test("novo episodio preserva identidade, escopo legado e consentimento do usuario", () => {
  const timestamp = { serverTimestamp: true };
  const episode = createCareEpisode({
    episodeId: "invite-new",
    linkId: "professional_patient",
    invitation: { id: "invite-new", professionalId: "professional" },
    patientId: "patient",
    professionType: "personal-trainer",
    careArea: "physical-training",
    permissions: { viewData: true, editData: true, createCycles: true, sharePhone: false },
    accessBenefit: { source: "professional-link", activeWhileLinked: true },
    timestamp
  });
  assert.equal(episode.relationshipModelVersion, CARE_RELATIONSHIP_SCHEMA_VERSION);
  assert.equal(episode.episodeId, "invite-new");
  assert.equal(episode.status, "active");
  assert.equal(episode.sharing.mode, "legacy-full-access");
  assert.equal(episode.sharing.decidedBy, "patient");
  assert.deepEqual(episode.sharing.cycleIds, []);
});
