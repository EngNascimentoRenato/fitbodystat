import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

await import("../js/config/app-version.js");
const { getAppVersionInfo } = await import("../js/services/pwa-service.js");

test("expõe versão, build e data centralizadas", () => {
  const version = getAppVersionInfo();
  assert.match(version.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/);
  assert.ok(Number.isInteger(version.build) && version.build > 0);
  assert.match(version.releasedAt, /^\d{4}-\d{2}-\d{2}$/);
});

test("service worker deriva o cache da build central", async () => {
  const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  assert.match(source, /fitbodystat-build-\$\{self\.FITBODYSTAT_VERSION\.build\}/);
  assert.match(source, /request\.mode === "navigate"/);
  assert.match(source, /requestUrl\.origin !== self\.location\.origin/);
  assert.match(source, /key\.startsWith\("fitbodystat-"\)/);
});

test("todos os recursos locais do app shell existem", async () => {
  const source = await readFile(new URL("../service-worker.js", import.meta.url), "utf8");
  const appShellSource = source.match(/const APP_SHELL = \[([\s\S]*?)\];/)?.[1] || "";
  const paths = [...appShellSource.matchAll(/"\.\/([^"]+)"/g)]
    .map((match) => match[1])
    .filter(Boolean);

  assert.ok(paths.includes("css/agenda.css"));
  assert.ok(paths.includes("js/views/agenda-view.js"));
  await Promise.all(paths.map((path) => access(new URL(`../${path}`, import.meta.url))));
});
