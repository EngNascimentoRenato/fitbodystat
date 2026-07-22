import { loadState, saveState } from "./data/local-store.js";
import { ensureUserDocument, loadCloudState, saveCloudState } from "./data/firestore-store.js";
import { observeAuth } from "./services/auth-service.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";

let state = loadState();
let authState = {
  user: null,
  role: "user",
  syncStatus: "Dados locais salvos neste navegador.",
  adminUsers: null,
  patients: null
};
let isApplyingCloudState = false;

function applyTheme() {
  document.documentElement.dataset.theme = state.settings?.theme || "light";
}

function persist() {
  saveState(state);
  applyTheme();

  if (authState.user && !isApplyingCloudState) {
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
render();

observeAuth(async (user) => {
  authState.user = user;

  if (!user) {
    authState.role = "user";
    authState.syncStatus = "Dados locais salvos neste navegador.";
    authState.adminUsers = null;
    authState.patients = null;
    render();
    return;
  }

  try {
    authState.syncStatus = "Carregando dados da nuvem...";
    render();

    const userDoc = await ensureUserDocument(user);
    authState.role = userDoc.role || "user";
    authState.adminUsers = null;
    authState.patients = null;
    const cloudState = await loadCloudState(user.uid);

    if (cloudState?.profile) {
      isApplyingCloudState = true;
      state = {
        ...state,
        profile: cloudState.profile,
        entries: cloudState.entries || [],
        goalPlan: cloudState.goalPlan || [],
        settings: { ...state.settings, ...(cloudState.settings || {}) }
      };
      saveState(state);
      isApplyingCloudState = false;
      authState.syncStatus = "Dados carregados do Firestore.";
    } else {
      await saveCloudState(user.uid, state);
      authState.syncStatus = "Dados locais enviados para o Firestore.";
    }
  } catch (error) {
    isApplyingCloudState = false;
    authState.syncStatus = `Falha no Firebase: ${error.message}`;
  }

  render();
});
