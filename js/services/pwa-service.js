let registrationPromise = null;
let updateListenersBound = false;

export function getAppVersionInfo() {
  return globalThis.FITBODYSTAT_VERSION || {
    version: "Não identificada",
    build: "-",
    releasedAt: ""
  };
}

export function getPwaRuntimeInfo() {
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches
    || window.navigator.standalone === true;
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
