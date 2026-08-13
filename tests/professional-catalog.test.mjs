import assert from "node:assert/strict";
import test from "node:test";

import {
  careAreaForProfession,
  professionalCatalog,
  professionalTypeLabel
} from "../public/js/data/professional-catalog.js";

test("catálogo público mantém somente as quatro profissões previstas", () => {
  assert.deepEqual(
    professionalCatalog.map((item) => item.value),
    ["personal-trainer", "physical-educator", "nutritionist", "nutrologist"]
  );
});

test("personal e educador físico compartilham a área de treinamento", () => {
  assert.equal(careAreaForProfession("personal-trainer"), "physical-training");
  assert.equal(careAreaForProfession("physical-educator"), "physical-training");
});

test("nutricionista e nutrólogo compartilham a área de nutrição", () => {
  assert.equal(careAreaForProfession("nutritionist"), "nutrition");
  assert.equal(careAreaForProfession("nutrologist"), "nutrition");
  assert.equal(professionalTypeLabel("nutrologist"), "Nutrólogo(a)");
});
