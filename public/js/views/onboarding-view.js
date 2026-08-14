import { preferredActivityPicker } from "../components/activity-picker.js";
import { measurementHelpButton } from "../components/measurement-guide.js";
import { objectiveHelpButton } from "../components/objective-guide.js";
import { createDefaultMonthlyPlan } from "../data/seed-plan.js";
import { classifyBodyFat, resolveProfileBodyFat } from "../services/body-fat-service.js";
import {
  bodyFatMethodIsEstimated,
  bodyFatMethods,
  normalizeBodyFatMethod
} from "../models/goal-model.js";
import { calculateBmi, classifyBmi } from "../services/bmi-service.js";
import {
  getGoalWeight,
  getProgressMode,
  getSuggestedGoalWeight,
  resolveGoalTiming
} from "../services/progress-service.js";
import { addDays, formatDate, todayISO } from "../utils/date-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { careAreaForProfession, professionalOptions } from "../data/professional-catalog.js";
import { formatDecimal, formatKg, formatPercent, toNumber } from "../utils/number-utils.js";
import { normalizePhone, phoneIsValid } from "../utils/phone-utils.js";
import { showToast } from "../components/toast.js";
import {
  clearFieldError,
  resolveHeightInput,
  setFieldError,
  validateNumericFields
} from "../utils/validation-utils.js";

function basicUserOnboarding(state, authState) {
  const profile = state.profile;
  return `
    <form class="form onboarding-form" id="basic-user-onboarding-form">
      <section class="card">
        <p class="eyebrow">Primeiro acesso</p>
        <h2>Crie seu perfil</h2>
        <p class="muted">Neste momento, precisamos apenas dos seus dados básicos. Você poderá criar o acompanhamento quando tiver suas medidas ou aguardar a orientação de um profissional.</p>
        <div class="form-grid">
          <div class="field">
            <label for="basic-name">Nome completo</label>
            <input id="basic-name" name="name" autocomplete="name" minlength="2" required
              value="${escapeAttribute(profile.name || authState.user?.displayName || "")}" />
          </div>
          <div class="field">
            <label for="basic-birth-date">Data de nascimento</label>
            <input id="basic-birth-date" name="birthDate" type="date" max="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="basic-sex">Sexo</label>
            <select id="basic-sex" name="sex" required>
              <option value="" disabled selected>Selecione</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
            <span class="help-text">Usado na seleção da equação para estimativas corporais.</span>
          </div>
          <div class="field">
            <label for="basic-height">Altura (cm)</label>
            <input id="basic-height" name="heightCm" inputmode="decimal" />
            <span class="help-text">Opcional. Pode ser informada ao criar o primeiro projeto.</span>
          </div>
          <div class="field">
            <label for="basic-phone">Telefone</label>
            <input id="basic-phone" name="phone" type="tel" autocomplete="tel" placeholder="(65) 99999-9999" />
            <span class="help-text">Opcional. O compartilhamento com profissionais será solicitado separadamente.</span>
          </div>
        </div>
      </section>
      <div class="button-row onboarding-submit">
        <button class="button primary" type="submit">Concluir perfil</button>
      </div>
    </form>
  `;
}

function userOnboarding(state, authState) {
  const profile = state.profile;
  return `
    <form class="form onboarding-form" id="onboarding-user-form">
      <ol class="onboarding-steps" aria-label="Etapas do cadastro">
        <li class="active"><span>1</span>Identificação</li>
        <li><span>2</span>Medidas iniciais</li>
        <li><span>3</span>Objetivos</li>
      </ol>

      <section class="card">
        <p class="eyebrow">Etapa 1</p>
        <h2>Vamos preparar seu acompanhamento</h2>
        <div class="form-grid">
          <div class="field">
            <label for="onboarding-name">Nome completo</label>
            <input id="onboarding-name" name="name" autocomplete="name" minlength="2" required
              value="${escapeAttribute(profile.name || authState.user?.displayName || "")}" />
          </div>
          <div class="field">
            <label for="onboarding-phone">Telefone</label>
            <input id="onboarding-phone" name="phone" type="tel" autocomplete="tel" placeholder="(65) 99999-9999" />
          </div>
          <div class="field">
            <label for="onboarding-sex">Sexo</label>
            <select id="onboarding-sex" name="sex" required>
              <option value="">Selecione</option>
              <option value="male">Masculino</option>
              <option value="female">Feminino</option>
            </select>
          </div>
          <div class="field">
            <label for="onboarding-birth-date">Data de nascimento</label>
            <input id="onboarding-birth-date" name="birthDate" type="date" max="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="onboarding-height">Altura (cm)</label>
            <input id="onboarding-height" name="heightCm" inputmode="decimal" required />
          </div>
        </div>
      </section>

      <section class="card">
        <p class="eyebrow">Etapa 2</p>
        <h2>Registre sua linha de base</h2>
        <div class="form-grid">
          <div class="field">
            <label for="onboarding-start-date">Data inicial</label>
            <input id="onboarding-start-date" name="startDate" type="date" max="${todayISO()}" value="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="onboarding-weight">Peso inicial (kg)</label>
            <input id="onboarding-weight" name="startWeightKg" inputmode="decimal" required />
          </div>
          <div class="field">
            <label for="onboarding-waist">Cintura inicial (cm) ${measurementHelpButton("waist")}</label>
            <input id="onboarding-waist" name="startWaistCm" inputmode="decimal" required />
          </div>
          <div class="field">
            <label for="onboarding-neck">Pescoço inicial (cm) ${measurementHelpButton("neck")}</label>
            <input id="onboarding-neck" name="startNeckCm" inputmode="decimal" required />
          </div>
          <div class="field">
            <label for="onboarding-hip">Quadril inicial (cm) ${measurementHelpButton("hip")}</label>
            <input id="onboarding-hip" name="startHipCm" inputmode="decimal" />
          </div>
          <div class="field">
            <label for="onboarding-body-fat-method">Método de obtenção do percentual de gordura</label>
            <select id="onboarding-body-fat-method" name="startBodyFatMethod">
              ${bodyFatMethods.map((method) => `<option value="${method.value}">${method.label}</option>`).join("")}
            </select>
          </div>
          <div class="field" data-onboarding-body-fat-value>
            <label for="onboarding-body-fat">Percentual inicial informado (%)</label>
            <input id="onboarding-body-fat" name="startBodyFatManual" inputmode="decimal" />
            <span class="help-text">Preencha o resultado obtido pelo método escolhido.</span>
          </div>
        </div>
        <div class="onboarding-insight" id="onboarding-insight" aria-live="polite">
          Preencha altura, peso e circunferências para visualizar as estimativas iniciais.
        </div>
      </section>

      <section class="card">
        <p class="eyebrow">Etapa 3</p>
        <h2>Defina a direção</h2>
        <div class="form-grid">
          <div class="field">
            <label for="onboarding-goal-type">Objetivo principal ${objectiveHelpButton()}</label>
            <select id="onboarding-goal-type" name="goalType" required>
              <option value="">Selecione</option>
              <option value="weight-loss">Emagrecimento</option>
              <option value="weight-gain">Ganho de peso</option>
              <option value="muscle-gain">Ganho de massa muscular</option>
              <option value="maintenance">Manutenção</option>
              <option value="recovery">Recuperação de peso</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div class="field">
            <label for="onboarding-target-bmi">IMC usado na sugestão</label>
            <input id="onboarding-target-bmi" name="targetBmi" inputmode="decimal" value="24.9" />
            <span class="help-text">Referência editável. No emagrecimento, 24,9 representa o limite superior da faixa normal.</span>
          </div>
          <div class="field">
            <label for="onboarding-goal-weight">Peso final desejado (kg)</label>
            <input id="onboarding-goal-weight" name="goalWeightKg" inputmode="decimal" />
            <button class="button text-button field-action" id="onboarding-apply-goal-suggestion" type="button">Usar peso sugerido</button>
          </div>
          <div class="field">
            <label for="onboarding-weekly-change">Mudança semanal desejada (kg)</label>
            <input id="onboarding-weekly-change" name="weeklyChangeGoalKg" inputmode="decimal" value="0.5" />
          </div>
          <div class="field">
            <label for="onboarding-goal-deadline">Prazo estimado (meses)</label>
            <input id="onboarding-goal-deadline" name="goalDeadlineMonths" inputmode="decimal" readonly />
            <span class="help-text" id="onboarding-deadline-help">Calculado pelo peso final e pelo ritmo semanal.</span>
          </div>
          <fieldset class="field goal-mode-field">
            <legend>Como deseja planejar?</legend>
            <div class="radio-row">
              <label class="radio-card">
                <input type="radio" name="goalDeadlineMode" value="auto" checked />
                <span><strong>Calcular prazo</strong><small>Prioriza o ritmo semanal.</small></span>
              </label>
              <label class="radio-card">
                <input type="radio" name="goalDeadlineMode" value="custom" />
                <span><strong>Definir prazo</strong><small>Recalcula o ritmo necessário.</small></span>
              </label>
            </div>
          </fieldset>
          <div class="field">
            <label for="onboarding-activity-days">Meta semanal de dias ativos</label>
            <input id="onboarding-activity-days" name="weeklyActivityGoalDays" type="number" min="1" max="7" value="3" />
          </div>
          <div class="field">
            <label for="onboarding-activity-duration">Duração média por dia (minutos)</label>
            <input id="onboarding-activity-duration" name="averageActivityDurationMinutes" type="number" min="1" max="1440" value="30" />
          </div>
        </div>
        <div class="field">
          <label>Atividades preferidas</label>
          ${preferredActivityPicker([])}
        </div>
        <div class="goal-preview" id="onboarding-goal-preview" aria-live="polite"></div>
      </section>

      <div class="button-row onboarding-submit">
        <button class="button primary" type="submit">Concluir cadastro</button>
      </div>
    </form>
  `;
}

function professionalOnboarding(authState) {
  const profile = authState.professionalProfile || {};
  return `
    <form class="form onboarding-form" id="onboarding-professional-form">
      <ol class="onboarding-steps" aria-label="Etapas do cadastro">
        <li class="active"><span>1</span>Identificação</li>
        <li><span>2</span>Atuação</li>
        <li><span>3</span>Contato</li>
      </ol>

      <section class="card">
        <p class="eyebrow">Cadastro profissional</p>
        <h2>Prepare seu espaço de acompanhamento</h2>
        <div class="form-grid">
          <div class="field">
            <label for="professional-onboarding-name">Nome de exibição</label>
            <input id="professional-onboarding-name" name="name" autocomplete="name" minlength="2" required
              value="${escapeAttribute(profile.name || authState.user?.displayName || "")}" />
          </div>
          <div class="field">
            <label for="professional-onboarding-email">E-mail</label>
            <input id="professional-onboarding-email" value="${escapeAttribute(authState.user?.email || "")}" disabled />
          </div>
          <div class="field">
            <label for="professional-type">Profissão</label>
            <select id="professional-type" name="professionType" required>
              <option value="">Selecione</option>
              ${professionalOptions(profile.professionType)}
            </select>
          </div>
          <div class="field">
            <label for="professional-registration-number">Registro profissional</label>
            <input id="professional-registration-number" name="registrationNumber" maxlength="40"
              value="${escapeAttribute(profile.registrationNumber || "")}" />
            <span class="help-text">Opcional nesta fase.</span>
          </div>
          <div class="field">
            <label for="professional-specialties">Especialidades</label>
            <input id="professional-specialties" name="specialties" maxlength="160"
              placeholder="Ex.: emagrecimento, força, saúde metabólica"
              value="${escapeAttribute((profile.specialties || []).join(", "))}" />
          </div>
          <div class="field">
            <label for="professional-phone">Telefone</label>
            <input id="professional-phone" name="phone" type="tel" autocomplete="tel"
              placeholder="(65) 99999-9999" value="${escapeAttribute(profile.phone || "")}" />
          </div>
        </div>
      </section>

      <section class="card">
        <h2>Privacidade por padrão</h2>
        <p class="muted">O acesso profissional ficará limitado aos usuários que confirmarem um vínculo. A administração gerencia contas, mas não acessa dados corporais ou históricos pessoais.</p>
      </section>

      <div class="button-row onboarding-submit">
        <button class="button primary" type="submit">Concluir cadastro profissional</button>
      </div>
    </form>
  `;
}

export function renderOnboarding(state, authState) {
  return authState.role === "professional" && authState.activeWorkspace !== "personal"
    ? professionalOnboarding(authState)
    : basicUserOnboarding(state, authState);
}

function updateInsight(form) {
  const data = new FormData(form);
  const profile = {
    sex: data.get("sex"),
    heightCm: toNumber(data.get("heightCm")),
    startWeightKg: toNumber(data.get("startWeightKg")),
    startWaistCm: toNumber(data.get("startWaistCm")),
    startNeckCm: toNumber(data.get("startNeckCm")),
    startHipCm: toNumber(data.get("startHipCm")),
    startBodyFatMethod: normalizeBodyFatMethod(data.get("startBodyFatMethod")),
    startBodyFatManual: bodyFatMethodIsEstimated(data.get("startBodyFatMethod"))
      ? null
      : toNumber(data.get("startBodyFatManual"))
  };
  const bmi = calculateBmi(profile.startWeightKg, profile.heightCm);
  const bodyFat = resolveProfileBodyFat(profile);
  const insight = document.getElementById("onboarding-insight");
  if (!insight) return;
  insight.innerHTML = bmi
    ? `<strong>IMC estimado: ${formatDecimal(bmi, 1)} (${escapeHtml(classifyBmi(bmi))}).</strong>
       ${bodyFat ? ` Gordura corporal ${bodyFatMethodIsEstimated(profile.startBodyFatMethod) ? "estimada" : "informada"}: ${formatPercent(bodyFat)} (${escapeHtml(classifyBodyFat(profile.sex, bodyFat))}).` : " Complete os dados necessários para obter a gordura corporal."}`
    : "Preencha altura, peso e circunferências para visualizar as estimativas iniciais.";
}

function readOnboardingGoalDraft(form) {
  const data = new FormData(form);
  return resolveGoalTiming({
    goalType: data.get("goalType"),
    targetBmi: toNumber(data.get("targetBmi")) || 24.9,
    heightCm: toNumber(data.get("heightCm")),
    startDate: data.get("startDate") || todayISO(),
    startWeightKg: toNumber(data.get("startWeightKg")),
    goalWeightKg: toNumber(data.get("goalWeightKg")),
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
    weeklyLossGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
    goalDeadlineMode: data.get("goalDeadlineMode") === "custom" ? "custom" : "auto"
  });
}

function renderGoalPreview(profile) {
  const mode = getProgressMode(profile);
  const goalWeight = getGoalWeight(profile);
  const bmi = calculateBmi(goalWeight, profile.heightCm);
  if (!goalWeight || !profile.startWeightKg) {
    return `<p class="muted">Preencha o objetivo, a altura e o peso inicial para visualizar o planejamento.</p>`;
  }
  if (mode === "maintain" || Math.abs(goalWeight - profile.startWeightKg) < 0.05) {
    return `
      <strong>Planejamento de manutenção</strong>
      <p>Referência de ${formatKg(goalWeight)}, com IMC estimado de ${formatDecimal(bmi, 1)}. Não há prazo de perda ou ganho.</p>
    `;
  }

  const deadline = Number(profile.goalDeadlineMonths);
  const finishDate = deadline
    ? addDays(profile.startDate || todayISO(), deadline * 30.4375)
    : null;
  return `
    <strong>Prévia da meta</strong>
    <dl class="goal-preview-list">
      <div><dt>Peso final</dt><dd>${formatKg(goalWeight)}</dd></div>
      <div><dt>IMC estimado</dt><dd>${formatDecimal(bmi, 1)}</dd></div>
      <div><dt>Ritmo semanal</dt><dd>${formatKg(Number(profile.weeklyChangeGoalKg))}</dd></div>
      <div><dt>Prazo</dt><dd>${deadline ? `${formatDecimal(deadline, 1)} meses` : "-"}</dd></div>
      <div><dt>Data estimada</dt><dd>${formatDate(finishDate)}</dd></div>
    </dl>
    <small>${profile.goalDeadlineMode === "custom"
      ? "O prazo foi mantido e o ritmo semanal foi recalculado."
      : "O ritmo semanal foi mantido e o prazo foi recalculado."}</small>
  `;
}

function updateOnboardingGoalPlanner(form, sourceName = "") {
  const deadlineMode = form.elements.goalDeadlineMode?.value === "custom" ? "custom" : "auto";
  const weeklyField = form.elements.weeklyChangeGoalKg;
  const deadlineField = form.elements.goalDeadlineMonths;
  const profile = readOnboardingGoalDraft(form);
  const maintenance = getProgressMode(profile) === "maintain";

  weeklyField.readOnly = deadlineMode === "custom" || maintenance;
  deadlineField.readOnly = deadlineMode !== "custom" || maintenance;
  if (sourceName !== "weeklyChangeGoalKg"
    && document.activeElement !== weeklyField
    && Number.isFinite(Number(profile.weeklyChangeGoalKg))) {
    weeklyField.value = profile.weeklyChangeGoalKg || "";
  }
  if (sourceName !== "goalDeadlineMonths" && document.activeElement !== deadlineField) {
    deadlineField.value = profile.goalDeadlineMonths
      ? Number(profile.goalDeadlineMonths).toFixed(1)
      : "";
  }
  document.getElementById("onboarding-deadline-help").textContent = deadlineMode === "custom"
    ? "O prazo será mantido e o ritmo semanal será recalculado."
    : "Calculado pelo peso final e pelo ritmo semanal.";
  document.getElementById("onboarding-goal-preview").innerHTML = renderGoalPreview(profile);
  return profile;
}

function goalDirectionIsValid(profile, field) {
  clearFieldError(field);
  const start = Number(profile.startWeightKg);
  const goal = Number(profile.goalWeightKg);
  if (![start, goal].every(Number.isFinite)) return false;
  if (profile.goalType === "weight-loss" && goal >= start) {
    setFieldError(field, "Para emagrecimento, o peso final deve ser menor que o peso inicial.");
    field.focus();
    return false;
  }
  if (["weight-gain", "recovery"].includes(profile.goalType) && goal <= start) {
    setFieldError(field, "Para ganho ou recuperação, o peso final deve ser maior que o peso inicial.");
    field.focus();
    return false;
  }
  return true;
}

export function bindOnboarding(context) {
  const basicForm = document.getElementById("basic-user-onboarding-form");
  basicForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const heightField = event.currentTarget.elements.heightCm;
    if (heightField.value && !await resolveHeightInput(heightField)) return;
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }
    const validation = await validateNumericFields(event.currentTarget, {
      heightCm: { rule: "heightCm", label: "Altura" }
    });
    if (!validation.valid) {
      showToast("Revise os campos destacados.");
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await context.completeOnboarding({
        profile: {
          ...context.personalState.profile,
          name: String(data.get("name") || "").trim(),
          birthDate: data.get("birthDate"),
          sex: data.get("sex"),
          heightCm: toNumber(data.get("heightCm"))
        },
        contact: { phone: normalizePhone(data.get("phone")) }
      });
      showToast("Perfil criado.");
    } catch (error) {
      showToast(`Não foi possível concluir o cadastro: ${error.message}`);
      button.disabled = false;
    }
  });
  if (basicForm) return;

  const userForm = document.getElementById("onboarding-user-form");
  const sexField = document.getElementById("onboarding-sex");
  const hipField = document.getElementById("onboarding-hip");
  const heightField = document.getElementById("onboarding-height");
  const goalWeightField = document.getElementById("onboarding-goal-weight");
  const bodyFatMethodField = document.getElementById("onboarding-body-fat-method");
  const bodyFatValueField = document.getElementById("onboarding-body-fat");
  let goalWeightWasEdited = false;
  let goalPlannerTimer = null;
  const updateBodyFatFields = () => {
    const estimated = bodyFatMethodIsEstimated(bodyFatMethodField?.value);
    const field = document.querySelector("[data-onboarding-body-fat-value]");
    const neckField = userForm?.elements.startNeckCm;
    const hipRequired = estimated && sexField?.value === "female";
    if (field) field.hidden = estimated;
    if (bodyFatValueField) {
      bodyFatValueField.disabled = estimated;
      bodyFatValueField.required = !estimated;
    }
    if (neckField) neckField.required = estimated;
    if (hipField) hipField.required = hipRequired;
    updateInsight(userForm);
  };
  bodyFatMethodField?.addEventListener("change", updateBodyFatFields);
  updateBodyFatFields();
  const updateHipRequirement = () => {
    if (!hipField) return;
    hipField.required = bodyFatMethodIsEstimated(bodyFatMethodField?.value)
      && sexField?.value === "female";
  };
  sexField?.addEventListener("change", updateHipRequirement);
  updateHipRequirement();
  const applyGoalSuggestion = () => {
    const data = new FormData(userForm);
    const suggestion = getSuggestedGoalWeight({
      goalType: data.get("goalType"),
      targetBmi: toNumber(data.get("targetBmi")) || 24.9,
      heightCm: toNumber(data.get("heightCm")),
      startWeightKg: toNumber(data.get("startWeightKg"))
    });
    goalWeightField.value = suggestion !== null ? suggestion.toFixed(1) : "";
    goalWeightWasEdited = false;
    updateOnboardingGoalPlanner(userForm);
  };
  heightField?.addEventListener("blur", async () => {
    if (await resolveHeightInput(heightField)) {
      updateInsight(userForm);
      if (!goalWeightWasEdited) applyGoalSuggestion();
    }
  });
  goalWeightField?.addEventListener("input", () => {
    goalWeightWasEdited = true;
  });
  document.getElementById("onboarding-goal-type")?.addEventListener("change", applyGoalSuggestion);
  document.getElementById("onboarding-apply-goal-suggestion")?.addEventListener("click", applyGoalSuggestion);
  userForm?.addEventListener("input", (event) => {
    updateInsight(userForm);
    if (!goalWeightWasEdited && ["heightCm", "startWeightKg", "targetBmi"].includes(event.target.name)) {
      applyGoalSuggestion();
      return;
    }
    if (["weeklyChangeGoalKg", "goalDeadlineMonths"].includes(event.target.name)) {
      const sourceName = event.target.name;
      window.clearTimeout(goalPlannerTimer);
      goalPlannerTimer = window.setTimeout(
        () => updateOnboardingGoalPlanner(userForm, sourceName),
        180
      );
      return;
    }
    updateOnboardingGoalPlanner(userForm, event.target.name);
  });
  updateOnboardingGoalPlanner(userForm);
  userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!await resolveHeightInput(heightField)) return;
    const data = new FormData(event.currentTarget);
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }

    const deadlineMode = data.get("goalDeadlineMode") === "custom" ? "custom" : "auto";
    const maintenanceGoal = data.get("goalType") === "maintenance";
    const validation = await validateNumericFields(event.currentTarget, {
      heightCm: { rule: "heightCm", label: "Altura", required: true },
      startWeightKg: { rule: "weightKg", label: "Peso inicial", required: true },
      startWaistCm: { rule: "circumferenceCm", label: "Cintura inicial", required: true },
      startNeckCm: {
        rule: "circumferenceCm",
        label: "Pescoço inicial",
        required: bodyFatMethodIsEstimated(data.get("startBodyFatMethod"))
      },
      startHipCm: {
        rule: "circumferenceCm",
        label: "Quadril inicial",
        required: bodyFatMethodIsEstimated(data.get("startBodyFatMethod")) && data.get("sex") === "female"
      },
      startBodyFatManual: {
        rule: "bodyFatPercent",
        label: "Gordura corporal inicial",
        required: !bodyFatMethodIsEstimated(data.get("startBodyFatMethod"))
      },
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

    let profile = {
      ...context.personalState.profile,
      name: String(data.get("name") || "").trim(),
      sex: data.get("sex"),
      birthDate: data.get("birthDate"),
      heightCm: toNumber(data.get("heightCm")),
      startDate: data.get("startDate"),
      startWeightKg: toNumber(data.get("startWeightKg")),
      startWaistCm: toNumber(data.get("startWaistCm")),
      startNeckCm: toNumber(data.get("startNeckCm")),
      startHipCm: toNumber(data.get("startHipCm")),
      startBodyFatMethod: normalizeBodyFatMethod(data.get("startBodyFatMethod")),
      startBodyFatManual: bodyFatMethodIsEstimated(data.get("startBodyFatMethod"))
        ? null
        : toNumber(data.get("startBodyFatManual")),
      goalType: data.get("goalType"),
      targetBmi: toNumber(data.get("targetBmi")) || 24.9,
      goalWeightKg: toNumber(data.get("goalWeightKg")),
      weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
      weeklyLossGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
      goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
      goalDeadlineMode: deadlineMode,
      weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
      averageActivityDurationMinutes: toNumber(data.get("averageActivityDurationMinutes")),
      preferredActivities: data.getAll("preferredActivities")
    };
    if (!profile.goalWeightKg) {
      profile.goalWeightKg = getSuggestedGoalWeight(profile);
    }
    if (!goalDirectionIsValid(profile, goalWeightField)) {
      showToast("Revise a direção da meta.");
      return;
    }
    profile = resolveGoalTiming(profile);

    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await context.completeOnboarding({
        profile,
        contact: { phone: normalizePhone(data.get("phone")) },
        goalPlan: createDefaultMonthlyPlan(profile)
      });
      showToast("Cadastro concluído.");
    } catch (error) {
      showToast(`Não foi possível concluir o cadastro: ${error.message}`);
      button.disabled = false;
    }
  });

  document.getElementById("onboarding-professional-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await context.completeOnboarding({
        profile: {
          ...context.personalState.profile,
          name: String(data.get("name") || "").trim()
        },
        contact: { phone: normalizePhone(data.get("phone")) },
        professionalProfile: {
          name: String(data.get("name") || "").trim(),
          professionType: data.get("professionType"),
          careArea: careAreaForProfession(data.get("professionType")),
          registrationNumber: String(data.get("registrationNumber") || "").trim(),
          specialties: String(data.get("specialties") || "").split(",").map((item) => item.trim()).filter(Boolean),
          phone: normalizePhone(data.get("phone")),
          personalWorkspaceEnabled: false,
          locations: []
        }
      });
      showToast("Cadastro profissional concluído.");
    } catch (error) {
      showToast(`Não foi possível concluir o cadastro: ${error.message}`);
      button.disabled = false;
    }
  });
}
