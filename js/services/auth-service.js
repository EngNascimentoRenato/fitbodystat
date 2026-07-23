import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  linkWithCredential,
  linkWithPopup,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import { auth, googleProvider } from "./firebase-core.js";

export function observeAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getProviderIds(user = auth.currentUser) {
  return new Set((user?.providerData || []).map((provider) => provider.providerId));
}

export async function signInWithGoogle() {
  const result = await signInWithPopup(auth, googleProvider);
  return result.user;
}

export async function signInWithEmail(email, password) {
  const result = await signInWithEmailAndPassword(auth, email, password);
  return result.user;
}

export async function createAccountWithEmail(name, email, password) {
  const result = await createUserWithEmailAndPassword(auth, email, password);
  await updateProfile(result.user, { displayName: name.trim() });
  await sendEmailVerification(result.user);
  return result.user;
}

export async function resendVerificationEmail(user = auth.currentUser) {
  if (!user) throw new Error("Usuário não autenticado.");
  await sendEmailVerification(user);
}

export async function sendPasswordReset(email) {
  await sendPasswordResetEmail(auth, String(email || "").trim());
}

export async function updateCurrentUserName(name) {
  if (!auth.currentUser) return;
  await updateProfile(auth.currentUser, { displayName: String(name || "").trim() });
}

export async function linkGoogleToCurrentUser() {
  if (!auth.currentUser) throw new Error("Usuário não autenticado.");
  const result = await linkWithPopup(auth.currentUser, googleProvider);
  return result.user;
}

export async function addPasswordToCurrentUser(password) {
  const user = auth.currentUser;
  if (!user?.email) throw new Error("Esta conta não possui e-mail disponível.");
  const credential = EmailAuthProvider.credential(user.email, password);
  const result = await linkWithCredential(user, credential);
  return result.user;
}

export function signOutUser() {
  return signOut(auth);
}
