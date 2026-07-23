import { createBlankState, loadState, normalizeState, saveState } from "./data/local-store.js";
import {
  ensureUserDocument,
  deleteMeasurement,
  getUser,
  loadCloudState,
  saveCloudState,
  saveMeasurement,
  saveProfileAndPlan,
  saveSettings,
  updateOwnDirectoryName
} from "./data/firestore-store.js";
import { observeAuth } from "./services/auth-service.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";
import { escapeHtml } from "./utils/html-utils.js";

let state = createBlankState();
let personalState = state;
let authState = {
  user: null,
  role: "user",
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

  const targetUserId = authState.activePatient.uid;
  const stateToSave = state;
  applyTheme();

  if (!isApplyingCloudState) {
    saveChangeToCloud(targetUserId, stateToSave, change)
      .then(() => {
        authState.syncStatus = "Sincronizado com Firestore.";
      })
      .catch((error) => {
        authState.syncStatus = `Falha ao sincronizar: ${error.message}`;
      });
  }
}

function persistPersonal(change) {
  if (!authState.user) return;
  saveState(personalState, authState.user.uid);
  updateOwnDirectoryName(authState.user.uid, personalState.profile?.name).catch(() => {});
  applyTheme();

  if (!isApplyingCloudState) {
    saveChangeToCloud(authState.user.uid, personalState, change).then(() => {
      authState.syncStatus = "Sincronizado com Firestore.";
    }).catch((error) => {
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
  if (!authState.user || !["professional", "admin"].includes(authState.role)) return;
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
  const cloudState = await loadCloudState(authState.activePatient.uid);
  state = normalizeState(cloudState || {});
  authState.syncStatus = "Dados do paciente carregados.";
  location.hash = "#/dashboard";
  render();
}

function closePatient() {
  authState.activePatient = null;
  state = personalState;
  authState.syncStatus = "Você voltou aos seus próprios dados.";
  location.hash = authState.role === "admin" ? "#/admin" : "#/pacientes";
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

function render() {
  applyTheme();
  renderPatientContext();
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
    closePatient
  });
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
    location.replace("login.html");
    return;
  }

  try {
    authReady = true;
    authState.syncStatus = "Carregando dados da nuvem...";
    render();

    const userDoc = await ensureUserDocument(user);
    authState.role = userDoc.role || "user";
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
      await saveCloudState(user.uid, state, { uid: user.uid, role: authState.role });
      authState.syncStatus = "Conta nova pronta. Preencha seu perfil.";
    }
    isApplyingCloudState = false;
  } catch (error) {
    isApplyingCloudState = false;
    authState.syncStatus = `Falha no Firebase: ${error.message}`;
  }

  render();
});

if (!authReady) {
  render();
}
