import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [service, app, menu, dashboard, router] = await Promise.all([
  readFile(new URL("../public/js/services/pwa-service.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/menu.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/views/dashboard-view.js", import.meta.url), "utf8"),
  readFile(new URL("../public/js/router.js", import.meta.url), "utf8")
]);

test("captura a instalacao antes do service worker e reage ao resultado", () => {
  assert.match(app, /initializePwaInstall\(\)/);
  assert.match(service, /beforeinstallprompt/);
  assert.match(service, /event\.preventDefault\(\)/);
  assert.match(service, /appinstalled/);
  assert.match(service, /deferredInstallPrompt = null/);
});

test("distingue instalacao nativa, iPhone e aplicativo ja instalado", () => {
  assert.match(service, /display-mode: standalone/);
  assert.match(service, /manualIos/);
  assert.match(service, /promptAvailable/);
  assert.match(router, /Instalar no iPhone/);
  assert.match(router, /Adicionar a Tela de Inicio/);
});

test("oferece instalacao no menu e como acao secundaria do primeiro dashboard", () => {
  assert.match(menu, /id="sidebar-install-app"/);
  assert.match(dashboard, /id="dashboard-install-app"/);
  assert.match(dashboard, /id="dismiss-install-suggestion"/);
  assert.match(router, /shouldShowInstallSuggestion\(\)/);
});

test("recusa temporaria nao remove a instalacao do menu", () => {
  assert.match(service, /fitbodystat-install-dismissed-until/);
  assert.match(service, /days = 7/);
  assert.match(router, /getPwaInstallState\(\)\.available/);
});
