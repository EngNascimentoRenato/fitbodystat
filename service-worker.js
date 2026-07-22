const CACHE_NAME = "fitbodystat-v4";
const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./assets/icons/icon.svg",
  "./css/theme.css",
  "./css/base.css",
  "./css/layout.css",
  "./css/components.css",
  "./css/forms.css",
  "./css/charts.css",
  "./css/dashboard.css",
  "./js/app.js",
  "./js/router.js",
  "./js/menu.js",
  "./js/config/firebase-config.example.js",
  "./js/config/firebase-config.js",
  "./js/data/local-store.js",
  "./js/data/firestore-store.js",
  "./js/data/seed-plan.js",
  "./js/models/profile-model.js",
  "./js/models/entry-model.js",
  "./js/models/goal-model.js",
  "./js/services/bmi-service.js",
  "./js/services/body-fat-service.js",
  "./js/services/progress-service.js",
  "./js/services/export-service.js",
  "./js/services/pwa-service.js",
  "./js/services/firebase-core.js",
  "./js/services/auth-service.js",
  "./js/views/dashboard-view.js",
  "./js/views/profile-view.js",
  "./js/views/entry-view.js",
  "./js/views/history-view.js",
  "./js/views/goals-view.js",
  "./js/views/settings-view.js",
  "./js/views/account-view.js",
  "./js/components/stat-card.js",
  "./js/components/progress-ring.js",
  "./js/components/progress-bar.js",
  "./js/components/chart-card.js",
  "./js/components/entry-form.js",
  "./js/components/measurement-form.js",
  "./js/components/milestone-list.js",
  "./js/components/toast.js",
  "./js/components/modal.js",
  "./js/utils/date-utils.js",
  "./js/utils/number-utils.js",
  "./js/utils/validation-utils.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request).catch(() => caches.match("./index.html")))
  );
});
