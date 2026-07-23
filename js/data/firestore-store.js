import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../services/firebase-core.js";

function publicUserData(user, role = "user") {
  return {
    uid: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    role,
    updatedAt: serverTimestamp()
  };
}

function withoutMetadata(data = {}) {
  const { ownerId, updatedAt, createdAt, updatedBy, updatedByRole, ...content } = data;
  return content;
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      ...publicUserData(user),
      createdAt: serverTimestamp()
    });
    return { role: "user" };
  }

  const data = snapshot.data();
  await setDoc(userRef, publicUserData(user, data.role || "user"), { merge: true });
  return data;
}

export async function getUser(userId) {
  const snapshot = await getDoc(doc(db, "users", userId));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

export async function loadCloudState(userId) {
  const [profileSnapshot, planSnapshot, settingsSnapshot, entriesSnapshot] = await Promise.all([
    getDoc(doc(db, "profiles", userId)),
    getDoc(doc(db, "plans", userId)),
    getDoc(doc(db, "settings", userId)),
    getDocs(collection(db, "users", userId, "measurements"))
  ]);

  const hasData = profileSnapshot.exists()
    || planSnapshot.exists()
    || settingsSnapshot.exists()
    || !entriesSnapshot.empty;

  if (!hasData) return null;

  const planData = planSnapshot.exists() ? planSnapshot.data() : {};
  return {
    profile: profileSnapshot.exists() ? withoutMetadata(profileSnapshot.data()) : {},
    goalPlan: planData.goalPlan || [],
    settings: settingsSnapshot.exists() ? withoutMetadata(settingsSnapshot.data()) : {},
    entries: entriesSnapshot.docs
      .map((item) => ({ id: item.id, ...withoutMetadata(item.data()) }))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}

export async function saveCloudState(userId, state, actor = {}) {
  const measurementsRef = collection(db, "users", userId, "measurements");
  const existingEntries = await getDocs(measurementsRef);
  const batch = writeBatch(db);
  const audit = {
    ownerId: userId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid || userId,
    updatedByRole: actor.role || "user"
  };

  batch.set(doc(db, "profiles", userId), { ...state.profile, ...audit }, { merge: true });
  batch.set(doc(db, "plans", userId), { goalPlan: state.goalPlan || [], ...audit }, { merge: true });
  batch.set(doc(db, "settings", userId), { ...(state.settings || {}), ...audit }, { merge: true });

  const currentIds = new Set((state.entries || []).map((entry) => entry.id));
  existingEntries.docs.forEach((entrySnapshot) => {
    if (!currentIds.has(entrySnapshot.id)) batch.delete(entrySnapshot.ref);
  });

  (state.entries || []).forEach((entry) => {
    batch.set(doc(measurementsRef, entry.id), { ...entry, ...audit }, { merge: true });
  });

  await batch.commit();
}

function auditData(userId, actor = {}) {
  return {
    ownerId: userId,
    updatedAt: serverTimestamp(),
    updatedBy: actor.uid || userId,
    updatedByRole: actor.role || "user"
  };
}

export async function saveProfileAndPlan(userId, state, actor = {}) {
  const audit = auditData(userId, actor);
  const batch = writeBatch(db);
  batch.set(doc(db, "profiles", userId), { ...state.profile, ...audit }, { merge: true });
  batch.set(doc(db, "plans", userId), { goalPlan: state.goalPlan || [], ...audit }, { merge: true });
  await batch.commit();
}

export async function saveSettings(userId, settings, actor = {}) {
  await setDoc(doc(db, "settings", userId), {
    ...(settings || {}),
    ...auditData(userId, actor)
  }, { merge: true });
}

export async function saveMeasurement(userId, entry, actor = {}) {
  await setDoc(doc(db, "users", userId, "measurements", entry.id), {
    ...entry,
    ...auditData(userId, actor)
  }, { merge: true });
}

export async function deleteMeasurement(userId, entryId) {
  await deleteDoc(doc(db, "users", userId, "measurements", entryId));
}

export async function updateOwnDirectoryName(userId, name) {
  await updateDoc(doc(db, "users", userId), {
    name: String(name || "").trim(),
    updatedAt: serverTimestamp()
  });
}

export async function listUsers() {
  const snapshot = await getDocs(collection(db, "users"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function updateUserRole(userId, role) {
  await updateDoc(doc(db, "users", userId), {
    role,
    updatedAt: serverTimestamp()
  });
}

export async function createCareInvitation(professional, patientEmail) {
  const patientEmailLower = normalizeEmail(patientEmail);
  const existing = await listInvitationsForProfessional(professional.uid);
  const duplicate = existing.find((invitation) =>
    invitation.patientEmailLower === patientEmailLower
    && invitation.status === "pending"
  );
  if (duplicate) throw new Error("Já existe um convite pendente para este e-mail.");

  return addDoc(collection(db, "careInvitations"), {
    professionalId: professional.uid,
    professionalName: professional.displayName || "",
    professionalEmail: professional.email || "",
    patientEmailLower,
    patientId: null,
    status: "pending",
    permissions: {
      viewData: true,
      editData: true
    },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function listInvitationsForProfessional(professionalId) {
  const snapshot = await getDocs(query(
    collection(db, "careInvitations"),
    where("professionalId", "==", professionalId)
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listInvitationsForUser(email) {
  const snapshot = await getDocs(query(
    collection(db, "careInvitations"),
    where("patientEmailLower", "==", normalizeEmail(email))
  ));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listAllCareInvitations() {
  const snapshot = await getDocs(collection(db, "careInvitations"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function respondToCareInvitation(invitation, user, response) {
  if (!['accepted', 'rejected'].includes(response)) throw new Error("Resposta inválida.");

  const invitationRef = doc(db, "careInvitations", invitation.id);
  const batch = writeBatch(db);
  batch.update(invitationRef, {
    status: response,
    patientId: user.uid,
    patientName: user.displayName || "",
    respondedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (response === "accepted") {
    const linkId = `${invitation.professionalId}_${user.uid}`;
    batch.set(doc(db, "careLinks", linkId), {
      invitationId: invitation.id,
      professionalId: invitation.professionalId,
      patientId: user.uid,
      status: "active",
      permissions: invitation.permissions || { viewData: true, editData: true },
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  await batch.commit();
}

export async function cancelCareInvitation(invitationId) {
  await updateDoc(doc(db, "careInvitations", invitationId), {
    status: "cancelled",
    updatedAt: serverTimestamp()
  });
}

export async function listCareLinksForProfessional(professionalId) {
  const snapshot = await getDocs(query(
    collection(db, "careLinks"),
    where("professionalId", "==", professionalId)
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active");
}

export async function listCareLinksForUser(patientId) {
  const snapshot = await getDocs(query(
    collection(db, "careLinks"),
    where("patientId", "==", patientId)
  ));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() }))
    .filter((item) => item.status === "active");
}

export async function listPatientsForProfessional(professionalId) {
  const links = await listCareLinksForProfessional(professionalId);
  const patients = await Promise.all(links.map(async (link) => {
    const [user, profileSnapshot] = await Promise.all([
      getUser(link.patientId),
      getDoc(doc(db, "profiles", link.patientId))
    ]);
    if (!user) return null;
    const profile = profileSnapshot.exists() ? withoutMetadata(profileSnapshot.data()) : {};
    return { ...user, name: profile.name || user.name, link };
  }));
  return patients.filter(Boolean);
}

export async function listProfessionalsForUser(patientId) {
  const links = await listCareLinksForUser(patientId);
  const professionals = await Promise.all(links.map(async (link) => {
    const user = await getUser(link.professionalId);
    return user ? { ...user, link } : null;
  }));
  return professionals.filter(Boolean);
}

export async function listAllCareLinks() {
  const snapshot = await getDocs(collection(db, "careLinks"));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function revokeCareLink(link, actorId) {
  await updateDoc(doc(db, "careLinks", link.id), {
    status: "revoked",
    revokedBy: actorId,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
