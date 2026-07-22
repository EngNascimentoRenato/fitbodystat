import { createBlankState, loadState, saveState } from "./data/local-store.js";
import { ensureUserDocument, loadCloudState, saveCloudState } from "./data/firestore-store.js";
import { observeAuth } from "./services/auth-service.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";

let state = createBlankState();
let authState = {
  user: null,
  role: "user",
  syncStatus: "Verificando login...",
  adminUsers: null,
  patients: null
};
let isApplyingCloudState = false;
let authReady = false;

function applyTheme() {
  document.documentElement.dataset.theme = state.settings?.theme || "light";
}

function persist() {
  if (!authState.user) return;

  saveState(state, authState.user.uid);
  applyTheme();

  if (!isApplyingCloudState) {
    saveCloudState(authState.user.uid, state)
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
}

function render() {
  applyTheme();
  renderRoute({ state, authState, persist, render, replaceState });
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
    authState.patients = null;
    const cloudState = await loadCloudState(user.uid);

    isApplyingCloudState = true;
    if (cloudState?.profile) {
      state = {
        ...createBlankState(),
        profile: cloudState.profile,
        entries: cloudState.entries || [],
        goalPlan: cloudState.goalPlan || [],
        settings: { ...createBlankState().settings, ...(cloudState.settings || {}) }
      };
      saveState(state, user.uid);
      authState.syncStatus = "Dados carregados do Firestore.";
    } else {
      state = loadState(user.uid);
      await saveCloudState(user.uid, state);
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
