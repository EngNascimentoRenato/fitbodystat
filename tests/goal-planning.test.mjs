import test from "node:test";
import assert from "node:assert/strict";

import {
  getSuggestedGoalWeight,
  resolveGoalTiming
} from "../js/services/progress-service.js";
import { createDefaultMonthlyPlan } from "../js/data/seed-plan.js";
import { toNumber } from "../js/utils/number-utils.js";
import { heightInMetersSuggestion } from "../js/utils/validation-utils.js";

test("aceita vírgula decimal e reconhece altura informada em metros", () => {
  assert.equal(toNumber("89,8"), 89.8);
  assert.equal(heightInMetersSuggestion("1,76"), 176);
  assert.equal(heightInMetersSuggestion("176"), null);
});

test("sugere o limite superior do IMC normal para emagrecimento", () => {
  const weight = getSuggestedGoalWeight({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    targetBmi: 24.9
  });
  assert.equal(weight, 67.8);
});

test("não impõe sugestão de emagrecimento dentro da faixa normal", () => {
  const weight = getSuggestedGoalWeight({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 65,
    targetBmi: 24.9
  });
  assert.equal(weight, null);
});

test("prazo automático mantém o ritmo semanal", () => {
  const profile = resolveGoalTiming({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 66.5,
    weeklyChangeGoalKg: 0.5,
    goalDeadlineMode: "auto"
  });
  assert.equal(profile.weeklyChangeGoalKg, 0.5);
  assert.equal(profile.goalDeadlineMonths, 10.8);
});

test("prazo personalizado recalcula o ritmo semanal", () => {
  const profile = resolveGoalTiming({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 66.5,
    weeklyChangeGoalKg: 0.5,
    goalDeadlineMonths: 10,
    goalDeadlineMode: "custom"
  });
  assert.equal(profile.goalDeadlineMonths, 10);
  assert.equal(profile.weeklyChangeGoalKg, 0.54);
});

test("manutenção elimina prazo e ritmo de mudança", () => {
  const profile = resolveGoalTiming({
    goalType: "maintenance",
    heightCm: 165,
    startWeightKg: 70,
    goalWeightKg: 70,
    weeklyChangeGoalKg: 0.5,
    goalDeadlineMonths: 12,
    goalDeadlineMode: "auto"
  });
  assert.equal(profile.goalWeightKg, 70);
  assert.equal(profile.weeklyChangeGoalKg, 0);
  assert.equal(profile.goalDeadlineMonths, 0);
});

test("planejamento mensal mantém doze meses e expande quando necessário", () => {
  const profile = resolveGoalTiming({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    goalWeightKg: 70,
    weeklyChangeGoalKg: 0.2,
    goalDeadlineMode: "auto"
  });
  const plan = createDefaultMonthlyPlan(profile);
  assert.ok(plan.length > 13);
  assert.equal(plan[0].weightKg, 89.8);
  assert.equal(plan.at(-1).weightKg, 70);
});
