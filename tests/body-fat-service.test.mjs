import assert from "node:assert/strict";
import test from "node:test";

import {
  bodyFatMethodIsEstimated,
  bodyFatMethodLabel,
  normalizeBodyFatMethod
} from "../js/models/goal-model.js";
import {
  calculateBodyFatByNavy,
  calculateBodyFatBySkinfoldThreeSite,
  classifyBodyFat,
  resolveBodyFat,
  resolveProfileBodyFat
} from "../js/services/body-fat-service.js";

test("normaliza registros antigos do método por circunferências", () => {
  assert.equal(normalizeBodyFatMethod("navy"), "circumference");
  assert.equal(bodyFatMethodIsEstimated("navy"), true);
  assert.equal(bodyFatMethodLabel("navy"), "Estimativa por medidas corporais");
});

test("não aplica classificação masculina sem referência corporal", () => {
  assert.equal(classifyBodyFat("", 22), "Referência não informada");
});

test("prioriza percentual informado sobre a estimativa por medidas", () => {
  const profile = { sex: "male", heightCm: 175 };
  const entry = {
    waistCm: 92,
    neckCm: 39,
    bodyFatMethod: "bioimpedance",
    bodyFatManual: 18.4
  };

  assert.equal(resolveBodyFat(entry, profile), 18.4);
});

test("resolve a gordura inicial com o mesmo critério dos registros", () => {
  const profile = {
    sex: "female",
    heightCm: 165,
    startWaistCm: 78,
    startNeckCm: 34,
    startHipCm: 101,
    startBodyFatMethod: "dexa",
    startBodyFatManual: 27.2
  };

  assert.equal(resolveProfileBodyFat(profile), 27.2);
  assert.ok(calculateBodyFatByNavy({
    sex: profile.sex,
    heightCm: profile.heightCm,
    waistCm: profile.startWaistCm,
    neckCm: profile.startNeckCm,
    hipCm: profile.startHipCm
  }) > 0);
});

test("calcula Jackson-Pollock de três dobras e converte por Siri", () => {
  const male = calculateBodyFatBySkinfoldThreeSite({
    sex: "male",
    age: 39,
    chestMm: 15,
    abdomenMm: 25,
    thighMm: 20
  });
  const female = calculateBodyFatBySkinfoldThreeSite({
    sex: "female",
    age: 39,
    tricepsMm: 20,
    suprailiacMm: 25,
    thighMm: 30
  });

  assert.equal(male.bodyFatPercent, 19);
  assert.equal(male.sumMm, 60);
  assert.equal(female.bodyFatPercent, 29.4);
  assert.equal(female.conversion, "siri");
});

test("recusa dobras inválidas ou idade fora do protocolo", () => {
  assert.equal(calculateBodyFatBySkinfoldThreeSite({
    sex: "male",
    age: 17,
    chestMm: 15,
    abdomenMm: 25,
    thighMm: 20
  }), null);
});
