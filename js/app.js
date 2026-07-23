import { createBlankState, loadState, normalizeState, saveState } from "./data/local-store.js";
import {
  deleteMeasurement,
  ensureUserDocument,
  getUser,
  loadCloudState,
  saveCloudState,
  saveMeasurement,
  saveProfileAndPlan,
  saveSettings,
  updateOwnDirectoryName
} from "./data/firestore-store.js";
import {
  observeAuth,
  signOutUser,
  updateCurrentUserName
} from "./services/auth-service.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";
import { escapeHtml } from "./utils/html-utils.js";

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
  syncStatus: "Verificando login...",
  adminUsers: null,
  adminLinks: null,
  adminInvitations: null,
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

function saveChangeToCloud(userId, stateToSave, change) {
  const actor = { uid: authState.user.uid, role: authState.role };
  if (change?.type === "profile-plan") return saveProfileAndPlan(userId, stateToSave, actor);
  if (change?.type === "settings") return saveSettings(userId, stateToSave.settings, actor);
  if (change?.type === "entry-upsert") return saveMeasurement(userId, change.entry, actor);
  if (change?.type === "entry-delete") return deleteMeasurement(userId, change.entryId);
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
    link: patient.link || null
  };
  state = normalizeState((await loadCloudState(authState.activePatient.uid)) || {});
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
  container.innerHTML = patient ? `
    <div>
      <span>Acompanhando</span>
      <strong>${escapeHtml(patient.name)}</strong>
      <small>${escapeHtml(patient.email)}</small>
    </div>
    <button class="button" id="close-patient" type="button">Encerrar visualização</button>
  ` : "";
  document.getElementById("close-patient")?.addEventListener("click", closePatient);
}

function renderSidebarUser() {
  const container = document.getElementById("sidebar-user");
  const name = personalState.profile?.name || authState.user?.displayName || authState.user?.email || "Usuário";
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
    leavePatientContext
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

window.addEventListener("hashchange", render);
registerServiceWorker();

observeAuth(async (user) => {
  authState.user = user;
  if (!user) {
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

    const userDoc = await ensureUserDocument(user);
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
    authState.patients = null;
    authState.sentInvitations = null;
    authState.invitations = null;
    authState.professionals = null;
    authState.activePatient = null;

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
    if (!authState.needsName && user.displayName !== personalState.profile.name) {
      await updateCurrentUserName(personalState.profile.name);
      await updateOwnDirectoryName(user.uid, personalState.profile.name);
    }
    await saveCloudState(user.uid, personalState, { uid: user.uid, role: authState.role });
    isApplyingCloudState = false;

    if (!location.hash) {
      location.hash = authState.needsName
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
