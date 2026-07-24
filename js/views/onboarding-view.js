import { preferredActivityPicker } from "../components/activity-picker.js";
import { measurementHelpButton } from "../components/measurement-guide.js";
import { createDefaultMonthlyPlan } from "../data/seed-plan.js";
import { calculateBodyFatByNavy, classifyBodyFat } from "../services/body-fat-service.js";
import { calculateBmi, classifyBmi } from "../services/bmi-service.js";
import { calculateGoalDeadlineMonths, getGoalWeight } from "../services/progress-service.js";
import { todayISO } from "../utils/date-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatDecimal, formatKg, formatPercent, toNumber } from "../utils/number-utils.js";
import { normalizePhone, phoneIsValid } from "../utils/phone-utils.js";
import { showToast } from "../components/toast.js";

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
            <input id="onboarding-birth-date" name="birthDate" type="date" required />
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
            <label for="onboarding-goal-type">Objetivo principal</label>
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
          </div>
          <div class="field">
            <label for="onboarding-goal-weight">Peso final desejado (kg)</label>
            <input id="onboarding-goal-weight" name="goalWeightKg" inputmode="decimal" />
            <span class="help-text">Deixe vazio para usar a sugestão calculada pelo IMC.</span>
          </div>
          <div class="field">
            <label for="onboarding-weekly-change">Mudança semanal desejada (kg)</label>
            <input id="onboarding-weekly-change" name="weeklyChangeGoalKg" inputmode="decimal" value="0.5" />
          </div>
          <div class="field">
            <label for="onboarding-activity-days">Meta semanal de dias ativos</label>
            <input id="onboarding-activity-days" name="weeklyActivityGoalDays" type="number" min="1" max="7" value="3" />
          </div>
          <div class="field">
            <label for="onboarding-activity-duration">Duração média por dia (minutos)</label>
            <input id="onboarding-activity-duration" name="averageActivityDurationMinutes" type="number" min="1" max="1440" />
          </div>
        </div>
        <div class="field">
          <label>Atividades preferidas</label>
          ${preferredActivityPicker([])}
        </div>
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
            <label for="professional-type">Área profissional</label>
            <select id="professional-type" name="professionType" required>
              <option value="">Selecione</option>
              <option value="nutritionist">Nutricionista</option>
              <option value="personal-trainer">Personal trainer</option>
              <option value="physician">Médico</option>
              <option value="physical-therapist">Fisioterapeuta</option>
              <option value="physical-educator">Profissional de educação física</option>
              <option value="other">Outra</option>
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
        <p class="muted">O acesso profissional ficará limitado aos pacientes que confirmarem um vínculo. A administração gerencia contas, mas não acessa dados corporais ou históricos pessoais.</p>
      </section>

      <div class="button-row onboarding-submit">
        <button class="button primary" type="submit">Concluir cadastro profissional</button>
      </div>
    </form>
  `;
}

export function renderOnboarding(state, authState) {
  return authState.role === "professional"
    ? professionalOnboarding(authState)
    : userOnboarding(state, authState);
}

function updateInsight(form) {
  const data = new FormData(form);
  const profile = {
    sex: data.get("sex"),
    heightCm: toNumber(data.get("heightCm")),
    startWeightKg: toNumber(data.get("startWeightKg")),
    startWaistCm: toNumber(data.get("startWaistCm")),
    startNeckCm: toNumber(data.get("startNeckCm")),
    startHipCm: toNumber(data.get("startHipCm"))
  };
  const bmi = calculateBmi(profile.startWeightKg, profile.heightCm);
  const bodyFat = calculateBodyFatByNavy({
    sex: profile.sex,
    heightCm: profile.heightCm,
    waistCm: profile.startWaistCm,
    neckCm: profile.startNeckCm,
    hipCm: profile.startHipCm
  });
  const insight = document.getElementById("onboarding-insight");
  if (!insight) return;
  insight.innerHTML = bmi
    ? `<strong>IMC estimado: ${formatDecimal(bmi, 1)} (${escapeHtml(classifyBmi(bmi))}).</strong>
       ${bodyFat ? ` Gordura corporal estimada: ${formatPercent(bodyFat)} (${escapeHtml(classifyBodyFat(profile.sex, bodyFat))}).` : " Complete as circunferências necessárias para estimar a gordura corporal."}`
    : "Preencha altura, peso e circunferências para visualizar as estimativas iniciais.";
}

export function bindOnboarding(context) {
  const userForm = document.getElementById("onboarding-user-form");
  const sexField = document.getElementById("onboarding-sex");
  const hipField = document.getElementById("onboarding-hip");
  const updateHipRequirement = () => {
    if (!hipField) return;
    hipField.required = sexField?.value === "female";
  };
  sexField?.addEventListener("change", updateHipRequirement);
  updateHipRequirement();
  userForm?.addEventListener("input", () => updateInsight(userForm));
  userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }

    const profile = {
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
      goalType: data.get("goalType"),
      targetBmi: toNumber(data.get("targetBmi")) || 24.9,
      goalWeightKg: toNumber(data.get("goalWeightKg")),
      weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
      weeklyLossGoalKg: toNumber(data.get("weeklyChangeGoalKg")) || 0.5,
      weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
      averageActivityDurationMinutes: toNumber(data.get("averageActivityDurationMinutes")),
      preferredActivities: data.getAll("preferredActivities")
    };
    if (!profile.goalWeightKg) {
      profile.goalWeightKg = profile.goalType === "maintenance"
        ? profile.startWeightKg
        : getGoalWeight(profile);
    }
    profile.goalDeadlineMonths = calculateGoalDeadlineMonths(profile);

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
          registrationNumber: String(data.get("registrationNumber") || "").trim(),
          specialties: String(data.get("specialties") || "").split(",").map((item) => item.trim()).filter(Boolean),
          phone: normalizePhone(data.get("phone"))
        }
      });
      showToast("Cadastro profissional concluído.");
    } catch (error) {
      showToast(`Não foi possível concluir o cadastro: ${error.message}`);
      button.disabled = false;
    }
  });
}
