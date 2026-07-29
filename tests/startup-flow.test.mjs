import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("inicialização protege a interface até concluir a nuvem", async () => {
  const [html, source] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/app.js", import.meta.url), "utf8")
  ]);

  assert.match(html, /id="app-loading"/);
  assert.match(html, /data-app-loading="true"/);
  assert.match(source, /setAppLoading\(true, "Carregando seus dados\.\.\."\)/);
  assert.match(source, /setAppLoading\(false\)/);
});

test("leituras independentes e service worker não bloqueiam o primeiro desenho", async () => {
  const source = await readFile(new URL("../js/app.js", import.meta.url), "utf8");

  assert.match(source, /const cloudStatePromise = loadCloudState\(user\.uid\)/);
  assert.match(source, /Promise\.all\(\[/);
  assert.match(source, /requestIdleCallback/);
  assert.doesNotMatch(source, /window\.addEventListener\("hashchange", render\);\s*registerServiceWorker\(\)/);
});
