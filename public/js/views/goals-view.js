import { normalizeMonthlyPlan } from "../data/seed-plan.js";
import {
  getGoalDeadlineMonths,
  getGoalDirection,
  getGoalJourney,
  getGoalWeight,
  getLatestEntry,
  getMaintenanceStatus,
  getProgressMode,
  getWeeklyChangeGoal
} from "../services/progress-service.js";
import { milestoneList } from "../components/milestone-list.js";
import { milestoneEmptyState, milestoneTimeline } from "../components/milestone-timeline.js";
import { formatCm, formatDecimal, formatKg } from "../utils/number-utils.js";
import { escapeHtml } from "../utils/html-utils.js";
import { calculateBmi, classifyBmi } from "../services/bmi-service.js";
import { formatDate, todayISO } from "../utils/date-utils.js";
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

function goalWasReached(profile, latest) {
  const current = Number(latest?.weightKg);
  const goal = Number(getGoalWeight(profile));
  if (!Number.isFinite(current) || !Number.isFinite(goal)) return false;
  const mode = getProgressMode(profile);
  if (mode === "maintain") return getMaintenanceStatus(profile, latest)?.reached === true;
  return mode === "loss" ? current <= goal : current >= goal;
}

export function renderGoals(state, routePrefix = "") {
  const latest = getLatestEntry(state.profile, state.entries);
  const journey = getGoalJourney(state.profile, latest);
  const monthlyPlan = normalizeMonthlyPlan(state.profile, state.goalPlan);
  const finalPlanRow = monthlyPlan.find((item) => item.isFinal) || monthlyPlan.at(-1);
  const progressMode = getProgressMode(state.profile);
  const deadline = progressMode === "maintain" ? null : getGoalDeadlineMonths(state.profile);
  const goalWeight = getGoalWeight(state.profile);
  const maintenance = getMaintenanceStatus(state.profile, latest);
  const finalBmi = calculateBmi(goalWeight, state.profile.heightCm);
  const totalChange = goalWeight !== null && state.profile.startWeightKg !== null
    ? Math.abs(goalWeight - state.profile.startWeightKg)
    : null;
  const weeklyLabel = progressMode === "loss" ? "Perda semanal" : "Ganho semanal";
  const deadlineDate = deadline ? finalPlanRow?.date : null;
  const weeklyActivityMinutes = (Number(state.profile.weeklyActivityGoalDays) || 0)
    * (Number(state.profile.averageActivityDurationMinutes) || 0);
  const overdue = progressMode !== "maintain"
    && finalPlanRow?.date
    && todayISO() > finalPlanRow.date
    && !goalWasReached(state.profile, latest);
  const currentActualRow = overdue && latest ? {
    label: formatDate(todayISO()),
    weightKg: Number(latest.weightKg),
    lossKg: Number((Number(state.profile.startWeightKg) - Number(latest.weightKg)).toFixed(1)),
    bmi: calculateBmi(latest.weightKg, state.profile.heightCm),
    waistCm: latest.waistCm,
    status: classifyBmi(calculateBmi(latest.weightKg, state.profile.heightCm)),
    sourceDate: latest.date,
    isActual: true
  } : null;
  return `
    <div class="view-stack">
      <section class="grid two">
        <article class="card">
          <h2>Ritmo sustentável</h2>
          <dl class="goal-summary-list">
            <div><dt>Início do acompanhamento</dt><dd>${formatDate(state.profile.startDate)}</dd></div>
            <div><dt>Peso inicial</dt><dd>${formatKg(state.profile.startWeightKg)}</dd></div>
            <div><dt>Objetivo</dt><dd>${escapeHtml(goalLabel(state.profile))}</dd></div>
            <div><dt>${progressMode === "maintain" ? "Faixa de manutenção" : "Peso final desejado"}</dt><dd>${progressMode === "maintain" && maintenance
              ? `${formatKg(maintenance.minimum)} a ${formatKg(maintenance.maximum)}`
              : formatKg(goalWeight)}</dd></div>
            <div><dt>IMC final estimado</dt><dd>${formatDecimal(finalBmi, 1)}</dd></div>
            ${progressMode === "maintain"
              ? `<div><dt>Situação atual</dt><dd>${maintenance?.reached ? "Dentro da faixa" : "Fora da faixa"}</dd></div>`
              : `
                <div><dt>Mudança total planejada</dt><dd>${formatKg(totalChange)}</dd></div>
                <div><dt>${weeklyLabel}</dt><dd>${formatKg(getWeeklyChangeGoal(state.profile))}</dd></div>
                <div><dt>Prazo estimado</dt><dd>${deadline ? `${formatDecimal(deadline, 1)} meses` : "-"}</dd></div>
                <div><dt>Data prevista</dt><dd>${formatDate(deadlineDate)}</dd></div>
              `}
            <div><dt>Atividades</dt><dd>${state.profile.weeklyActivityGoalDays || 3} dias${weeklyActivityMinutes
              ? ` · ${formatActivityMinutes(weeklyActivityMinutes)} por semana`
              : ""}</dd></div>
          </dl>
        </article>
        <article class="card">
          <h2>Marcos importantes</h2>
          ${journey.totalCount || journey.complementary.length
            ? milestoneTimeline(journey)
            : milestoneEmptyState()}
          ${journey.complementary.length
            ? `<h3 class="section-subtitle">Marcos complementares</h3>${milestoneList(journey.complementary)}`
            : ""}
        </article>
      </section>

      <section class="card goals-plan-card">
        <h2>Planejamento mensal</h2>
        ${overdue ? `<div class="planning-overdue-notice"><div><strong>Prazo planejado ultrapassado</strong><p>O projeto continua ativo e seus registros permanecem disponíveis. Revise o planejamento para definir uma nova trajetória.</p></div><a class="button primary" href="#${routePrefix}/perfil">Revisar planejamento</a></div>` : ""}
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prazo</th>
                <th class="number">Meta peso</th>
                <th class="number plan-difference"><span class="wide-label">Diferença acumulada</span><span class="compact-label">Dif. acum.</span></th>
                <th class="number">IMC</th>
                <th class="number">Cintura</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              ${[...monthlyPlan, ...(currentActualRow ? [currentActualRow] : [])].map((item) => `
                <tr class="${item.isFinal ? "plan-final-row" : ""} ${item.isActual ? "plan-actual-row" : ""}">
                  <td><span class="plan-date">${escapeHtml(item.label)}</span>${item.isActual || item.isCurrent ? `<span class="badge plan-today">Hoje</span>` : ""}${item.isFinal ? `<span class="badge plan-final">${overdue ? "Prazo original" : "Meta final"}</span>` : ""}${item.isActual && item.sourceDate ? `<small class="table-secondary">Último registro em ${escapeHtml(formatDate(item.sourceDate))}</small>` : ""}</td>
                  <td class="number">${formatKg(item.weightKg)}</td>
                  <td class="number plan-difference">${formatKg(item.lossKg)}</td>
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
