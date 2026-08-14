import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { functions } from "./firebase-core.js";

const createInvitationCall = httpsCallable(functions, "createCareInvitation");
const cancelInvitationCall = httpsCallable(functions, "cancelCareInvitation");
const accessSummaryCall = httpsCallable(functions, "getProfessionalAccessSummary");
const professionalRequestCall = httpsCallable(functions, "requestProfessionalAccess");
const professionalDecisionCall = httpsCallable(functions, "decideProfessionalAccessRequest");
const personalRequestCall = httpsCallable(functions, "requestPersonalAccess");
const personalDecisionCall = httpsCallable(functions, "decidePersonalAccessRequest");
const personalGrantCall = httpsCallable(functions, "grantPersonalAlphaAccess");
const personalRevokeCall = httpsCallable(functions, "revokePersonalAlphaAccess");
const endCareEpisodeCall = httpsCallable(functions, "endCareEpisode");

function resultData(result) {
  return result?.data || {};
}

export async function createProfessionalInvitation(patientEmail) {
  return resultData(await createInvitationCall({ patientEmail }));
}

export async function cancelProfessionalInvitation(invitationId) {
  return resultData(await cancelInvitationCall({ invitationId }));
}

export async function loadProfessionalAccessSummary() {
  return resultData(await accessSummaryCall());
}

export async function requestProfessionalAlphaAccess(input) {
  return resultData(await professionalRequestCall(input));
}

export async function decideProfessionalAlphaAccess(requestId, decision, reason = "") {
  return resultData(await professionalDecisionCall({ requestId, decision, reason }));
}

export async function requestPersonalAlphaAccess(input) {
  return resultData(await personalRequestCall(input));
}

export async function decidePersonalAlphaAccess(requestId, decision, reason = "") {
  return resultData(await personalDecisionCall({ requestId, decision, reason }));
}

export async function grantPersonalAlphaAccess(email) {
  return resultData(await personalGrantCall({ email }));
}

export async function revokePersonalAlphaAccess(email) {
  return resultData(await personalRevokeCall({ email }));
}

export async function endProfessionalCareEpisode(linkId, reasonCode, reasonDetails = "") {
  return resultData(await endCareEpisodeCall({ linkId, reasonCode, reasonDetails }));
}
