import test from "node:test";
import assert from "node:assert/strict";

import {
  getGoalJourney,
  getMilestones,
  getSuggestedGoalWeight,
  nextMilestone,
  nextMilestoneProgress,
  resolveGoalTiming
} from "../public/js/services/progress-service.js";
import { createDefaultMonthlyPlan, normalizeMonthlyPlan } from "../public/js/data/seed-plan.js";
import { addMonths } from "../public/js/utils/date-utils.js";
import { toNumber } from "../public/js/utils/number-utils.js";
import { heightInMetersSuggestion } from "../public/js/utils/validation-utils.js";
import { readFile } from "node:fs/promises";

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

test("respeita o IMC de referência personalizado na sugestão", () => {
  const weight = getSuggestedGoalWeight({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    targetBmi: 27
  });
  assert.equal(weight, 73.5);
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

test("planejamento usa datas mensais reais e move o marcador de hoje", () => {
  const profile = {
    goalType: "weight-loss",
    startDate: "2026-08-01",
    heightCm: 165,
    startWeightKg: 90,
    startWaistCm: 110,
    goalWeightKg: 80,
    weeklyChangeGoalKg: 0.5,
    goalDeadlineMode: "auto"
  };
  const original = createDefaultMonthlyPlan(profile);
  const plan = normalizeMonthlyPlan(profile, original, "2026-09-15");

  assert.equal(plan[0].label, "01/08/2026");
  assert.equal(plan[1].label, "01/09/2026");
  assert.equal(plan[0].isCurrent, false);
  assert.equal(plan[1].isCurrent, true);
  assert.equal(plan[1].weightKg, original[1].weightKg);
});

test("adição de meses respeita o último dia do mês", () => {
  assert.equal(addMonths("2026-01-31", 1), "2026-02-28");
  assert.equal(addMonths("2024-01-31", 1), "2024-02-29");
});

test("planejamento curto termina na data final sem repetir até doze meses", () => {
  const profile = {
    goalType: "weight-loss",
    startDate: "2026-08-01",
    heightCm: 165,
    startWeightKg: 90,
    startWaistCm: 110,
    goalWeightKg: 85,
    goalDeadlineMonths: 2.5,
    goalDeadlineMode: "custom",
    weeklyChangeGoalKg: 0.46
  };
  const plan = createDefaultMonthlyPlan(profile);

  assert.deepEqual(plan.map((item) => item.month), [0, 1, 2, 2.5]);
  assert.equal(plan.at(-1).isFinal, true);
  assert.equal(plan.at(-1).weightKg, 85);
});

test("manutenção continua exibindo doze meses", () => {
  const plan = createDefaultMonthlyPlan({
    goalType: "maintenance",
    startDate: "2026-08-01",
    heightCm: 165,
    startWeightKg: 70,
    goalWeightKg: 70
  });
  assert.equal(plan.length, 13);
  assert.equal(plan.at(-1).month, 12);
});

test("resumo calcula o progresso até o próximo marco", () => {
  const profile = {
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 74.8
  };
  const latest = { weightKg: 89 };
  const next = nextMilestone(profile, latest);
  const progress = nextMilestoneProgress(profile, latest);

  assert.equal(next.title, "Perda de 5% do peso");
  assert.equal(progress.value, 18);
  assert.ok(Math.abs(progress.completed - 0.8) < 0.001);
  assert.ok(Math.abs(progress.total - 4.49) < 0.001);
});

test("progresso do próximo marco permanece acumulado desde a linha de base", () => {
  const profile = {
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 74.8
  };
  const latest = { weightKg: 84.8 };
  const next = nextMilestone(profile, latest);
  const progress = nextMilestoneProgress(profile, latest);

  assert.equal(next.title, "Sair da obesidade");
  assert.equal(progress.value, 60);
  assert.ok(Math.abs(progress.completed - 5) < 0.001);
});

test("jornada separa progresso total do progresso da etapa", () => {
  const profile = {
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    goalWeightKg: 74.8,
    sex: "male"
  };
  const journey = getGoalJourney(profile, { weightKg: 84.8, waistCm: 108 });

  assert.equal(journey.totalProgress, 33);
  assert.equal(journey.stageProgress.value, 60);
  assert.equal(journey.completedCount, 1);
  assert.equal(journey.milestones.filter((item) => item.state === "current").length, 1);
  assert.equal(journey.next.id, "bmi-obesity-exit");
});

test("meta adicional concluída não reinicia o progresso do marco percentual seguinte", () => {
  const profile = {
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 74.8,
    milestoneConfig: {
      disabledSuggestedIds: [],
      customGoals: [{ id: "custom-weight", type: "weight", target: 1 }]
    }
  };
  const journey = getGoalJourney(profile, { weightKg: 88.7 });

  assert.equal(journey.milestones[0].id, "custom-weight");
  assert.equal(journey.milestones[0].state, "completed");
  assert.equal(journey.next.id, "weight-loss-5-percent");
  assert.equal(journey.stageProgress.value, 24);
  assert.ok(Math.abs(journey.stageProgress.completed - 1.1) < 0.001);
  assert.ok(Math.abs(journey.stageProgress.total - 4.49) < 0.001);
});

test("jornada mantém marcos complementares fora da sequência principal", () => {
  const journey = getGoalJourney({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    goalWeightKg: 74.8,
    sex: "male"
  }, { weightKg: 89, waistCm: 108 });

  assert.equal(journey.complementary.length, 1);
  assert.equal(journey.complementary[0].id, "waist-reference");
  assert.ok(journey.milestones.every((item) => item.mode !== "waist"));
});

test("progresso total chega a cem sem depender do marco complementar", () => {
  const journey = getGoalJourney({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    goalWeightKg: 74.8,
    sex: "male"
  }, { weightKg: 74.8, waistCm: 108 });

  assert.equal(journey.status, "completed");
  assert.equal(journey.totalProgress, 100);
  assert.equal(journey.stageProgress.value, 100);
  assert.equal(journey.next, null);
  assert.equal(journey.complementary[0].reached, false);
});

test("projeto pode retirar sugestões sem alterar a biblioteca global", () => {
  const profile = {
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    goalWeightKg: 74.8,
    sex: "male",
    milestoneConfig: { disabledSuggestedIds: ["weight-loss-5-percent", "waist-reference"], customGoals: [] }
  };
  const ids = getMilestones(profile, { weightKg: 88, waistCm: 110 }).map((item) => item.id);

  assert.equal(ids.includes("weight-loss-5-percent"), false);
  assert.equal(ids.includes("waist-reference"), false);
  assert.equal(ids.includes("weight-goal"), true);
});

test("meta final permanece ativa mesmo quando foi desabilitada na configuração", () => {
  const milestones = getMilestones({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 74.8,
    milestoneConfig: { disabledSuggestedIds: ["weight-goal"], customGoals: [] }
  }, { weightKg: 88 });

  assert.equal(milestones.some((item) => item.id === "weight-goal"), true);
});

test("projeto aceita metas adicionais de peso, IMC, gordura e cintura", () => {
  const milestones = getMilestones({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    startWaistCm: 112,
    startBodyFatManual: 32,
    goalWeightKg: 74.8,
    sex: "male",
    milestoneConfig: {
      disabledSuggestedIds: [],
      customGoals: [
        { id: "custom-weight", type: "weight", target: 7.8 },
        { id: "custom-bmi", type: "bmi", target: 29.5 },
        { id: "custom-body-fat", type: "body-fat", target: 25 },
        { id: "custom-waist", type: "waist", target: 100 }
      ]
    }
  }, { weightKg: 85, waistCm: 107, bodyFatManual: 29 });
  const ids = milestones.map((item) => item.id);

  assert.ok(ids.includes("custom-weight"));
  assert.ok(ids.includes("custom-bmi"));
  assert.ok(ids.includes("custom-body-fat"));
  assert.ok(ids.includes("custom-waist"));
  assert.equal(milestones.find((item) => item.id === "custom-weight").target, 82);
  assert.match(milestones.find((item) => item.id === "custom-weight").title, /Perda de 7,8 kg/);
  assert.equal(milestones.find((item) => item.id === "custom-body-fat").unit, "%");
});

test("meta adicional de peso fora do projeto não entra na jornada", () => {
  const milestones = getMilestones({
    goalType: "weight-loss",
    heightCm: 165,
    startWeightKg: 89.8,
    goalWeightKg: 80,
    milestoneConfig: {
      disabledSuggestedIds: [],
      customGoals: [{ id: "outside", type: "weight", target: 20 }]
    }
  }, { weightKg: 88 });

  assert.equal(milestones.some((item) => item.id === "outside"), false);
});

test("editor de projeto delega a validação ao aplicativo", async () => {
  const source = await readFile(new URL("../public/js/views/profile-view.js", import.meta.url), "utf8");
  assert.match(source, /id="profile-form"[^>]*novalidate/);
  assert.match(source, /data\.get\("sex"\) \|\| state\.profile\.sex/);
  assert.match(source, /data\.get\("startBodyFatMethod"\) \|\| state\.profile\.startBodyFatMethod/);
});

test("editor vincula a mudança de objetivo ao seletor, não à coleção de campos", async () => {
  const source = await readFile(new URL("../public/js/views/profile-view.js", import.meta.url), "utf8");
  assert.match(source, /querySelector\('select\[name="goalType"\]'\)/);
  assert.doesNotMatch(source, /form\.elements\.goalType\?\.addEventListener/);
});
