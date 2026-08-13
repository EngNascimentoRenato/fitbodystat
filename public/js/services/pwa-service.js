let registrationPromise = null;
let updateListenersBound = false;
let installListenersBound = false;
let deferredInstallPrompt = null;

const INSTALL_DISMISSED_UNTIL_KEY = "fitbodystat-install-dismissed-until";

function isStandalone() {
  return window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
}

function isIosDevice() {
  return /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function emitInstallStateChange() {
  window.dispatchEvent(new CustomEvent("pwa-install-statechange"));
}

export function getPwaInstallState() {
  const installed = isStandalone();
  const manualIos = !installed && isIosDevice();
  const promptAvailable = !installed && Boolean(deferredInstallPrompt);
  return {
    installed,
    manualIos,
    promptAvailable,
    available: promptAvailable || manualIos
  };
}

export function shouldShowInstallSuggestion() {
  const dismissedUntil = Number(localStorage.getItem(INSTALL_DISMISSED_UNTIL_KEY)) || 0;
  return getPwaInstallState().available && Date.now() >= dismissedUntil;
}

export function dismissInstallSuggestion(days = 7) {
  const until = Date.now() + days * 24 * 60 * 60 * 1000;
  localStorage.setItem(INSTALL_DISMISSED_UNTIL_KEY, String(until));
  emitInstallStateChange();
}

export async function requestPwaInstall() {
  const state = getPwaInstallState();
  if (state.installed) return { outcome: "installed" };
  if (!deferredInstallPrompt) {
    return { outcome: state.manualIos ? "manual-ios" : "unavailable" };
  }

  const promptEvent = deferredInstallPrompt;
  deferredInstallPrompt = null;
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  if (choice?.outcome !== "accepted") dismissInstallSuggestion();
  emitInstallStateChange();
  return { outcome: choice?.outcome || "dismissed" };
}

export function initializePwaInstall() {
  if (installListenersBound) return;
  installListenersBound = true;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    emitInstallStateChange();
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    localStorage.removeItem(INSTALL_DISMISSED_UNTIL_KEY);
    emitInstallStateChange();
  });
  window.matchMedia?.("(display-mode: standalone)")
    .addEventListener?.("change", emitInstallStateChange);
}

export function getAppVersionInfo() {
  return globalThis.FITBODYSTAT_VERSION || {
    version: "Não identificada",
    build: "-",
    releasedAt: ""
  };
}

export function getPwaRuntimeInfo() {
  const standalone = isStandalone();
  return {
    executionMode: standalone ? "PWA instalado" : "Navegador",
    updateSupport: "serviceWorker" in navigator,
    online: navigator.onLine
  };
}

export async function checkForAppUpdate() {
  if (!registrationPromise) return null;
  try {
    const registration = await registrationPromise;
    await registration.update();
    return registration;
  } catch {
    return null;
  }
}

function bindUpdateChecks() {
  if (updateListenersBound) return;
  updateListenersBound = true;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForAppUpdate();
  });
  window.addEventListener("online", checkForAppUpdate);
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  registrationPromise = navigator.serviceWorker.register("./service-worker.js", {
    updateViaCache: "none"
  });
  registrationPromise
    .then((registration) => {
      bindUpdateChecks();
      return registration.update();
    })
    .catch(() => {});
}
