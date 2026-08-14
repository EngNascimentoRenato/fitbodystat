export const CARE_RELATIONSHIP_SCHEMA_VERSION = 2;
export const LEGACY_SHARING_MODE = "legacy-full-access";
export const LEGACY_CONSENT_VERSION = "legacy-v1";

export function normalizeCareLink(link = {}) {
  const activeEpisodeId = link.activeEpisodeId
    || link.originInvitationId
    || link.invitationId
    || null;
  return {
    ...link,
    relationshipModelVersion: Number(link.relationshipModelVersion) || 1,
    activeEpisodeId,
    episodeStatus: link.episodeStatus || (link.status === "active" ? "active" : "ended"),
    legacyEpisode: !link.activeEpisodeId
  };
}

export function createCareEpisode({
  episodeId,
  linkId,
  invitation,
  patientId,
  professionType,
  careArea,
  permissions,
  accessBenefit,
  timestamp
}) {
  return {
    relationshipModelVersion: CARE_RELATIONSHIP_SCHEMA_VERSION,
    episodeId,
    linkId,
    invitationId: invitation.id,
    originInvitationId: invitation.id,
    professionalId: invitation.professionalId,
    patientId,
    professionType,
    careArea,
    status: "active",
    permissions,
    accessBenefit,
    sharing: {
      mode: LEGACY_SHARING_MODE,
      cycleIds: [],
      consentVersion: LEGACY_CONSENT_VERSION,
      decidedBy: patientId,
      decidedAt: timestamp
    },
    startedAt: timestamp,
    endedAt: null,
    endedBy: null,
    endReasonCode: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}
