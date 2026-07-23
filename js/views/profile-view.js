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
import { preferredActivityPicker } from "../components/activity-picker.js";
import { formatPhone, normalizePhone, phoneIsValid } from "../utils/phone-utils.js";

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
    goalType: data.get("goalType") || "",
    customGoalLabel: data.get("customGoalLabel")?.trim() || "",
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
    weeklyActivityGoalDays: Math.min(7, Math.max(1, toNumber(data.get("weeklyActivityGoalDays")) || 3)),
    averageActivityDurationMinutes: toNumber(data.get("averageActivityDurationMinutes")),
    preferredActivities: data.getAll("preferredActivities")
  };

  if (nextProfile.goalDeadlineMonths) {
    nextProfile.weeklyChangeGoalKg = calculateWeeklyChangeForDeadline(nextProfile);
  } else {
    nextProfile.goalDeadlineMonths = calculateGoalDeadlineMonths(nextProfile);
  }

  nextProfile.weeklyLossGoalKg = nextProfile.weeklyChangeGoalKg;
  return nextProfile;
}

export function renderProfile(state, options = {}) {
  const p = state.profile;
  const canEditContact = options.canEditContact !== false;
  const baselineLocked = p.baselineLocked === true || state.entries.length > 0;
  const baselineDisabled = baselineLocked ? "disabled" : "";
  const suggestedGoal = getGoalWeight(p);
  const suggestedDeadline = p.goalDeadlineMonths || calculateGoalDeadlineMonths(p);
  const weeklyChange = getWeeklyChangeGoal(p);

  return `
    <form class="form profile-form" id="profile-form">
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
          ${canEditContact ? `
            <div class="field">
              <label for="phone">Telefone</label>
              <input id="phone" name="phone" type="tel" autocomplete="tel"
                placeholder="(65) 99999-9999" value="${escapeAttribute(formatPhone(state.contact?.phone || ""))}" />
              <span class="help-text">O compartilhamento com profissionais é escolhido separadamente em cada vínculo.</span>
            </div>
          ` : ""}
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
            <label for="goalType">Objetivo principal</label>
            <select id="goalType" name="goalType">
              <option value="" ${!p.goalType ? "selected" : ""}>Selecione</option>
              <option value="weight-loss" ${p.goalType === "weight-loss" ? "selected" : ""}>Emagrecimento</option>
              <option value="weight-gain" ${p.goalType === "weight-gain" ? "selected" : ""}>Ganho de peso</option>
              <option value="muscle-gain" ${p.goalType === "muscle-gain" ? "selected" : ""}>Ganho de massa muscular</option>
              <option value="maintenance" ${p.goalType === "maintenance" ? "selected" : ""}>Manutenção</option>
              <option value="recovery" ${p.goalType === "recovery" ? "selected" : ""}>Recuperação de peso</option>
              <option value="other" ${p.goalType === "other" ? "selected" : ""}>Outro</option>
            </select>
          </div>
          <div class="field">
            <label for="customGoalLabel">Descrição personalizada do objetivo</label>
            <input id="customGoalLabel" name="customGoalLabel" maxlength="80"
              value="${escapeAttribute(p.customGoalLabel || "")}" />
            <span class="help-text">Opcional. Usada quando o objetivo precisar de mais contexto.</span>
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
      <section class="card">
        <div class="chart-header">
          <div>
            <h2>Atividades físicas</h2>
            <p class="muted">Escolha as modalidades que pratica com frequência para agilizar o registro diário.</p>
          </div>
        </div>
        <div class="form-grid">
          <div class="field activity-goal-field">
            <label for="weeklyActivityGoalDays">Meta semanal de dias ativos</label>
            <input id="weeklyActivityGoalDays" name="weeklyActivityGoalDays" type="number" min="1" max="7"
              value="${escapeAttribute(p.weeklyActivityGoalDays ?? 3)}" />
          </div>
          <div class="field">
            <label for="averageActivityDurationMinutes">Duração média pretendida por dia (minutos)</label>
            <input id="averageActivityDurationMinutes" name="averageActivityDurationMinutes" type="number"
              min="1" max="1440" value="${escapeAttribute(p.averageActivityDurationMinutes ?? "")}" />
            <span class="help-text">Opcional. A meta semanal será calculada pelos dias ativos.</span>
          </div>
        </div>
        <div class="field">
          <label>Atividades preferidas</label>
          ${preferredActivityPicker(p.preferredActivities || [])}
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
    const phone = data.get("phone");
    if (phone !== null && !phoneIsValid(phone)) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }
    state.profile = readProfileForm(event.currentTarget, state.profile);
    if (phone !== null) state.contact = { ...(state.contact || {}), phone: normalizePhone(phone) };
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
