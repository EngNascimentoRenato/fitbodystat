import test from "node:test";
import assert from "node:assert/strict";

import { normalizeProfessionalLocations } from "../public/js/models/professional-profile-model.js";

test("normaliza locais profissionais com dados opcionais", () => {
  const locations = normalizeProfessionalLocations([{
    id: "clinic-1",
    name: "  Clínica Centro ",
    address: " Rua Principal, 10 ",
    contact: " (65) 3000-0000 "
  }]);

  assert.deepEqual(locations, [{
    id: "clinic-1",
    name: "Clínica Centro",
    address: "Rua Principal, 10",
    contact: "(65) 3000-0000"
  }]);
});

test("recusa local sem nome e nomes duplicados", () => {
  assert.throws(() => normalizeProfessionalLocations([
    { address: "Rua sem nome" }
  ]), /nome válido/);
  assert.throws(() => normalizeProfessionalLocations([
    { name: "Consultório" },
    { name: "consultório" }
  ]), /mesmo nome/);
});
