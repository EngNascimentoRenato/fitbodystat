import {
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db } from "./firebase-core.js";

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function registrationRef(email) {
  return doc(db, "professionalRegistrations", normalizeEmail(email));
}

export async function registerProfessional(data) {
  const email = normalizeEmail(data?.email);
  const name = String(data?.name || "").trim();
  if (name.length < 2) throw new Error("Informe o nome do profissional.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe um e-mail válido.");

  const reference = registrationRef(email);
  const existing = await getDoc(reference);
  if (existing.data()?.status === "active") {
    return { status: "active", userId: existing.data().userId || null };
  }

  await setDoc(reference, {
    name,
    emailLower: email,
    status: "awaiting_registration",
    userId: null,
    createdBy: auth.currentUser?.uid || "",
    ...(existing.exists() ? {} : { createdAt: serverTimestamp() }),
    updatedAt: serverTimestamp()
  }, { merge: true });
  return { status: "awaiting_registration" };
}

export async function activateProfessionalAccess() {
  const user = auth.currentUser;
  if (!user?.uid || !user.email || !user.emailVerified) {
    return { role: "user", activated: false };
  }

  const userRef = doc(db, "users", user.uid);
  const authorizationRef = registrationRef(user.email);
  return runTransaction(db, async (transaction) => {
    const [userSnapshot, authorizationSnapshot] = await Promise.all([
      transaction.get(userRef),
      transaction.get(authorizationRef)
    ]);
    const currentRole = userSnapshot.data()?.role || "user";
    if (!authorizationSnapshot.exists()
      || ["cancelled", "revoked"].includes(authorizationSnapshot.data()?.status)) {
      return { role: currentRole, activated: false };
    }

    transaction.update(userRef, {
      role: "professional",
      updatedAt: serverTimestamp()
    });
    transaction.update(authorizationRef, {
      status: "active",
      userId: user.uid,
      activatedAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    return { role: "professional", activated: true };
  });
}

export async function setUserRole(userId, role) {
  if (!["user", "professional", "admin"].includes(role)) throw new Error("Nível inválido.");
  const userRef = doc(db, "users", userId);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) throw new Error("Usuário não encontrado.");

  await updateDoc(userRef, {
    role,
    updatedAt: serverTimestamp()
  });

  const email = normalizeEmail(userSnapshot.data().email);
  if (email) {
    const authorizationRef = registrationRef(email);
    const authorizationSnapshot = await getDoc(authorizationRef);
    if (role === "professional") {
      await setDoc(authorizationRef, {
        name: userSnapshot.data().name || "",
        emailLower: email,
        status: "active",
        userId,
        createdBy: auth.currentUser?.uid || "",
        activatedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }, { merge: true });
    } else if (authorizationSnapshot.exists() && authorizationSnapshot.data().userId === userId) {
      await updateDoc(authorizationRef, {
        status: "revoked",
        revokedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    }
  }
  return { role };
}

export async function cancelProfessionalRegistration(registrationId) {
  await updateDoc(doc(db, "professionalRegistrations", registrationId), {
    status: "cancelled",
    cancelledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return { status: "cancelled" };
}
