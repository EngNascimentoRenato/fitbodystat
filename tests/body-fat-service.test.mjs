import assert from "node:assert/strict";
import test from "node:test";

import {
  bodyFatMethodIsEstimated,
  bodyFatMethodLabel,
  normalizeBodyFatMethod
} from "../js/models/goal-model.js";
import {
  calculateBodyFatByNavy,
  resolveBodyFat,
  resolveProfileBodyFat
} from "../js/services/body-fat-service.js";

test("normaliza registros antigos do método por circunferências", () => {
  assert.equal(normalizeBodyFatMethod("navy"), "circumference");
  assert.equal(bodyFatMethodIsEstimated("navy"), true);
  assert.equal(bodyFatMethodLabel("navy"), "Estimativa por medidas corporais");
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
