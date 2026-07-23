import { showToast } from "../components/toast.js";
import { calculateBodyFatByNavy, classifyBodyFat } from "../services/body-fat-service.js";
import { calculateBmi, classifyBmi, getBmiTargets } from "../services/bmi-service.js";
import {
  calculateGoalDeadlineMonths,
  calculateWeeklyChangeForDeadline,
  getGoalDirection,
  getGoalWeight,
  getWeeklyChangeGoal
} from "../services/progress-service.js";
import { createDefaultMonthlyPlan, normalizeMonthlyPlan } from "../data/seed-plan.js";
import { formatCm, formatDecimal, formatKg, formatPercent, toNumber } from "../utils/number-utils.js";
import { escapeAttribute } from "../utils/html-utils.js";

function renderProfileInsight(profile) {
  const bmi = calculateBmi(profile.startWeightKg, profile.heightCm);
  const bmiTargets = getBmiTargets(profile.heightCm);
  const bodyFat = calculateBodyFatByNavy({
    sex: profile.sex,
    heightCm: profile.heightCm,
    waistCm: profile.startWaistCm,
    neckCm: profile.startNeckCm,
    hipCm: profile.startHipCm
  });
  const goalWeight = getGoalWeight(profile);
  const deadline = calculateGoalDeadlineMonths(profile);
  const direction = getGoalDirection(profile);
  const directionLabel = direction === "gain" ? "ganho" : direction === "loss" ? "perda" : "manutenção";

  return `
    <section class="card">
      <h2>Resumo calculado</h2>
      <div class="grid four">
        <article class="mini-stat">
          <span>IMC atual</span>
          <strong>${formatDecimal(bmi, 1)}</strong>
          <small>${classifyBmi(bmi)}</small>
        </article>
        <article class="mini-stat">
          <span>Gordura corporal</span>
          <strong>${formatPercent(bodyFat)}</strong>
          <small>${classifyBodyFat(profile.sex, bodyFat)}</small>
        </article>
        <article class="mini-stat">
          <span>Meta sugerida</span>
          <strong>${formatKg(goalWeight)}</strong>
          <small>IMC alvo ${formatDecimal(profile.targetBmi || 24.9, 1)}</small>
        </article>
        <article class="mini-stat">
          <span>Prazo sugerido</span>
          <strong>${deadline ? `${formatDecimal(deadline, 1)} meses` : "-"}</strong>
          <small>${directionLabel} de peso</small>
        </article>
      </div>
      <p class="muted">Referências por IMC: peso normal entre ${formatKg(bmiTargets.normalMinKg)} e ${formatKg(bmiTargets.normalMaxKg)}; saída da obesidade abaixo de ${formatKg(bmiTargets.obesityExitKg)}. Ajuste livremente para contextos como ganho de massa, alta massa muscular ou uma meta intermediária.</p>
    </section>
  `;
}

function renderPlanEditor(profile, goalPlan) {
  const rows = normalizeMonthlyPlan(profile, goalPlan);
  return `
    <section class="card">
      <div class="chart-header">
        <div>
          <h2>Planejamento mensal</h2>
          <p class="muted">A tabela exibe no mínimo 12 meses e se expande quando o prazo calculado ou escolhido for maior.</p>
        </div>
        <button class="button" id="reset-plan" type="button">Recalcular padrão</button>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Prazo</th>
              <th class="number">Peso</th>
              <th class="number">Cintura</th>
              <th>Classificação</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((item, index) => `
              <tr>
                <td>
                  <input type="hidden" name="planMonth${index}" value="${escapeAttribute(item.month)}" />
                  <input class="table-input" name="planLabel${index}" value="${escapeAttribute(item.label)}" aria-label="Prazo ${index + 1}" />
                </td>
                <td class="number">
                  <input class="table-input number" name="planWeight${index}" inputmode="decimal" value="${escapeAttribute(item.weightKg ?? "")}" aria-label="Peso ${escapeAttribute(item.label)}" />
                </td>
                <td class="number">
                  <input class="table-input number" name="planWaist${index}" inputmode="decimal" value="${escapeAttribute(item.waistCm ?? "")}" aria-label="Cintura ${escapeAttribute(item.label)}" />
                </td>
                <td>
                  <input class="table-input" name="planStatus${index}" value="${escapeAttribute(item.status)}" aria-label="Classificação ${escapeAttribute(item.label)}" />
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function readProfileForm(form, currentProfile) {
  const data = new FormData(form);
  const value = (name, fallback) => data.has(name) ? data.get(name) : fallback;
  const nextProfile = {
    ...currentProfile,
    name: data.get("name").trim(),
    sex: value("sex", currentProfile.sex),
    birthDate: data.get("birthDate"),
    heightCm: toNumber(value("heightCm", currentProfile.heightCm)),
    startDate: value("startDate", currentProfile.startDate),
    startWeightKg: toNumber(value("startWeightKg", currentProfile.startWeightKg)),
    startWaistCm: toNumber(value("startWaistCm", currentProfile.startWaistCm)),
    startNeckCm: toNumber(value("startNeckCm", currentProfile.startNeckCm)),
    startHipCm: toNumber(value("startHipCm", currentProfile.startHipCm)),
    targetBmi: toNumber(data.get("targetBmi")) || 24.9,
    goalWeightKg: toNumber(data.get("goalWeightKg")),
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths"))
  };

  if (nextProfile.goalDeadlineMonths) {
    nextProfile.weeklyChangeGoalKg = calculateWeeklyChangeForDeadline(nextProfile);
  } else {
    nextProfile.goalDeadlineMonths = calculateGoalDeadlineMonths(nextProfile);
  }

  nextProfile.weeklyLossGoalKg = nextProfile.weeklyChangeGoalKg;
  return nextProfile;
}

export function renderProfile(state) {
  const p = state.profile;
  const baselineLocked = p.baselineLocked === true || state.entries.length > 0;
  const baselineDisabled = baselineLocked ? "disabled" : "";
  const suggestedGoal = getGoalWeight(p);
  const suggestedDeadline = p.goalDeadlineMonths || calculateGoalDeadlineMonths(p);
  const weeklyChange = getWeeklyChangeGoal(p);

  return `
    <form class="form" id="profile-form">
      <section class="card">
        ${baselineLocked ? `
          <p class="form-notice">Os dados da linha de base estão bloqueados porque o acompanhamento já possui medições. Metas, prazo e demais dados do perfil continuam editáveis.</p>
        ` : `
          <p class="form-notice">Os dados iniciais poderão ser ajustados até o primeiro registro de acompanhamento.</p>
        `}
        <div class="form-grid">
          <div class="field">
            <label for="name">Nome completo</label>
            <input id="name" name="name" required minlength="2" autocomplete="name" value="${escapeAttribute(p.name || "")}" />
          </div>
          <div class="field">
            <label for="sex">Sexo</label>
            <select id="sex" name="sex" required ${baselineDisabled}>
              <option value="" ${!p.sex ? "selected" : ""}>Selecione</option>
              <option value="male" ${p.sex === "male" ? "selected" : ""}>Masculino</option>
              <option value="female" ${p.sex === "female" ? "selected" : ""}>Feminino</option>
            </select>
          </div>
          <div class="field">
            <label for="birthDate">Data de nascimento</label>
            <input id="birthDate" name="birthDate" type="date" value="${escapeAttribute(p.birthDate || "")}" />
          </div>
          <div class="field">
            <label for="heightCm">Altura (cm)</label>
            <input id="heightCm" name="heightCm" inputmode="decimal" required ${baselineDisabled} value="${escapeAttribute(p.heightCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startDate">Data inicial</label>
            <input id="startDate" name="startDate" type="date" required ${baselineDisabled} value="${escapeAttribute(p.startDate || "")}" />
          </div>
          <div class="field">
            <label for="startWeightKg">Peso inicial (kg)</label>
            <input id="startWeightKg" name="startWeightKg" inputmode="decimal" required ${baselineDisabled} value="${escapeAttribute(p.startWeightKg ?? "")}" />
          </div>
          <div class="field">
            <label for="startWaistCm">Cintura inicial (cm)</label>
            <input id="startWaistCm" name="startWaistCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startWaistCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startNeckCm">Pescoço inicial (cm)</label>
            <input id="startNeckCm" name="startNeckCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startNeckCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startHipCm">Quadril inicial (cm)</label>
            <input id="startHipCm" name="startHipCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startHipCm ?? "")}" />
            <span class="help-text">Necessário para cálculo feminino pelo método da Marinha e opcional para acompanhamento geral.</span>
          </div>
          <div class="field">
            <label for="targetBmi">IMC alvo para sugestão</label>
            <input id="targetBmi" name="targetBmi" inputmode="decimal" value="${escapeAttribute(p.targetBmi ?? 24.9)}" />
          </div>
          <div class="field">
            <label for="goalWeightKg">Meta de peso (kg)</label>
            <input id="goalWeightKg" name="goalWeightKg" inputmode="decimal" value="${escapeAttribute(p.goalWeightKg ?? suggestedGoal ?? "")}" />
            <span class="help-text">Sugerida pelo IMC alvo, mas livre para ajuste.</span>
          </div>
          <div class="field">
            <label for="weeklyChangeGoalKg">Mudança semanal desejada (kg)</label>
            <input id="weeklyChangeGoalKg" name="weeklyChangeGoalKg" inputmode="decimal" value="${escapeAttribute(weeklyChange)}" />
          </div>
          <div class="field">
            <label for="goalDeadlineMonths">Prazo da meta (meses)</label>
            <input id="goalDeadlineMonths" name="goalDeadlineMonths" inputmode="decimal" value="${escapeAttribute(suggestedDeadline ?? "")}" />
            <span class="help-text">Se alterado, o app recalcula a mudança semanal necessária.</span>
          </div>
        </div>
      </section>
      ${renderProfileInsight({ ...p, goalWeightKg: p.goalWeightKg ?? suggestedGoal, goalDeadlineMonths: suggestedDeadline })}
      ${renderPlanEditor(p, state.goalPlan)}
      <div class="button-row">
        <button class="button primary" type="submit">Salvar perfil</button>
      </div>
    </form>
  `;
}

export function bindProfile(state, persist, render) {
  document.getElementById("reset-plan").addEventListener("click", () => {
    const form = document.getElementById("profile-form");
    state.profile = readProfileForm(form, state.profile);
    state.goalPlan = createDefaultMonthlyPlan(state.profile);
    persist({ type: "profile-plan" });
    showToast("Planejamento padrão recalculado.");
    render();
  });

  document.getElementById("profile-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    state.profile = readProfileForm(event.currentTarget, state.profile);
    state.goalPlan = normalizeMonthlyPlan(state.profile, state.goalPlan).map((item, index) => ({
      label: data.get(`planLabel${index}`)?.trim() || item.label,
      month: toNumber(data.get(`planMonth${index}`)) ?? item.month,
      weightKg: toNumber(data.get(`planWeight${index}`)) ?? item.weightKg,
      waistCm: toNumber(data.get(`planWaist${index}`)) ?? item.waistCm,
      status: data.get(`planStatus${index}`)?.trim() || item.status
    }));
    persist({ type: "profile-plan" });
    showToast("Perfil salvo.");
    render();
  });
}
