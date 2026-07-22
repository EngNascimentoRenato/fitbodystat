import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { db } from "../services/firebase-core.js";

function stateForCloud(state) {
  return {
    profile: state.profile,
    entries: state.entries,
    goalPlan: state.goalPlan,
    settings: state.settings,
    updatedAt: new Date().toISOString()
  };
}

function publicUserData(user, role = "user") {
  return {
    uid: user.uid,
    name: user.displayName || "",
    email: user.email || "",
    emailLower: (user.email || "").toLowerCase(),
    photoURL: user.photoURL || "",
    role,
    updatedAt: serverTimestamp()
  };
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

export async function loadCloudState(userId) {
  const stateRef = doc(db, "users", userId, "app", "state");
  const snapshot = await getDoc(stateRef);
  return snapshot.exists() ? snapshot.data() : null;
}

export async function saveCloudState(userId, state) {
  const stateRef = doc(db, "users", userId, "app", "state");
  await setDoc(stateRef, {
    ...stateForCloud(state),
    serverUpdatedAt: serverTimestamp()
  }, { merge: true });
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

export async function findUserByEmail(email) {
  const normalized = email.trim().toLowerCase();
  const snapshot = await getDocs(query(collection(db, "users"), where("emailLower", "==", normalized)));
  return snapshot.empty ? null : { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function createCareLink(professionalId, patientId, permissions = { read: true, writeNotes: true }) {
  const linkId = `${professionalId}_${patientId}`;
  await setDoc(doc(db, "careLinks", linkId), {
    professionalId,
    patientId,
    status: "active",
    permissions,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function listCareLinksForProfessional(professionalId) {
  const snapshot = await getDocs(query(collection(db, "careLinks"), where("professionalId", "==", professionalId), where("status", "==", "active")));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function listPatientsForProfessional(professionalId) {
  const links = await listCareLinksForProfessional(professionalId);
  const patients = await Promise.all(links.map(async (link) => {
    const patientSnapshot = await getDoc(doc(db, "users", link.patientId));
    return patientSnapshot.exists() ? { id: patientSnapshot.id, link, ...patientSnapshot.data() } : null;
  }));
  return patients.filter(Boolean);
}
