import { createBlankState, loadState, normalizeState, saveState } from "./data/local-store.js";
import {
  deleteActivity,
  deleteMeasurement,
  completeUserOnboarding,
  ensureUserDocument,
  getUser,
  loadProfessionalProfile,
  loadCloudState,
  saveCloudState,
  saveActivity,
  saveContact,
  saveMeasurement,
  saveMeasurementAndProfile,
  saveProfessionalProfile,
  saveProfileAndPlan,
  saveSettings,
  updateOwnDirectoryName
} from "./data/firestore-store.js";
import {
  observeAuth,
  signOutUser,
  updateCurrentUserName
} from "./services/auth-service.js";
import { activateProfessionalAccess } from "./services/role-service.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";
import { escapeAttribute, escapeHtml } from "./utils/html-utils.js";
import { formatPhone } from "./utils/phone-utils.js";

const roleLabels = {
  user: "Usuário",
  professional: "Profissional",
  admin: "Administrador"
};

let state = createBlankState();
let personalState = state;
let authRedirect = "login.html";
let authState = {
  user: null,
  role: "user",
  status: "active",
  needsName: false,
  needsOnboarding: false,
  professionalProfile: null,
  presentationMode: sessionStorage.getItem("fitbodystat-presentation-mode") || "off",
  syncStatus: "Verificando login...",
  adminUsers: null,
  adminLinks: null,
  adminInvitations: null,
  adminProfessionalRegistrations: null,
  patients: null,
  sentInvitations: null,
  invitations: null,
  professionals: null,
  activePatient: null
};
let isApplyingCloudState = false;
let authReady = false;

function usesGoogle(user) {
  return user?.providerData?.some((provider) => provider.providerId === "google.com");
}

function applyTheme() {
  document.documentElement.dataset.theme = personalState.settings?.theme || "light";
}

function setPresentationMode(mode, shouldRender = true) {
  const allowedModes = new Set(["off", "identity", "evolution"]);
  authState.presentationMode = allowedModes.has(mode) ? mode : "off";
  document.body.dataset.presentationMode = authState.presentationMode;
  if (authState.presentationMode === "off") {
    sessionStorage.removeItem("fitbodystat-presentation-mode");
  } else {
    sessionStorage.setItem("fitbodystat-presentation-mode", authState.presentationMode);
  }
  if (shouldRender) render();
}

function saveChangeToCloud(userId, stateToSave, change) {
  const actor = { uid: authState.user.uid, role: authState.role };
  if (change?.type === "profile-plan") {
    const requests = [saveProfileAndPlan(userId, stateToSave, actor)];
    if (actor.uid === userId) requests.push(saveContact(userId, stateToSave.contact, actor));
    return Promise.all(requests);
  }
  if (change?.type === "settings") return saveSettings(userId, stateToSave.settings, actor);
  if (change?.type === "entry-upsert") {
    return change.profileChanged
      ? saveMeasurementAndProfile(userId, stateToSave, change.entry, actor)
      : saveMeasurement(userId, change.entry, actor);
  }
  if (change?.type === "entry-delete") return deleteMeasurement(userId, change.entryId);
  if (change?.type === "activity-upsert") return saveActivity(userId, change.activity, actor);
  if (change?.type === "activity-delete") return deleteActivity(userId, change.activityId);
  return saveCloudState(userId, stateToSave, actor);
}

function persist(change) {
  if (!authState.user) return;
  if (!authState.activePatient) {
    personalState = state;
    persistPersonal(change);
    return;
  }

  saveChangeToCloud(authState.activePatient.uid, state, change)
    .then(() => {
      authState.syncStatus = "Dados do paciente sincronizados.";
    })
    .catch((error) => {
      authState.syncStatus = `Falha ao sincronizar: ${error.message}`;
    });
}

function persistPersonal(change) {
  if (!authState.user) return;
  const name = String(personalState.profile?.name || "").trim();
  authState.needsName = !name;
  saveState(personalState, authState.user.uid);
  applyTheme();

  if (name) {
    Promise.all([
      updateOwnDirectoryName(authState.user.uid, name),
      updateCurrentUserName(name)
    ]).catch(() => {});
  }

  if (!isApplyingCloudState) {
    saveChangeToCloud(authState.user.uid, personalState, change)
      .then(() => {
        authState.syncStatus = "Sincronizado com Firestore.";
      })
      .catch((error) => {
        authState.syncStatus = `Falha ao sincronizar: ${error.message}`;
      });
  }
}

function replaceState(nextState) {
  state = nextState;
  if (!authState.activePatient) personalState = nextState;
}

function replacePersonalState(nextState) {
  personalState = nextState;
  if (!authState.activePatient) state = nextState;
}

async function openPatient(patientOrId) {
  if (!authState.user || authState.role !== "professional") return;
  const patient = typeof patientOrId === "string" ? await getUser(patientOrId) : patientOrId;
  if (!patient) throw new Error("Usuário não encontrado.");

  if (!authState.activePatient) personalState = state;
  authState.syncStatus = "Carregando dados do paciente...";
  authState.activePatient = {
    uid: patient.uid || patient.id,
    name: patient.name || patient.email || "Paciente",
    email: patient.email || "",
    phone: patient.phone || "",
    link: patient.link || null
  };
  state = normalizeState((await loadCloudState(authState.activePatient.uid, {
    includeContact: patient.link?.permissions?.sharePhone === true
  })) || {});
  authState.syncStatus = "Dados do paciente carregados.";
  location.hash = "#/dashboard";
  render();
}

function leavePatientContext() {
  if (!authState.activePatient) return;
  authState.activePatient = null;
  state = personalState;
  authState.syncStatus = "Você voltou aos seus próprios dados.";
}

function closePatient() {
  leavePatientContext();
  location.hash = "#/pacientes";
  render();
}

function renderPatientContext() {
  const container = document.getElementById("patient-context");
  const patient = authState.activePatient;
  container.hidden = !patient;
  const protectIdentity = authState.presentationMode !== "off";
  container.innerHTML = patient ? `
    <div>
      <span>Acompanhando</span>
      <strong>${protectIdentity ? "Paciente protegido" : escapeHtml(patient.name)}</strong>
      ${protectIdentity ? "" : `<small>${escapeHtml(patient.email)}</small>`}
      ${!protectIdentity && patient.phone ? `<a href="tel:${escapeAttribute(patient.phone)}">${escapeHtml(formatPhone(patient.phone))}</a>` : ""}
    </div>
    <button class="button" id="close-patient" type="button">Encerrar visualização</button>
  ` : "";
  document.getElementById("close-patient")?.addEventListener("click", closePatient);
}

function renderSidebarUser() {
  const container = document.getElementById("sidebar-user");
  const protectIdentity = authState.presentationMode !== "off";
  const name = protectIdentity
    ? "Identidade protegida"
    : personalState.profile?.name || authState.user?.displayName || authState.user?.email || "Usuário";
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  container.innerHTML = `
    <span class="user-avatar" aria-hidden="true">${escapeHtml(initials || "U")}</span>
    <span class="sidebar-user-text">
      <strong>${escapeHtml(name)}</strong>
      <small>${roleLabels[authState.role] || "Usuário"}</small>
    </span>
  `;
  container.title = `${name} · ${roleLabels[authState.role] || "Usuário"}`;
  document.getElementById("brand-home").href = authState.role === "professional"
    ? "#/pacientes"
    : authState.role === "admin" ? "#/admin" : "#/dashboard";
}

function render() {
  applyTheme();
  document.body.dataset.presentationMode = authState.presentationMode;
  const presentationIndicator = document.getElementById("presentation-indicator");
  presentationIndicator.hidden = authState.presentationMode === "off";
  renderSidebarUser();
  renderRoute({
    state,
    personalState,
    authState,
    persist,
    persistPersonal,
    render,
    replaceState,
    replacePersonalState,
    openPatient,
    closePatient,
    leavePatientContext,
    completeOnboarding,
    setPresentationMode
  });
  renderPatientContext();
}

document.getElementById("menu-toggle").addEventListener("click", () => {
  if (window.matchMedia("(max-width: 900px)").matches) {
    document.body.classList.toggle("menu-open");
    return;
  }
  document.body.classList.toggle("menu-collapsed");
});

function closeMobileMenu() {
  if (window.matchMedia("(max-width: 900px)").matches) {
    document.body.classList.remove("menu-open");
  }
}

document.getElementById("menu-backdrop")?.addEventListener("click", closeMobileMenu);
document.querySelector(".sidebar")?.addEventListener("click", (event) => {
  if (!window.matchMedia("(max-width: 900px)").matches) return;
  if (event.target.closest(".nav-link")) {
    closeMobileMenu();
    return;
  }
  if (event.target.matches(".sidebar, .nav-list, .nav-section")) closeMobileMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});
document.getElementById("presentation-indicator")?.addEventListener("click", () => {
  setPresentationMode("off");
});

window.addEventListener("hashchange", render);
registerServiceWorker();

async function completeOnboarding(payload) {
  const profile = { ...personalState.profile, ...(payload.profile || {}) };
  personalState.profile = profile;
  personalState.contact = { ...personalState.contact, ...(payload.contact || {}) };
  if (payload.goalPlan) personalState.goalPlan = payload.goalPlan;
  state = personalState;

  const actor = { uid: authState.user.uid, role: authState.role };
  await saveCloudState(authState.user.uid, personalState, actor);
  if (authState.role === "professional" && payload.professionalProfile) {
    await saveProfessionalProfile(authState.user.uid, payload.professionalProfile, actor);
    authState.professionalProfile = payload.professionalProfile;
  }
  await completeUserOnboarding(authState.user.uid, authState.role);
  await Promise.all([
    updateOwnDirectoryName(authState.user.uid, profile.name),
    updateCurrentUserName(profile.name)
  ]);
  saveState(personalState, authState.user.uid);
  authState.needsOnboarding = false;
  authState.needsName = false;
  authState.syncStatus = "Cadastro concluído e sincronizado.";
  location.hash = authState.role === "professional" ? "#/pacientes" : "#/dashboard";
  render();
}

observeAuth(async (user) => {
  authState.user = user;
  if (!user) {
    setPresentationMode("off", false);
    location.replace(authRedirect);
    return;
  }

  if (!user.emailVerified && !usesGoogle(user)) {
    authRedirect = "login.html?status=verify-email";
    await signOutUser();
    return;
  }

  try {
    authReady = true;
    authState.syncStatus = "Carregando dados da nuvem...";
    render();

    let userDoc = await ensureUserDocument(user);
    try {
      const activation = await activateProfessionalAccess();
      if (activation?.role && activation.role !== userDoc.role) {
        userDoc = await getUser(user.uid) || { ...userDoc, role: activation.role };
      }
    } catch (error) {
      if (!["functions/not-found", "functions/unavailable"].includes(error.code)) throw error;
    }
    authState.role = userDoc.role || "user";
    authState.status = userDoc.status || "active";
    if (authState.status === "suspended") {
      authRedirect = "login.html?status=suspended";
      await signOutUser();
      return;
    }

    authState.adminUsers = null;
    authState.adminLinks = null;
    authState.adminInvitations = null;
    authState.adminProfessionalRegistrations = null;
    authState.patients = null;
    authState.sentInvitations = null;
    authState.invitations = null;
    authState.professionals = null;
    authState.activePatient = null;
    authState.professionalProfile = authState.role === "professional"
      ? await loadProfessionalProfile(user.uid)
      : null;

    const cloudState = await loadCloudState(user.uid);
    isApplyingCloudState = true;
    if (cloudState?.profile) {
      state = normalizeState(cloudState);
      personalState = state;
      saveState(state, user.uid);
      authState.syncStatus = "Dados carregados do Firestore.";
    } else {
      state = loadState(user.uid);
      personalState = state;
      authState.syncStatus = "Conta nova pronta. Preencha seu perfil.";
    }

    const accountName = user.displayName || userDoc.name || "";
    if (!personalState.profile.name && accountName) personalState.profile.name = accountName;
    authState.needsName = !String(personalState.profile.name || "").trim();
    const hasPersonalBaseline = Boolean(
      personalState.profile.name
      && personalState.profile.sex
      && personalState.profile.heightCm
      && personalState.profile.startWeightKg
    );
    const hasProfessionalRegistration = Boolean(
      authState.professionalProfile?.name
      && authState.professionalProfile?.professionType
    );
    authState.needsOnboarding = authState.role === "professional"
      ? !hasProfessionalRegistration
      : authState.role !== "admin"
        && userDoc.onboardingCompleted !== true
        && !hasPersonalBaseline;
    if (!authState.needsName && user.displayName !== personalState.profile.name) {
      await updateCurrentUserName(personalState.profile.name);
      await updateOwnDirectoryName(user.uid, personalState.profile.name);
    }
    const actor = { uid: user.uid, role: authState.role };
    if (cloudState?.profile) {
      await Promise.all([
        saveProfileAndPlan(user.uid, personalState, actor),
        saveSettings(user.uid, personalState.settings, actor)
      ]);
    } else {
      await saveCloudState(user.uid, personalState, actor);
    }
    isApplyingCloudState = false;

    if (!location.hash) {
      location.hash = authState.needsOnboarding
        ? "#/primeiro-acesso"
        : authState.needsName
        ? "#/perfil"
        : authState.role === "professional" ? "#/pacientes"
          : authState.role === "admin" ? "#/admin" : "#/dashboard";
    }
  } catch (error) {
    isApplyingCloudState = false;
    authState.syncStatus = `Falha no Firebase: ${error.message}`;
  }

  render();
});

if (!authReady) render();
