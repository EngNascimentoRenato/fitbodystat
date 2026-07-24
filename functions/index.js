import { createHash } from "node:crypto";
import { initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

const db = getFirestore();
const auth = getAuth();
const allowedRoles = new Set(["user", "professional", "admin"]);

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function registrationId(email) {
  return createHash("sha256").update(normalizeEmail(email)).digest("hex");
}

async function requireAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Entre novamente.");
  const snapshot = await db.doc(`users/${request.auth.uid}`).get();
  const account = snapshot.data();
  if (!snapshot.exists || account?.role !== "admin" || account?.status === "suspended") {
    throw new HttpsError("permission-denied", "Acesso exclusivo da administração.");
  }
}

async function applyRole(uid, role) {
  const user = await auth.getUser(uid);
  if (role === "professional" && !user.emailVerified) {
    throw new HttpsError("failed-precondition", "O e-mail precisa estar verificado.");
  }
  await auth.setCustomUserClaims(uid, {
    ...(user.customClaims || {}),
    role
  });
  await db.doc(`users/${uid}`).set({
    uid,
    email: user.email || "",
    name: user.displayName || "",
    role,
    status: "active",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return user;
}

export const registerProfessional = onCall(async (request) => {
  await requireAdmin(request);
  const email = normalizeEmail(request.data?.email);
  const name = String(request.data?.name || "").trim();

  if (!name || name.length < 2) {
    throw new HttpsError("invalid-argument", "Informe o nome do profissional.");
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new HttpsError("invalid-argument", "Informe um e-mail válido.");
  }

  let user = null;
  try {
    user = await auth.getUserByEmail(email);
  } catch (error) {
    if (error.code !== "auth/user-not-found") throw error;
  }

  if (user) {
    const userSnapshot = await db.doc(`users/${user.uid}`).get();
    if (userSnapshot.data()?.role === "admin") {
      throw new HttpsError("failed-precondition", "Este e-mail pertence a um administrador.");
    }
  }

  let status = "awaiting_registration";
  if (user?.emailVerified) {
    await applyRole(user.uid, "professional");
    status = "active";
  } else if (user) {
    status = "awaiting_validation";
  }

  const id = registrationId(email);
  await db.doc(`professionalRegistrations/${id}`).set({
    name,
    emailLower: email,
    status,
    userId: user?.uid || null,
    createdBy: request.auth.uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });

  return { id, status, userId: user?.uid || null };
});

export const activateProfessionalAccess = onCall(async (request) => {
  if (!request.auth?.uid || !request.auth.token?.email) {
    throw new HttpsError("unauthenticated", "Entre novamente.");
  }

  const user = await auth.getUser(request.auth.uid);
  const email = normalizeEmail(user.email);
  const reference = db.doc(`professionalRegistrations/${registrationId(email)}`);
  const snapshot = await reference.get();

  if (!snapshot.exists || ["cancelled", "revoked"].includes(snapshot.data()?.status)) {
    const userSnapshot = await db.doc(`users/${user.uid}`).get();
    return { role: userSnapshot.data()?.role || "user", activated: false };
  }
  if (!user.emailVerified) {
    await reference.set({
      userId: user.uid,
      status: "awaiting_validation",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    return { role: "user", activated: false, needsEmailVerification: true };
  }

  await applyRole(user.uid, "professional");
  await reference.set({
    userId: user.uid,
    status: "active",
    activatedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { role: "professional", activated: true };
});

export const setUserRole = onCall(async (request) => {
  await requireAdmin(request);
  const userId = String(request.data?.userId || "");
  const role = String(request.data?.role || "");
  if (!userId || !allowedRoles.has(role)) {
    throw new HttpsError("invalid-argument", "Usuário ou nível inválido.");
  }
  if (userId === request.auth.uid && role !== "admin") {
    throw new HttpsError("failed-precondition", "O administrador não pode remover o próprio acesso.");
  }

  const user = await applyRole(userId, role);
  if (user.email) {
    const reference = db.doc(`professionalRegistrations/${registrationId(user.email)}`);
    const snapshot = await reference.get();
    if (role === "professional") {
      await reference.set({
        name: user.displayName || snapshot.data()?.name || "",
        emailLower: normalizeEmail(user.email),
        status: "active",
        userId,
        createdBy: request.auth.uid,
        activatedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    } else if (snapshot.exists && snapshot.data()?.userId === userId) {
      await reference.set({
        status: "revoked",
        revokedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true });
    }
  }
  return { role };
});

export const cancelProfessionalRegistration = onCall(async (request) => {
  await requireAdmin(request);
  const registrationIdValue = String(request.data?.registrationId || "");
  if (!registrationIdValue) throw new HttpsError("invalid-argument", "Cadastro inválido.");

  const reference = db.doc(`professionalRegistrations/${registrationIdValue}`);
  const snapshot = await reference.get();
  if (!snapshot.exists) throw new HttpsError("not-found", "Pré-cadastro não encontrado.");
  if (snapshot.data()?.status === "active") {
    throw new HttpsError("failed-precondition", "Altere o nível da conta ativa pela lista de usuários.");
  }

  await reference.set({
    status: "cancelled",
    cancelledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  return { status: "cancelled" };
});
