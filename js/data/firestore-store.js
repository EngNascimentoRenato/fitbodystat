import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc
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

export async function ensureUserDocument(user) {
  const userRef = doc(db, "users", user.uid);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) {
    await setDoc(userRef, {
      uid: user.uid,
      name: user.displayName || "",
      email: user.email || "",
      photoURL: user.photoURL || "",
      role: "user",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { role: "user" };
  }

  const data = snapshot.data();
  await setDoc(userRef, {
    name: user.displayName || data.name || "",
    email: user.email || data.email || "",
    photoURL: user.photoURL || data.photoURL || "",
    updatedAt: serverTimestamp()
  }, { merge: true });

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
