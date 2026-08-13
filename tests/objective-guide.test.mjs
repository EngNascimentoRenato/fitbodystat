import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import { objectiveHelpButton } from "../public/js/components/objective-guide.js";

const profileSource = await readFile(
  new URL("../public/js/views/profile-view.js", import.meta.url),
  "utf8"
);
const onboardingSource = await readFile(
  new URL("../public/js/views/onboarding-view.js", import.meta.url),
  "utf8"
);
const firebaseConfig = JSON.parse(await readFile(
  new URL("../firebase.json", import.meta.url),
  "utf8"
));

test("ajuda de objetivo está presente nos seletores aplicáveis", () => {
  assert.match(objectiveHelpButton(), /data-objective-help/);
  assert.equal((profileSource.match(/objectiveHelpButton\(\)/g) || []).length, 2);
  assert.equal((onboardingSource.match(/objectiveHelpButton\(\)/g) || []).length, 1);
});

test("documento interno não é publicado pelo Firebase Hosting", () => {
  assert.equal(firebaseConfig.hosting.public, "public");
  return assert.rejects(
    access(new URL("../public/BIBLIOTECA_METAS_OBJETIVOS.md", import.meta.url))
  );
});
