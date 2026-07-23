import { normalizeMonthlyPlan } from "../data/seed-plan.js";
import {
  getGoalDeadlineMonths,
  getGoalDirection,
  getGoalWeight,
  getLatestEntry,
  getMilestones,
  getWeeklyChangeGoal
} from "../services/progress-service.js";
import { milestoneList } from "../components/milestone-list.js";
import { formatCm, formatDecimal, formatKg } from "../utils/number-utils.js";
import { escapeHtml } from "../utils/html-utils.js";
import { calculateBmi } from "../services/bmi-service.js";
import { addMonths, formatDate, todayISO } from "../utils/date-utils.js";
import { formatActivityMinutes } from "../services/activity-service.js";

const goalTypeLabels = {
  "weight-loss": "Emagrecimento",
  "weight-gain": "Ganho de peso",
  "muscle-gain": "Ganho de massa muscular",
  maintenance: "Manutenção",
  recovery: "Recuperação de peso",
  other: "Outro"
};

function goalLabel(profile) {
  if (profile.goalType === "other" && profile.customGoalLabel) return profile.customGoalLabel;
  if (profile.goalType && goalTypeLabels[profile.goalType]) return goalTypeLabels[profile.goalType];
  const direction = getGoalDirection(profile);
  return direction === "loss" ? "Emagrecimento" : direction === "gain" ? "Ganho de peso" : "Manutenção";
}

export function renderGoals(state) {
  const latest = getLatestEntry(state.profile, state.entries);
  const monthlyPlan = normalizeMonthlyPlan(state.profile, state.goalPlan);
  const deadline = getGoalDeadlineMonths(state.profile);
  const goalWeight = getGoalWeight(state.profile);
  const finalBmi = calculateBmi(goalWeight, state.profile.heightCm);
  const totalChange = goalWeight !== null && state.profile.startWeightKg !== null
    ? Math.abs(goalWeight - state.profile.startWeightKg)
    : null;
  const direction = getGoalDirection(state.profile);
  const weeklyLabel = direction === "loss" ? "Perda semanal" : direction === "gain" ? "Ganho semanal" : "Variação semanal";
  const deadlineDate = deadline
    ? addMonths(state.profile.startDate || todayISO(), Math.round(deadline))
    : null;
  const weeklyActivityMinutes = (Number(state.profile.weeklyActivityGoalDays) || 0)
    * (Number(state.profile.averageActivityDurationMinutes) || 0);
  return `
    <div class="view-stack">
      <section class="grid two">
        <article class="card">
          <h2>Marcos importantes</h2>
          ${milestoneList(getMilestones(state.profile, latest))}
        </article>
        <article class="card">
          <h2>Ritmo sustentável</h2>
          <dl class="goal-summary-list">
            <div><dt>Objetivo</dt><dd>${escapeHtml(goalLabel(state.profile))}</dd></div>
            <div><dt>Peso final desejado</dt><dd>${formatKg(goalWeight)}</dd></div>
            <div><dt>IMC final estimado</dt><dd>${formatDecimal(finalBmi, 1)}</dd></div>
            <div><dt>Mudança total planejada</dt><dd>${formatKg(totalChange)}</dd></div>
            <div><dt>${weeklyLabel}</dt><dd>${formatKg(getWeeklyChangeGoal(state.profile))}</dd></div>
            <div><dt>Prazo estimado</dt><dd>${deadline ? `${formatDecimal(deadline, 1)} meses` : "-"}</dd></div>
            <div><dt>Data prevista</dt><dd>${formatDate(deadlineDate)}</dd></div>
            <div><dt>Atividades</dt><dd>${state.profile.weeklyActivityGoalDays || 3} dias${weeklyActivityMinutes
              ? ` · ${formatActivityMinutes(weeklyActivityMinutes)} por semana`
              : ""}</dd></div>
          </dl>
        </article>
      </section>

      <section class="card">
        <h2>Planejamento mensal</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prazo</th>
                <th class="number">Meta peso</th>
                <th class="number">Diferença acum.</th>
                <th class="number">IMC</th>
                <th class="number">Cintura</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyPlan.map((item) => `
                <tr>
                  <td>${escapeHtml(item.label)}</td>
                  <td class="number">${formatKg(item.weightKg)}</td>
                  <td class="number">${formatKg(item.lossKg)}</td>
                  <td class="number">${formatDecimal(item.bmi, 1)}</td>
                  <td class="number">${formatCm(item.waistCm)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}
