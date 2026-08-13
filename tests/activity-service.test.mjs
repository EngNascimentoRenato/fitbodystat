import test from "node:test";
import assert from "node:assert/strict";
import {
  monthLabel,
  recentWeekTotals,
  weeklyActivitySummary
} from "../public/js/services/activity-service.js";

test("formata o mês sem capitalizar a preposição", () => {
  assert.equal(monthLabel("2026-07"), "Julho de 2026");
});

test("mantém a meta de dias independente da meta de minutos", () => {
  const activities = [
    {
      id: "2026-07-20",
      date: "2026-07-20",
      completed: true,
      durationMinutes: 45
    },
    {
      id: "2026-07-22",
      date: "2026-07-22",
      completed: true,
      durationMinutes: null
    }
  ];
  const summary = weeklyActivitySummary(activities, 4, "2026-07-23");

  assert.equal(summary.completedDays, 2);
  assert.equal(summary.goalDays, 4);
  assert.equal(summary.progress, 50);
  assert.equal(summary.totalMinutes, 45);
});

test("soma minutos recentes sem exigir duração em todos os registros", () => {
  const activities = [
    { date: "2026-07-20", completed: true, durationMinutes: 30 },
    { date: "2026-07-21", completed: true, durationMinutes: null }
  ];
  const currentWeek = recentWeekTotals(activities, 1, "2026-07-23")[0];

  assert.equal(currentWeek.count, 2);
  assert.equal(currentWeek.minutes, 30);
});
