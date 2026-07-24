import { httpsCallable } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-functions.js";
import { auth, functions } from "./firebase-core.js";

const registerProfessionalCall = httpsCallable(functions, "registerProfessional");
const activateProfessionalAccessCall = httpsCallable(functions, "activateProfessionalAccess");
const setUserRoleCall = httpsCallable(functions, "setUserRole");
const cancelProfessionalRegistrationCall = httpsCallable(functions, "cancelProfessionalRegistration");

export async function registerProfessional(data) {
  const result = await registerProfessionalCall(data);
  return result.data;
}

export async function activateProfessionalAccess() {
  const result = await activateProfessionalAccessCall();
  if (result.data?.activated) await auth.currentUser?.getIdToken(true);
  return result.data;
}

export async function setUserRole(userId, role) {
  const result = await setUserRoleCall({ userId, role });
  return result.data;
}

export async function cancelProfessionalRegistration(registrationId) {
  const result = await cancelProfessionalRegistrationCall({ registrationId });
  return result.data;
}
