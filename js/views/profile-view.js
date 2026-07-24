import { showToast } from "../components/toast.js";
import { calculateBodyFatByNavy, classifyBodyFat } from "../services/body-fat-service.js";
import { calculateBmi, classifyBmi, getBmiTargets } from "../services/bmi-service.js";
import {
  getGoalDirection,
  getGoalWeight,
  getProgressMode,
  getSuggestedGoalWeight,
  resolveGoalTiming
} from "../services/progress-service.js";
import { createDefaultMonthlyPlan } from "../data/seed-plan.js";
import { formatCm, formatDecimal, formatKg, formatPercent, toNumber } from "../utils/number-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { preferredActivityPicker } from "../components/activity-picker.js";
import { formatPhone, normalizePhone, phoneIsValid } from "../utils/phone-utils.js";
import { measurementHelpButton } from "../components/measurement-guide.js";
import { addDays, formatDate, todayISO } from "../utils/date-utils.js";
import {
  clearFieldError,
  resolveHeightInput,
  setFieldError,
  validateNumericFields
} from "../utils/validation-utils.js";

let profileHasPendingChanges = false;

window.addEventListener("beforeunload", (event) => {
  if (!profileHasPendingChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

document.addEventListener("click", (event) => {
  if (!profileHasPendingChanges) return;
  const link = event.target.closest('a[href^="#/"]');
  if (!link || link.hash === location.hash) return;
  if (window.confirm("Há alterações não salvas no perfil. Deseja sair mesmo assim?")) {
    profileHasPendingChanges = false;
    return;
  }
  event.preventDefault();
});

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
  const finalBmi = calculateBmi(goalWeight, profile.heightCm);
  const mode = getProgressMode(profile);
  const deadline = mode === "maintain" ? null : Number(profile.goalDeadlineMonths);
  const finishDate = deadline
    ? addDays(profile.startDate || todayISO(), deadline * 30.4375)
    : null;
  const direction = getGoalDirection(profile);
  const directionLabel = direction === "gain" ? "ganho" : direction === "loss" ? "perda" : "manutenção";

  return `
    <div class="goal-preview-header">
      <div>
        <span class="eyebrow">Prévia imediata</span>
        <h2>Resumo calculado</h2>
      </div>
      <span class="badge">${profile.goalDeadlineMode === "custom" ? "Prazo personalizado" : "Prazo automático"}</span>
    </div>
    <div class="grid four">
      <article class="mini-stat">
        <span>IMC atual</span>
        <strong>${formatDecimal(bmi, 1)}</strong>
        <small>${escapeHtml(classifyBmi(bmi))}</small>
      </article>
      <article class="mini-stat">
        <span>Gordura corporal</span>
        <strong>${formatPercent(bodyFat)}</strong>
        <small>${escapeHtml(classifyBodyFat(profile.sex, bodyFat))}</small>
      </article>
      <article class="mini-stat">
        <span>${mode === "maintain" ? "Peso de referência" : "Peso final"}</span>
        <strong>${formatKg(goalWeight)}</strong>
        <small>IMC estimado ${formatDecimal(finalBmi, 1)}</small>
      </article>
      <article class="mini-stat">
        <span>${mode === "maintain" ? "Planejamento" : "Prazo estimado"}</span>
        <strong>${deadline ? `${formatDecimal(deadline, 1)} meses` : "Manutenção"}</strong>
        <small>${finishDate ? `Até ${formatDate(finishDate)}` : `${directionLabel} de peso`}</small>
      </article>
    </div>
    ${mode === "maintain" ? `
      <p class="muted">Para manutenção, o peso inicial é usado como referência e não há prazo de perda ou ganho.</p>
    ` : `
      <dl class="goal-preview-list">
        <div><dt>Ritmo semanal</dt><dd>${formatKg(Number(profile.weeklyChangeGoalKg))}</dd></div>
        <div><dt>Cálculo aplicado</dt><dd>${profile.goalDeadlineMode === "custom"
          ? "Prazo mantido; ritmo recalculado"
          : "Ritmo mantido; prazo recalculado"}</dd></div>
      </dl>
    `}
    <p class="muted">Referências por IMC: peso normal entre ${formatKg(bmiTargets.normalMinKg)} e ${formatKg(bmiTargets.normalMaxKg)}; saída da obesidade abaixo de ${formatKg(bmiTargets.obesityExitKg)}. O peso final continua livre para ajuste em contextos como ganho de massa, alta massa muscular ou metas intermediárias.</p>
  `;
}

function renderPlanEditor(profile) {
  const rows = createDefaultMonthlyPlan(profile);
  return `
    <section class="card goals-plan-card">
      <div class="chart-header">
        <div>
          <h2>Planejamento mensal</h2>
          <p class="muted">Atualizado automaticamente pela meta acima. A tabela mantém no mínimo 12 meses e se expande quando necessário.</p>
        </div>
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
            ${rows.map((item) => `
              <tr>
                <td>${escapeHtml(item.label)}</td>
                <td class="number">${formatKg(item.weightKg)}</td>
                <td class="number">${formatCm(item.waistCm)}</td>
                <td>${escapeHtml(item.status)}</td>
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
  return resolveGoalTiming({
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
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
    goalDeadlineMode: data.get("goalDeadlineMode") === "custom" ? "custom" : "auto",
    weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
    averageActivityDurationMinutes: toNumber(data.get("averageActivityDurationMinutes")),
    preferredActivities: data.getAll("preferredActivities")
  });
}

function goalDirectionIsValid(profile, field) {
  clearFieldError(field);
  const start = Number(profile.startWeightKg);
  const goal = Number(profile.goalWeightKg);
  if (![start, goal].every(Number.isFinite)) return false;
  if (profile.goalType === "weight-loss" && goal >= start) {
    setFieldError(field, "Para emagrecimento, a meta deve ser menor que o peso inicial.");
    field.focus();
    return false;
  }
  if (["weight-gain", "recovery"].includes(profile.goalType) && goal <= start) {
    setFieldError(field, "Para ganho ou recuperação, a meta deve ser maior que o peso inicial.");
    field.focus();
    return false;
  }
  return true;
}

export function renderProfile(state, options = {}) {
  const p = state.profile;
  const canEditContact = options.canEditContact !== false;
  const baselineLocked = p.baselineLocked === true || state.entries.length > 0;
  const baselineDisabled = baselineLocked ? "disabled" : "";
  const suggestedGoal = getSuggestedGoalWeight(p);
  const previewProfile = resolveGoalTiming({
    ...p,
    goalWeightKg: p.goalWeightKg ?? suggestedGoal,
    goalDeadlineMode: p.goalDeadlineMode === "custom" ? "custom" : "auto"
  });

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
            <input id="birthDate" name="birthDate" type="date" max="${todayISO()}" value="${escapeAttribute(p.birthDate || "")}" />
          </div>
          <div class="field">
            <label for="heightCm">Altura (cm)</label>
            <input id="heightCm" name="heightCm" inputmode="decimal" required ${baselineDisabled} value="${escapeAttribute(p.heightCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startDate">Data inicial</label>
            <input id="startDate" name="startDate" type="date" max="${todayISO()}" required ${baselineDisabled} value="${escapeAttribute(p.startDate || "")}" />
          </div>
          <div class="field">
            <label for="startWeightKg">Peso inicial (kg)</label>
            <input id="startWeightKg" name="startWeightKg" inputmode="decimal" required ${baselineDisabled} value="${escapeAttribute(p.startWeightKg ?? "")}" />
          </div>
          <div class="field">
            <label for="startWaistCm">Cintura inicial (cm) ${measurementHelpButton("waist")}</label>
            <input id="startWaistCm" name="startWaistCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startWaistCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startNeckCm">Pescoço inicial (cm) ${measurementHelpButton("neck")}</label>
            <input id="startNeckCm" name="startNeckCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startNeckCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startHipCm">Quadril inicial (cm) ${measurementHelpButton("hip")}</label>
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
            <label for="targetBmi">IMC de referência para sugerir peso</label>
            <input id="targetBmi" name="targetBmi" inputmode="decimal" value="${escapeAttribute(p.targetBmi ?? 24.9)}" />
            <span class="help-text">No emagrecimento, 24,9 representa o limite superior da faixa normal.</span>
          </div>
          <div class="field">
            <label for="goalWeightKg">Peso final desejado (kg)</label>
            <input id="goalWeightKg" name="goalWeightKg" inputmode="decimal" value="${escapeAttribute(previewProfile.goalWeightKg ?? "")}" />
            <button class="button text-button field-action" id="apply-goal-suggestion" type="button">Usar peso sugerido</button>
          </div>
          <div class="field">
            <label for="weeklyChangeGoalKg">Mudança semanal desejada (kg)</label>
            <input id="weeklyChangeGoalKg" name="weeklyChangeGoalKg" inputmode="decimal" value="${escapeAttribute(previewProfile.weeklyChangeGoalKg || "")}" />
          </div>
          <div class="field">
            <label for="goalDeadlineMonths">Prazo da meta (meses)</label>
            <input id="goalDeadlineMonths" name="goalDeadlineMonths" inputmode="decimal"
              value="${escapeAttribute(previewProfile.goalDeadlineMonths || "")}" />
            <span class="help-text" id="goal-deadline-help"></span>
          </div>
          <fieldset class="field goal-mode-field">
            <legend>Como deseja planejar?</legend>
            <div class="radio-row">
              <label class="radio-card">
                <input type="radio" name="goalDeadlineMode" value="auto"
                  ${previewProfile.goalDeadlineMode !== "custom" ? "checked" : ""} />
                <span><strong>Calcular prazo</strong><small>Prioriza o ritmo semanal.</small></span>
              </label>
              <label class="radio-card">
                <input type="radio" name="goalDeadlineMode" value="custom"
                  ${previewProfile.goalDeadlineMode === "custom" ? "checked" : ""} />
                <span><strong>Definir prazo</strong><small>Recalcula o ritmo necessário.</small></span>
              </label>
            </div>
          </fieldset>
        </div>
        <div class="goal-preview" id="profile-goal-preview" aria-live="polite">
          ${renderProfileInsight(previewProfile)}
        </div>
        <div class="button-row profile-card-save">
          <button class="button primary" type="submit">Salvar alterações</button>
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

      <div id="profile-plan-preview">
        ${renderPlanEditor(previewProfile)}
      </div>

      <div class="mobile-save-bar" id="profile-mobile-save" hidden>
        <span>Alterações não salvas</span>
        <button class="button primary" type="submit">Salvar</button>
      </div>
    </form>
  `;
}

export function bindProfile(state, persist, render) {
  const form = document.getElementById("profile-form");
  const heightField = form.elements.heightCm;
  const goalWeightField = form.elements.goalWeightKg;
  const weeklyField = form.elements.weeklyChangeGoalKg;
  const deadlineField = form.elements.goalDeadlineMonths;
  const mobileSave = document.getElementById("profile-mobile-save");
  profileHasPendingChanges = false;

  const markDirty = () => {
    profileHasPendingChanges = true;
    mobileSave.hidden = false;
  };

  const updateGoalPlanner = () => {
    const draft = readProfileForm(form, state.profile);
    const maintenance = getProgressMode(draft) === "maintain";
    const customDeadline = draft.goalDeadlineMode === "custom";
    weeklyField.readOnly = customDeadline || maintenance;
    deadlineField.readOnly = !customDeadline || maintenance;
    weeklyField.value = draft.weeklyChangeGoalKg || "";
    deadlineField.value = draft.goalDeadlineMonths
      ? Number(draft.goalDeadlineMonths).toFixed(1)
      : "";
    document.getElementById("goal-deadline-help").textContent = customDeadline
      ? "O prazo será mantido e o ritmo semanal será recalculado."
      : "Calculado automaticamente pelo peso final e pelo ritmo.";
    document.getElementById("profile-goal-preview").innerHTML = renderProfileInsight(draft);
    document.getElementById("profile-plan-preview").innerHTML = renderPlanEditor(draft);
    return draft;
  };

  const applyGoalSuggestion = () => {
    const draft = readProfileForm(form, state.profile);
    const suggestion = getSuggestedGoalWeight(draft);
    goalWeightField.value = suggestion !== null ? suggestion.toFixed(1) : "";
    if (suggestion === null) {
      showToast("Defina um peso final adequado ao seu objetivo.");
    }
    markDirty();
    updateGoalPlanner();
  };

  heightField?.addEventListener("blur", () => {
    if (resolveHeightInput(heightField)) updateGoalPlanner();
  });
  document.getElementById("apply-goal-suggestion")?.addEventListener("click", applyGoalSuggestion);
  form.elements.goalType?.addEventListener("change", applyGoalSuggestion);
  form.addEventListener("input", (event) => {
    markDirty();
    if ([
      "goalType",
      "targetBmi",
      "goalWeightKg",
      "weeklyChangeGoalKg",
      "goalDeadlineMonths",
      "goalDeadlineMode",
      "heightCm",
      "startWeightKg",
      "startDate",
      "sex",
      "startWaistCm",
      "startNeckCm",
      "startHipCm"
    ].includes(event.target.name)) {
      updateGoalPlanner();
    }
  });
  updateGoalPlanner();

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!resolveHeightInput(heightField)) return;
    const data = new FormData(form);
    const phone = data.get("phone");
    if (phone !== null && !phoneIsValid(phone)) {
      showToast("Informe um telefone válido, com DDD.");
      form.elements.phone?.focus();
      return;
    }

    const deadlineMode = data.get("goalDeadlineMode") === "custom" ? "custom" : "auto";
    const maintenanceGoal = data.get("goalType") === "maintenance";
    const validation = validateNumericFields(form, {
      heightCm: { rule: "heightCm", label: "Altura", required: true },
      startWeightKg: { rule: "weightKg", label: "Peso inicial", required: true },
      startWaistCm: { rule: "circumferenceCm", label: "Cintura inicial" },
      startNeckCm: { rule: "circumferenceCm", label: "Pescoço inicial" },
      startHipCm: { rule: "circumferenceCm", label: "Quadril inicial", required: data.get("sex") === "female" },
      targetBmi: { rule: "targetBmi", label: "IMC de referência", required: true },
      goalWeightKg: { rule: "weightKg", label: "Peso final", required: true },
      weeklyChangeGoalKg: { rule: "weeklyChangeKg", label: "Mudança semanal", required: deadlineMode === "auto" && !maintenanceGoal },
      goalDeadlineMonths: { rule: "deadlineMonths", label: "Prazo", required: deadlineMode === "custom" && !maintenanceGoal },
      weeklyActivityGoalDays: { rule: "activityDays", label: "Dias ativos", required: true },
      averageActivityDurationMinutes: { rule: "activityMinutes", label: "Duração média" }
    });
    if (!validation.valid) {
      showToast("Revise os campos destacados.");
      return;
    }

    const nextProfile = readProfileForm(form, state.profile);
    if (!goalDirectionIsValid(nextProfile, goalWeightField)) {
      showToast("Revise a direção da meta.");
      return;
    }
    if (deadlineMode === "custom" && getProgressMode(nextProfile) !== "maintain") {
      const accepted = window.confirm(
        `Para cumprir esse prazo, o ritmo será de ${formatKg(Number(nextProfile.weeklyChangeGoalKg))} por semana. Deseja aplicar?`
      );
      if (!accepted) return;
    }

    state.profile = nextProfile;
    if (phone !== null) state.contact = { ...(state.contact || {}), phone: normalizePhone(phone) };
    state.goalPlan = createDefaultMonthlyPlan(nextProfile);
    profileHasPendingChanges = false;
    persist({ type: "profile-plan" });
    showToast("Perfil e planejamento salvos.");
    render();
  });
}
