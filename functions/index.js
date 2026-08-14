import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { beforeUserCreated } from "firebase-functions/v2/identity";
import { defineSecret } from "firebase-functions/params";
import { createHash } from "node:crypto";

initializeApp();

const db = getFirestore();
const DEFAULT_SEAT_LIMIT = 20;
const HOURLY_INVITE_LIMIT = 5;
const DAILY_INVITE_LIMIT = 20;
const INVITATION_TTL_DAYS = 7;
const PROFESSIONAL_REQUEST_HOURLY_LIMIT = 3;
const PERSONAL_GRANT_TTL_DAYS = 7;
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const APP_LOGIN_URL = "https://app.fitbodystat.com.br/login.html";
const EMAIL_SENDER = "FitBodyStat <suporte@fitbodystat.com.br>";
const allowedProfessions = new Set([
  "personal-trainer",
  "physical-educator",
  "nutritionist",
  "nutrologist"
]);
const careEndReasonCodes = new Set([
  "not-specified",
  "accompaniment-completed",
  "agreement-ended",
  "no-longer-continuing",
  "other"
]);

function normalizeEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function accessDecisionEmail({ name, decision, accessType }) {
  const safeName = escapeHtml(name || "Olá");
  const professional = accessType === "professional";
  if (decision === "approved") {
    const deadline = professional
      ? "Seu acesso profissional foi liberado."
      : `Sua autorização ficará disponível por ${PERSONAL_GRANT_TTL_DAYS} dias.`;
    return {
      subject: "Seu acesso ao FitBodyStat foi aprovado",
      html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17212b;max-width:600px;margin:auto">
        <h1 style="font-size:24px">Acesso aprovado</h1>
        <p>${safeName}, sua solicitação de acesso ao FitBodyStat foi aprovada.</p>
        <p>${deadline} Crie sua conta usando o mesmo endereço de e-mail informado na solicitação.</p>
        <p><a href="${APP_LOGIN_URL}" style="display:inline-block;background:#176b78;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px">Criar minha conta</a></p>
        <p style="color:#5f6b75;font-size:13px">Se você não solicitou este acesso, ignore esta mensagem.</p>
      </div>`
    };
  }
  return {
    subject: "Atualização sobre sua solicitação ao FitBodyStat",
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#17212b;max-width:600px;margin:auto">
      <h1 style="font-size:24px">Solicitação analisada</h1>
      <p>${safeName}, não foi possível liberar seu acesso ao FitBodyStat neste momento.</p>
      <p>Estamos operando com acesso limitado durante a fase alfa. Uma nova solicitação poderá ser realizada futuramente.</p>
      <p style="color:#5f6b75;font-size:13px">Se você não realizou esta solicitação, ignore esta mensagem.</p>
    </div>`
  };
}

async function sendAccessDecisionEmail({ requestId, email, name, decision, accessType }) {
  const content = accessDecisionEmail({ name, decision, accessType });
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY.value()}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `access-${accessType}-${requestId}-${decision}`
    },
    body: JSON.stringify({
      from: EMAIL_SENDER,
      to: [email],
      subject: content.subject,
      html: content.html
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`Resend ${response.status}: ${result?.message || "falha no envio"}`);
  }
  return result.id || null;
}

async function notifyAccessDecision({ requestRef, requestId, accessRequest, decision, accessType }) {
  try {
    const providerMessageId = await sendAccessDecisionEmail({
      requestId,
      email: accessRequest.emailLower,
      name: accessRequest.name,
      decision,
      accessType
    });
    await requestRef.set({
      notificationStatus: "sent",
      notificationProvider: "resend",
      notificationMessageId: providerMessageId,
      notificationSentAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status: "sent" };
  } catch (error) {
    console.error("Falha ao enviar notificação de acesso", {
      requestId,
      accessType,
      error: error?.message
    });
    await requestRef.set({
      notificationStatus: "failed",
      notificationErrorCode: "provider-error",
      notificationFailedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { status: "failed" };
  }
}

function timestampIsActive(value, nowMs = Date.now()) {
  if (!value) return true;
  const milliseconds = typeof value.toMillis === "function" ? value.toMillis() : Number(value);
  return Number.isFinite(milliseconds) && milliseconds > nowMs;
}

function requestFingerprint(request) {
  const source = String(
    request.rawRequest?.ip
    || request.rawRequest?.headers?.["x-forwarded-for"]
    || "unknown"
  ).split(",")[0].trim();
  return createHash("sha256").update(`fitbodystat-alpha:${source}`).digest("hex");
}

async function adminActor(request) {
  const uid = requireAuthentication(request);
  const snapshot = await db.doc(`users/${uid}`).get();
  if (!snapshot.exists || snapshot.data()?.status === "suspended" || snapshot.data()?.role !== "admin") {
    throw new HttpsError("permission-denied", "Acesso restrito à administração.");
  }
  return { uid, user: snapshot.data() };
}

async function hasActiveInvitation(emailLower) {
  const snapshot = await db.collection("careInvitations")
    .where("patientEmailLower", "==", emailLower)
    .where("status", "==", "pending")
    .get();
  return snapshot.docs.some((item) => timestampIsActive(item.data().expiresAt));
}

export const authorizeNewAccount = beforeUserCreated({ region: "us-central1" }, async (event) => {
  const emailLower = normalizeEmail(event.data?.email);
  if (!emailLower) {
    throw new HttpsError("permission-denied", "O acesso à fase alfa exige um e-mail válido.");
  }

  const [personalGrant, professionalRegistration, invited] = await Promise.all([
    db.doc(`personalAccessGrants/${emailLower}`).get(),
    db.doc(`professionalRegistrations/${emailLower}`).get(),
    hasActiveInvitation(emailLower)
  ]);
  const personalAccessAllowed = personalGrant.exists
    && personalGrant.data()?.status === "active"
    && timestampIsActive(personalGrant.data()?.expiresAt);
  const professionalAccessAllowed = professionalRegistration.exists
    && ["awaiting_registration", "awaiting_validation", "active"]
      .includes(professionalRegistration.data()?.status);

  if (!invited && !personalAccessAllowed && !professionalAccessAllowed) {
    throw new HttpsError(
      "permission-denied",
      "A fase alfa está disponível somente por convite ou liberação administrativa."
    );
  }
});

export const requestProfessionalAccess = onCall({ region: "us-central1" }, async (request) => {
  const name = String(request.data?.name || "").trim();
  const emailLower = normalizeEmail(request.data?.email);
  const professionType = String(request.data?.professionType || "").trim();
  if (name.length < 2) throw new HttpsError("invalid-argument", "Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }
  if (!allowedProfessions.has(professionType)) {
    throw new HttpsError("invalid-argument", "Selecione uma área profissional válida.");
  }

  const registrationSnapshot = await db.doc(`professionalRegistrations/${emailLower}`).get();
  if (registrationSnapshot.exists
    && !["cancelled", "revoked", "rejected"].includes(registrationSnapshot.data()?.status)) {
    return { status: "received" };
  }

  const fingerprint = requestFingerprint(request);
  const rateRef = db.doc(`publicRequestLimits/${fingerprint}`);
  const requestId = createHash("sha256").update(emailLower).digest("hex");
  const requestRef = db.doc(`professionalAccessRequests/${requestId}`);
  const nowMs = Date.now();
  await db.runTransaction(async (transaction) => {
    const [rateSnapshot, existingRequest] = await Promise.all([
      transaction.get(rateRef),
      transaction.get(requestRef)
    ]);
    if (existingRequest.data()?.status === "pending") return;
    const attempts = Array.isArray(rateSnapshot.data()?.attemptTimestamps)
      ? rateSnapshot.data().attemptTimestamps
        .map((value) => typeof value?.toMillis === "function" ? value.toMillis() : Number(value))
        .filter((value) => Number.isFinite(value) && value >= nowMs - 60 * 60 * 1000)
      : [];
    if (attempts.length >= PROFESSIONAL_REQUEST_HOURLY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Limite temporário alcançado. Tente novamente mais tarde.");
    }
    transaction.set(rateRef, {
      attemptTimestamps: [...attempts, nowMs],
      expiresAt: Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(requestRef, {
      name,
      emailLower,
      professionType,
      status: "pending",
      source: "public-alpha-request",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { status: "received" };
});

export const requestPersonalAccess = onCall({ region: "us-central1" }, async (request) => {
  const name = String(request.data?.name || "").trim();
  const emailLower = normalizeEmail(request.data?.email);
  if (name.length < 2) throw new HttpsError("invalid-argument", "Informe seu nome.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }

  const requestId = createHash("sha256").update(emailLower).digest("hex");
  const requestRef = db.doc(`personalAccessRequests/${requestId}`);
  const grantSnapshot = await db.doc(`personalAccessGrants/${emailLower}`).get();
  if (grantSnapshot.exists
    && grantSnapshot.data()?.status === "active"
    && timestampIsActive(grantSnapshot.data()?.expiresAt)) {
    return { status: "received" };
  }

  const fingerprint = requestFingerprint(request);
  const rateRef = db.doc(`publicRequestLimits/personal_${fingerprint}`);
  const nowMs = Date.now();
  await db.runTransaction(async (transaction) => {
    const [rateSnapshot, existingRequest] = await Promise.all([
      transaction.get(rateRef),
      transaction.get(requestRef)
    ]);
    if (existingRequest.data()?.status === "pending") return;
    const attempts = Array.isArray(rateSnapshot.data()?.attemptTimestamps)
      ? rateSnapshot.data().attemptTimestamps
        .map((value) => typeof value?.toMillis === "function" ? value.toMillis() : Number(value))
        .filter((value) => Number.isFinite(value) && value >= nowMs - 60 * 60 * 1000)
      : [];
    if (attempts.length >= PROFESSIONAL_REQUEST_HOURLY_LIMIT) {
      throw new HttpsError("resource-exhausted", "Limite temporário alcançado. Tente novamente mais tarde.");
    }
    transaction.set(rateRef, {
      attemptTimestamps: [...attempts, nowMs],
      expiresAt: Timestamp.fromMillis(nowMs + 24 * 60 * 60 * 1000),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(requestRef, {
      name,
      emailLower,
      accessType: "personal",
      status: "pending",
      source: "public-alpha-request",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  return { status: "received" };
});

export const decidePersonalAccessRequest = onCall({
  region: "us-central1",
  secrets: [RESEND_API_KEY]
}, async (request) => {
  const actor = await adminActor(request);
  const requestId = String(request.data?.requestId || "").trim();
  const decision = String(request.data?.decision || "").trim();
  const reason = String(request.data?.reason || "").trim().slice(0, 300);
  if (!requestId || !["approved", "rejected"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Decisão administrativa inválida.");
  }
  const accessRequestRef = db.doc(`personalAccessRequests/${requestId}`);
  const accessRequest = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(accessRequestRef);
    if (!snapshot.exists || snapshot.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Esta solicitação já foi analisada.");
    }
    const accessRequest = snapshot.data();
    const expiresAt = Timestamp.fromMillis(Date.now() + PERSONAL_GRANT_TTL_DAYS * 24 * 60 * 60 * 1000);
    transaction.update(accessRequestRef, {
      status: decision,
      decisionReason: reason,
      decidedBy: actor.uid,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    if (decision === "approved") {
      transaction.set(db.doc(`personalAccessGrants/${accessRequest.emailLower}`), {
        emailLower: accessRequest.emailLower,
        status: "active",
        source: "approved-public-request",
        grantedBy: actor.uid,
        grantedAt: FieldValue.serverTimestamp(),
        expiresAt,
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return accessRequest;
  });
  const notification = await notifyAccessDecision({
    requestRef: accessRequestRef,
    requestId,
    accessRequest,
    decision,
    accessType: "personal"
  });
  return { status: decision, notification: notification.status };
});

export const decideProfessionalAccessRequest = onCall({
  region: "us-central1",
  secrets: [RESEND_API_KEY]
}, async (request) => {
  const actor = await adminActor(request);
  const requestId = String(request.data?.requestId || "").trim();
  const decision = String(request.data?.decision || "").trim();
  const reason = String(request.data?.reason || "").trim().slice(0, 300);
  if (!requestId || !["approved", "rejected"].includes(decision)) {
    throw new HttpsError("invalid-argument", "Decisão administrativa inválida.");
  }
  const accessRequestRef = db.doc(`professionalAccessRequests/${requestId}`);
  const accessRequest = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(accessRequestRef);
    if (!snapshot.exists || snapshot.data()?.status !== "pending") {
      throw new HttpsError("failed-precondition", "Esta solicitação já foi analisada.");
    }
    const accessRequest = snapshot.data();
    transaction.update(accessRequestRef, {
      status: decision,
      decisionReason: reason,
      decidedBy: actor.uid,
      decidedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    if (decision === "approved") {
      transaction.set(db.doc(`professionalRegistrations/${accessRequest.emailLower}`), {
        name: accessRequest.name,
        emailLower: accessRequest.emailLower,
        professionType: accessRequest.professionType,
        status: "awaiting_registration",
        userId: null,
        source: "approved-public-request",
        createdBy: actor.uid,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
    return accessRequest;
  });
  const notification = await notifyAccessDecision({
    requestRef: accessRequestRef,
    requestId,
    accessRequest,
    decision,
    accessType: "professional"
  });
  return { status: decision, notification: notification.status };
});

export const grantPersonalAlphaAccess = onCall({ region: "us-central1" }, async (request) => {
  const actor = await adminActor(request);
  const emailLower = normalizeEmail(request.data?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailLower)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }
  await db.doc(`personalAccessGrants/${emailLower}`).set({
    emailLower,
    status: "active",
    source: "admin-alpha-grant",
    grantedBy: actor.uid,
    grantedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { status: "active" };
});

export const revokePersonalAlphaAccess = onCall({ region: "us-central1" }, async (request) => {
  const actor = await adminActor(request);
  const emailLower = normalizeEmail(request.data?.email);
  if (!emailLower) throw new HttpsError("invalid-argument", "Acesso não informado.");
  await db.doc(`personalAccessGrants/${emailLower}`).set({
    emailLower,
    status: "revoked",
    revokedBy: actor.uid,
    revokedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { status: "revoked" };
});

function careAreaForProfession(professionType) {
  if (["personal-trainer", "physical-educator"].includes(professionType)) return "physical-training";
  if (["nutritionist", "nutrologist"].includes(professionType)) return "nutrition";
  return "other";
}

function requireAuthentication(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Entre novamente para continuar.");
  return request.auth.uid;
}

async function requireProfessional(request) {
  const uid = requireAuthentication(request);
  const userSnapshot = await db.doc(`users/${uid}`).get();
  const user = userSnapshot.data();
  if (!userSnapshot.exists || user?.status === "suspended" || user?.role !== "professional") {
    throw new HttpsError("permission-denied", "Acesso restrito a profissionais ativos.");
  }
  return { uid, user };
}

function accessSettings(data = {}) {
  return {
    seatLimit: Number.isInteger(data.seatLimit) && data.seatLimit > 0
      ? data.seatLimit
      : DEFAULT_SEAT_LIMIT,
    invitationsEnabled: data.invitationsEnabled !== false,
    attemptTimestamps: Array.isArray(data.attemptTimestamps) ? data.attemptTimestamps : []
  };
}

async function relationshipSnapshots(transaction, professionalId) {
  const invitationsQuery = db.collection("careInvitations").where("professionalId", "==", professionalId);
  const linksQuery = db.collection("careLinks").where("professionalId", "==", professionalId);
  const [invitations, links] = await Promise.all([
    transaction.get(invitationsQuery),
    transaction.get(linksQuery)
  ]);
  return { invitations, links };
}

function relationshipUsage(invitations, links) {
  const nowMs = Date.now();
  const pendingInvitations = invitations.docs.filter((item) => {
    const invitation = item.data();
    const expiresAt = typeof invitation.expiresAt?.toMillis === "function"
      ? invitation.expiresAt.toMillis()
      : null;
    return invitation.status === "pending" && (expiresAt === null || expiresAt > nowMs);
  });
  const activeLinks = links.docs.filter((item) => item.data().status === "active");
  return {
    pendingInvitations,
    activeLinks,
    usedSeats: pendingInvitations.length + activeLinks.length
  };
}

export const getProfessionalAccessSummary = onCall({ region: "us-central1" }, async (request) => {
  const { uid } = await requireProfessional(request);
  const [accessSnapshot, invitationsSnapshot, linksSnapshot] = await Promise.all([
    db.doc(`professionalAccess/${uid}`).get(),
    db.collection("careInvitations").where("professionalId", "==", uid).get(),
    db.collection("careLinks").where("professionalId", "==", uid).get()
  ]);
  const settings = accessSettings(accessSnapshot.data());
  const usage = relationshipUsage(invitationsSnapshot, linksSnapshot);
  return {
    seatLimit: settings.seatLimit,
    usedSeats: usage.usedSeats,
    availableSeats: Math.max(0, settings.seatLimit - usage.usedSeats),
    invitationsEnabled: settings.invitationsEnabled
  };
});

export const createCareInvitation = onCall({ region: "us-central1" }, async (request) => {
  const { uid, user } = await requireProfessional(request);
  const patientEmailLower = normalizeEmail(request.data?.patientEmail);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmailLower)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }
  if (patientEmailLower === normalizeEmail(request.auth.token.email)) {
    throw new HttpsError("invalid-argument", "Use o e-mail de outra pessoa.");
  }

  const profileSnapshot = await db.doc(`professionalProfiles/${uid}`).get();
  const profile = profileSnapshot.data() || {};
  const professionType = profile.professionType || "";
  if (!allowedProfessions.has(professionType)) {
    throw new HttpsError("failed-precondition", "Atualize sua área profissional antes de criar convites.");
  }

  const accessRef = db.doc(`professionalAccess/${uid}`);
  const invitationRef = db.collection("careInvitations").doc();
  const nowMs = Date.now();
  const hourAgo = nowMs - 60 * 60 * 1000;
  const dayAgo = nowMs - 24 * 60 * 60 * 1000;
  const expiresAt = Timestamp.fromMillis(nowMs + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const summary = await db.runTransaction(async (transaction) => {
    const accessSnapshot = await transaction.get(accessRef);
    const settings = accessSettings(accessSnapshot.data());
    if (!settings.invitationsEnabled) {
      throw new HttpsError("permission-denied", "A criação de convites está temporariamente suspensa.");
    }

    const { invitations, links } = await relationshipSnapshots(transaction, uid);
    const usage = relationshipUsage(invitations, links);
    if (usage.pendingInvitations.some((item) => item.data().patientEmailLower === patientEmailLower)) {
      throw new HttpsError("already-exists", "Já existe um convite pendente para este e-mail.");
    }
    const invitationById = new Map(invitations.docs.map((item) => [item.id, item.data()]));
    if (usage.activeLinks.some((item) => {
      const link = item.data();
      const origin = invitationById.get(link.originInvitationId || link.invitationId);
      return normalizeEmail(origin?.patientEmailLower) === patientEmailLower;
    })) {
      throw new HttpsError("already-exists", "Esta pessoa já possui vínculo ativo com você.");
    }
    if (usage.usedSeats >= settings.seatLimit) {
      throw new HttpsError("resource-exhausted", "Todas as vagas da fase alfa estão ocupadas.");
    }

    const recentAttempts = settings.attemptTimestamps
      .map((value) => typeof value?.toMillis === "function" ? value.toMillis() : Number(value))
      .filter((value) => Number.isFinite(value) && value >= dayAgo);
    if (recentAttempts.filter((value) => value >= hourAgo).length >= HOURLY_INVITE_LIMIT
      || recentAttempts.length >= DAILY_INVITE_LIMIT) {
      throw new HttpsError("resource-exhausted", "Limite temporário de convites alcançado. Tente novamente mais tarde.");
    }

    const careArea = careAreaForProfession(professionType);
    transaction.set(invitationRef, {
      professionalId: uid,
      professionalName: profile.name || user.name || request.auth.token.name || "",
      professionalEmail: request.auth.token.email || user.email || "",
      professionalArea: professionType,
      professionType,
      careArea,
      patientEmailLower,
      patientId: null,
      status: "pending",
      permissions: { viewData: true, editData: true, createCycles: true },
      accessBenefit: { source: "professional-link", activeWhileLinked: true },
      expiresAt,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    transaction.set(accessRef, {
      seatLimit: settings.seatLimit,
      invitationsEnabled: settings.invitationsEnabled,
      attemptTimestamps: [...recentAttempts, nowMs],
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return {
      seatLimit: settings.seatLimit,
      usedSeats: usage.usedSeats + 1,
      availableSeats: Math.max(0, settings.seatLimit - usage.usedSeats - 1),
      invitationsEnabled: true
    };
  });

  return { invitationId: invitationRef.id, summary };
});

export const cancelCareInvitation = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuthentication(request);
  const invitationId = String(request.data?.invitationId || "").trim();
  if (!invitationId) throw new HttpsError("invalid-argument", "Convite não informado.");
  const invitationRef = db.doc(`careInvitations/${invitationId}`);
  await db.runTransaction(async (transaction) => {
    const [invitationSnapshot, actorSnapshot] = await Promise.all([
      transaction.get(invitationRef),
      transaction.get(db.doc(`users/${uid}`))
    ]);
    if (!invitationSnapshot.exists) throw new HttpsError("not-found", "Convite não encontrado.");
    const invitation = invitationSnapshot.data();
    const actor = actorSnapshot.data();
    if (invitation.professionalId !== uid && actor?.role !== "admin") {
      throw new HttpsError("permission-denied", "Você não pode cancelar este convite.");
    }
    if (invitation.status !== "pending") {
      throw new HttpsError("failed-precondition", "Este convite não está mais pendente.");
    }
    transaction.update(invitationRef, {
      status: "cancelled",
      cancelledBy: uid,
      cancelledAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
  });
  return { status: "cancelled" };
});

export const endCareEpisode = onCall({ region: "us-central1" }, async (request) => {
  const uid = requireAuthentication(request);
  const linkId = String(request.data?.linkId || "").trim();
  const reasonCode = String(request.data?.reasonCode || "not-specified").trim();
  const reasonDetails = reasonCode === "other"
    ? String(request.data?.reasonDetails || "").trim().slice(0, 500)
    : "";
  if (!linkId) throw new HttpsError("invalid-argument", "Acompanhamento não informado.");
  if (!careEndReasonCodes.has(reasonCode)) {
    throw new HttpsError("invalid-argument", "Motivo de encerramento inválido.");
  }

  const linkRef = db.doc(`careLinks/${linkId}`);
  const result = await db.runTransaction(async (transaction) => {
    const [linkSnapshot, actorSnapshot] = await Promise.all([
      transaction.get(linkRef),
      transaction.get(db.doc(`users/${uid}`))
    ]);
    if (!linkSnapshot.exists) throw new HttpsError("not-found", "Acompanhamento não encontrado.");
    const link = linkSnapshot.data();
    const actor = actorSnapshot.data() || {};
    if (link.status !== "active") {
      throw new HttpsError("failed-precondition", "Este acompanhamento já foi encerrado.");
    }
    if (uid !== link.patientId && uid !== link.professionalId && actor.role !== "admin") {
      throw new HttpsError("permission-denied", "Você não participa deste acompanhamento.");
    }

    const episodeId = link.activeEpisodeId
      || link.originInvitationId
      || link.invitationId
      || linkId;
    const episodeRef = db.doc(`careEpisodes/${episodeId}`);
    const assignmentRef = link.careArea
      ? db.doc(`users/${link.patientId}/careAreaAssignments/${link.careArea}`)
      : null;
    const auditRef = episodeRef.collection("auditEvents").doc();
    const reads = [transaction.get(episodeRef)];
    if (assignmentRef) reads.push(transaction.get(assignmentRef));
    const [episodeSnapshot, assignmentSnapshot = null] = await Promise.all(reads);
    const now = FieldValue.serverTimestamp();

    if (episodeSnapshot.exists && episodeSnapshot.data().status !== "active") {
      throw new HttpsError("failed-precondition", "Este período já foi encerrado.");
    }
    if (episodeSnapshot.exists) {
      transaction.update(episodeRef, {
        status: "ended",
        endedBy: uid,
        endedAt: now,
        endReasonCode: reasonCode,
        endReasonDetails: reasonDetails,
        updatedAt: now
      });
    } else {
      transaction.set(episodeRef, {
        relationshipModelVersion: 1,
        episodeId,
        linkId,
        invitationId: link.invitationId || null,
        originInvitationId: link.originInvitationId || link.invitationId || null,
        professionalId: link.professionalId,
        patientId: link.patientId,
        professionType: link.professionType || "",
        careArea: link.careArea || "other",
        status: "ended",
        permissions: link.permissions || {},
        accessBenefit: link.accessBenefit || { source: "professional-link", activeWhileLinked: true },
        sharing: {
          mode: "legacy-full-access",
          cycleIds: [],
          consentVersion: "legacy-v1",
          decidedBy: link.patientId,
          decidedAt: link.createdAt || now
        },
        startedAt: link.createdAt || now,
        endedAt: now,
        endedBy: uid,
        endReasonCode: reasonCode,
        endReasonDetails: reasonDetails,
        createdAt: link.createdAt || now,
        updatedAt: now
      });
    }

    transaction.update(linkRef, {
      status: "revoked",
      episodeStatus: "ended",
      revokedBy: uid,
      revokedAt: now,
      endReasonCode: reasonCode,
      activeEpisodeId: episodeId,
      updatedAt: now
    });
    if (assignmentSnapshot?.exists && assignmentSnapshot.data().linkId === linkId) {
      transaction.delete(assignmentRef);
    }
    transaction.set(auditRef, {
      eventType: "care-episode-ended",
      episodeId,
      linkId,
      professionalId: link.professionalId,
      patientId: link.patientId,
      actorId: uid,
      actorRole: actor.role || (uid === link.professionalId ? "professional" : "user"),
      actorNameSnapshot: actor.name || "",
      reasonCode,
      hasReasonDetails: Boolean(reasonDetails),
      occurredAt: now,
      notificationStatus: "pending"
    });
    return {
      episodeId,
      endedByRole: actor.role === "admin"
        ? "admin"
        : uid === link.professionalId ? "professional" : "user"
    };
  });
  return { status: "ended", ...result };
});
