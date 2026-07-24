importScripts("./js/config/app-version.js");

const CACHE_NAME = `fitbodystat-build-${self.FITBODYSTAT_VERSION.build}`;
const APP_SHELL = [
  "./",
  "./index.html",
  "./login.html",
  "./manifest.webmanifest",
  "./assets/icons/icon.svg",
  "./css/theme.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/forms.css",
  "./css/charts.css",
  "./css/dashboard.css",
  "./css/activities.css",
  "./css/agenda.css",
  "./js/app.js",
  "./js/login.js",
  "./js/router.js",
  "./js/menu.js",
  "./js/config/firebase-config.example.js",
  "./js/config/firebase-config.js",
  "./js/config/app-version.js",
  "./js/data/local-store.js",
  "./js/data/firestore-store.js",
  "./js/data/seed-plan.js",
  "./js/data/activity-catalog.js",
  "./js/models/profile-model.js",
  "./js/models/entry-model.js",
  "./js/models/goal-model.js",
  "./js/models/activity-model.js",
  "./js/models/agenda-model.js",
  "./js/models/professional-profile-model.js",
  "./js/services/bmi-service.js",
  "./js/services/body-fat-service.js",
  "./js/services/progress-service.js",
  "./js/services/export-service.js",
  "./js/services/pwa-service.js",
  "./js/services/firebase-core.js",
  "./js/services/auth-service.js",
  "./js/services/activity-service.js",
  "./js/services/agenda-service.js",
  "./js/services/role-service.js",
  "./js/views/dashboard-view.js",
  "./js/views/profile-view.js",
  "./js/views/entry-view.js",
  "./js/views/history-view.js",
  "./js/views/goals-view.js",
  "./js/views/settings-view.js",
  "./js/views/account-view.js",
  "./js/views/admin-view.js",
  "./js/views/patients-view.js",
  "./js/views/connections-view.js",
  "./js/views/activities-view.js",
  "./js/views/agenda-view.js",
  "./js/views/onboarding-view.js",
  "./js/views/methods-view.js",
  "./js/components/stat-card.js",
  "./js/components/progress-ring.js",
  "./js/components/progress-bar.js",
  "./js/components/chart-card.js",
  "./js/components/entry-form.js",
  "./js/components/measurement-form.js",
  "./js/components/milestone-list.js",
  "./js/components/toast.js",
  "./js/components/activity-picker.js",
  "./js/components/activity-summary.js",
  "./js/components/measurement-guide.js",
  "./js/components/modal.js",
  "./js/utils/date-utils.js",
  "./js/utils/number-utils.js",
  "./js/utils/phone-utils.js",
  "./js/utils/validation-utils.js",
  "./js/utils/html-utils.js"
];

async function cacheAppShell() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(APP_SHELL.map(async (path) => {
    const response = await fetch(path, { cache: "reload" });
    if (!response.ok) throw new Error(`Falha ao armazenar ${path}`);
    await cache.put(path, response);
  }));
}

self.addEventListener("install", (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys
        .filter((key) => key.startsWith("fitbodystat-") && key !== CACHE_NAME)
        .map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(async () => (
          await caches.match(event.request, { ignoreSearch: true })
          || await caches.match("./index.html")
        ))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(async (cached) => {
      if (cached) return cached;
      const response = await fetch(event.request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(event.request, response.clone());
      }
      return response;
    })
  );
});
