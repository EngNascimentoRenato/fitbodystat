import { loadState, saveState } from "./data/local-store.js";
import { registerServiceWorker } from "./services/pwa-service.js";
import { renderRoute } from "./router.js";

let state = loadState();

function applyTheme() {
  document.documentElement.dataset.theme = state.settings?.theme || "light";
}

function persist() {
  saveState(state);
  applyTheme();
}

function replaceState(nextState) {
  state = nextState;
}

function render() {
  applyTheme();
  renderRoute({ state, persist, render, replaceState });
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
