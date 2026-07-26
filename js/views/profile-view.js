import { showToast } from "../components/toast.js";
import { classifyBodyFat, resolveProfileBodyFat } from "../services/body-fat-service.js";
import {
  bodyFatMethodIsEstimated,
  bodyFatMethodLabel,
  bodyFatMethods,
  normalizeBodyFatMethod
} from "../models/goal-model.js";
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
import { activityLabel } from "../data/activity-catalog.js";
import { confirmAction } from "../components/modal.js";
import {
  activeCycle,
  closeActiveCycle,
  startNewCycle
} from "../models/cycle-model.js";

let profileHasPendingChanges = false;
let profileEditMode = false;
let cycleDialogMode = null;
let selectedCycleId = null;

const sexLabels = {
  male: "Masculino",
  female: "Feminino"
};

const goalTypeLabels = {
  "weight-loss": "Emagrecimento",
  "weight-gain": "Ganho de peso",
  "muscle-gain": "Ganho de massa muscular",
  maintenance: "Manutenção",
  recovery: "Recuperação de peso",
  other: "Outro"
};

const cycleStatusLabels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  abandoned: "Abandonado",
  expired: "Expirado",
  archived: "Arquivado"
};

window.addEventListener("beforeunload", (event) => {
  if (!profileHasPendingChanges) return;
  event.preventDefault();
  event.returnValue = "";
});

document.addEventListener("click", async (event) => {
  if (!profileHasPendingChanges) return;
  const link = event.target.closest('a[href^="#/"]');
  if (!link || link.hash === location.hash) return;
  event.preventDefault();
  if (await confirmAction({
    title: "Descartar alterações?",
    message: "Há alterações não salvas no perfil.",
    confirmLabel: "Descartar",
    tone: "warning"
  })) {
    profileHasPendingChanges = false;
    location.hash = link.hash;
    return;
  }
});

function renderProfileInsight(profile) {
  const bmi = calculateBmi(profile.startWeightKg, profile.heightCm);
  const bmiTargets = getBmiTargets(profile.heightCm);
  const bodyFat = resolveProfileBodyFat(profile);
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

function profileValue(label, value) {
  return `
    <div>
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value || "-")}</dd>
    </div>
  `;
}

function renderCycleDialog(state) {
  if (!cycleDialogMode) return "";
  if (cycleDialogMode === "view") {
    const cycle = (state.cycles || []).find((item) => item.id === selectedCycleId);
    if (!cycle) return "";
    return `
      <dialog class="account-dialog" id="cycle-dialog">
        <form method="dialog">
          <div class="account-dialog-header">
            <h2>${escapeHtml(cycle.name || "Projeto anterior")}</h2>
            <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
          </div>
          <dl class="goal-summary-list">
            ${profileValue("Situação", cycleStatusLabels[cycle.status] || cycle.status)}
            ${profileValue("Período", `${formatDate(cycle.startedAt)}${cycle.endedAt ? ` a ${formatDate(cycle.endedAt)}` : ""}`)}
            ${profileValue("Objetivo", goalTypeLabels[cycle.goalType] || cycle.goalType)}
            ${profileValue("Peso inicial", formatKg(cycle.startWeightKg))}
            ${profileValue("Peso final desejado", formatKg(cycle.goalWeightKg))}
            ${profileValue("Cintura inicial", formatCm(cycle.startWaistCm))}
            ${profileValue("Motivo do encerramento", cycle.endReason || "Não informado")}
          </dl>
          <div class="account-dialog-actions">
            <button class="button primary" data-close-cycle-dialog type="button">Fechar</button>
          </div>
        </form>
      </dialog>
    `;
  }
  const current = activeCycle(state);
  if (cycleDialogMode === "close" && current) {
    return `
      <dialog class="account-dialog" id="cycle-dialog">
        <form id="close-cycle-form">
          <div class="account-dialog-header">
            <h2>Encerrar projeto</h2>
            <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
          </div>
          <p class="muted">As medições e o planejamento serão preservados para consulta.</p>
          <div class="form-grid">
            <div class="field">
              <label for="cycle-close-status">Como este projeto terminou?</label>
              <select id="cycle-close-status" name="status" required>
                <option value="completed">Concluído</option>
                <option value="abandoned">Abandonado</option>
                <option value="expired">Expirado</option>
              </select>
            </div>
            <div class="field">
              <label for="cycle-ended-at">Data de encerramento</label>
              <input id="cycle-ended-at" name="endedAt" type="date" max="${todayISO()}" value="${todayISO()}" required />
            </div>
          </div>
          <div class="field">
            <label for="cycle-end-reason">Motivo ou observação</label>
            <textarea id="cycle-end-reason" name="endReason"></textarea>
          </div>
          <div class="account-dialog-actions">
            <button class="button" data-close-cycle-dialog type="button">Cancelar</button>
            <button class="button primary" type="submit">Encerrar projeto</button>
          </div>
        </form>
      </dialog>
    `;
  }

  const latest = [...(state.entries || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const reference = latest || state.profile;
  return `
    <dialog class="account-dialog" id="cycle-dialog">
      <form id="new-cycle-form">
        <div class="account-dialog-header">
          <h2>Iniciar novo projeto</h2>
          <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
        </div>
        <p class="muted">Revise a nova linha de base. Projetos anteriores continuarão disponíveis.</p>
        <div class="form-grid">
          <div class="field">
            <label for="cycle-name">Nome do projeto</label>
            <input id="cycle-name" name="name" maxlength="80" placeholder="Ex.: Manutenção 2027" required />
          </div>
          <div class="field">
            <label for="cycle-start-date">Data inicial</label>
            <input id="cycle-start-date" name="startDate" type="date" max="${todayISO()}" value="${todayISO()}" required />
          </div>
          <div class="field">
            <label for="cycle-start-weight">Peso inicial (kg)</label>
            <input id="cycle-start-weight" name="startWeightKg" inputmode="decimal"
              value="${escapeAttribute(reference.weightKg ?? reference.startWeightKg ?? "")}" required />
          </div>
          <div class="field">
            <label for="cycle-start-waist">Cintura inicial (cm)</label>
            <input id="cycle-start-waist" name="startWaistCm" inputmode="decimal"
              value="${escapeAttribute(reference.waistCm ?? reference.startWaistCm ?? "")}" />
          </div>
          <div class="field">
            <label for="cycle-start-neck">Pescoço inicial (cm)</label>
            <input id="cycle-start-neck" name="startNeckCm" inputmode="decimal"
              value="${escapeAttribute(reference.neckCm ?? reference.startNeckCm ?? "")}" />
          </div>
          <div class="field">
            <label for="cycle-start-hip">Quadril inicial (cm)</label>
            <input id="cycle-start-hip" name="startHipCm" inputmode="decimal"
              value="${escapeAttribute(reference.hipCm ?? reference.startHipCm ?? "")}" />
          </div>
          <div class="field">
            <label for="cycle-goal-type">Objetivo</label>
            <select id="cycle-goal-type" name="goalType" required>
              <option value="weight-loss">Emagrecimento</option>
              <option value="weight-gain">Ganho de peso</option>
              <option value="muscle-gain">Ganho de massa muscular</option>
              <option value="maintenance">Manutenção</option>
              <option value="recovery">Recuperação de peso</option>
              <option value="other">Outro</option>
            </select>
          </div>
          <div class="field">
            <label for="cycle-goal-weight">Peso final desejado (kg)</label>
            <input id="cycle-goal-weight" name="goalWeightKg" inputmode="decimal"
              value="${escapeAttribute(reference.weightKg ?? reference.startWeightKg ?? "")}" required />
          </div>
          <div class="field">
            <label for="cycle-weekly-change">Mudança semanal desejada (kg)</label>
            <input id="cycle-weekly-change" name="weeklyChangeGoalKg" inputmode="decimal" value="0.5" required />
          </div>
        </div>
        <div class="account-dialog-actions">
          <button class="button" data-close-cycle-dialog type="button">Cancelar</button>
          <button class="button primary" type="submit">Iniciar projeto</button>
        </div>
      </form>
    </dialog>
  `;
}

function renderProfileSummary(state, options) {
  const profile = state.profile;
  const currentCycle = activeCycle(state);
  const previousCycles = (state.cycles || [])
    .filter((cycle) => cycle.id !== currentCycle?.id)
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
  const preferred = (profile.preferredActivities || []).map(activityLabel).filter(Boolean);
  const activityMinutes = Number(profile.averageActivityDurationMinutes) || 0;
  const goalWeight = currentCycle ? getGoalWeight(profile) : null;
  const bodyFat = currentCycle ? resolveProfileBodyFat(profile) : null;
  const goalName = !currentCycle
    ? "Não definido"
    : profile.goalType === "other" && profile.customGoalLabel
    ? profile.customGoalLabel
    : goalTypeLabels[profile.goalType] || "Não definido";

  return `
    <div class="view-stack profile-summary">
      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">Ficha do perfil</p>
            <h2>${escapeHtml(profile.name || "Perfil corporal")}</h2>
            <p class="muted">Informações consolidadas do acompanhamento atual.</p>
          </div>
          ${options.canEditIdentity !== false ? `
            <button class="button primary" data-edit-profile-section="identity" type="button">
              <span class="profile-edit-label-full">Editar perfil</span>
              <span class="profile-edit-label-short">Editar</span>
            </button>
          ` : ""}
        </div>
        <dl class="profile-summary-grid">
          ${profileValue("Sexo", sexLabels[profile.sex])}
          ${profileValue("Data de nascimento", formatDate(profile.birthDate))}
          ${profileValue("Altura", formatCm(profile.heightCm))}
          ${options.canEditContact !== false ? profileValue("Telefone", formatPhone(state.contact?.phone || "")) : ""}
        </dl>
      </section>

      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">Projeto atual</p>
            <h2>${escapeHtml(currentCycle?.name || "Nenhum projeto ativo")}</h2>
          </div>
          <div class="button-row">
            ${currentCycle ? `<button class="button primary" data-edit-profile-section="baseline" type="button">Editar</button>` : ""}
          </div>
        </div>
        <dl class="profile-summary-grid">
          ${profileValue("Data inicial", currentCycle ? formatDate(profile.startDate) : "-")}
          ${profileValue("Peso inicial", currentCycle ? formatKg(profile.startWeightKg) : "-")}
          ${profileValue("Cintura inicial", currentCycle ? formatCm(profile.startWaistCm) : "-")}
          ${profileValue("Pescoço inicial", currentCycle ? formatCm(profile.startNeckCm) : "-")}
          ${profileValue("Quadril inicial", currentCycle ? formatCm(profile.startHipCm) : "-")}
          ${profileValue("Gordura corporal", formatPercent(bodyFat))}
          ${profileValue("Origem da gordura", currentCycle ? bodyFatMethodLabel(profile.startBodyFatMethod) : "-")}
        </dl>
        <div class="button-row profile-card-save">
          ${currentCycle
            ? `<span class="badge">${escapeHtml(cycleStatusLabels[currentCycle.status] || currentCycle.status)}</span>`
            : `<button class="button primary" id="start-new-cycle" type="button">Iniciar novo projeto</button>`}
        </div>
      </section>

      <section class="grid two">
        <article class="card">
          <div class="chart-header">
            <h2>Objetivo e planejamento</h2>
            ${currentCycle ? `<button class="button primary" data-edit-profile-section="goals" type="button">Editar</button>` : ""}
          </div>
          <dl class="goal-summary-list">
            ${profileValue("Objetivo", goalName)}
            ${profileValue("Peso final desejado", formatKg(goalWeight))}
            ${profileValue("Mudança semanal", !currentCycle
              ? "Não definida"
              : getProgressMode(profile) === "maintain"
              ? "Manutenção"
              : `${formatKg(Number(profile.weeklyChangeGoalKg))} por semana`)}
            ${profileValue("Prazo", currentCycle && profile.goalDeadlineMonths
              ? `${formatDecimal(profile.goalDeadlineMonths, 1)} meses`
              : "Sem prazo definido")}
          </dl>
        </article>
        <article class="card">
          <div class="chart-header">
            <h2>Atividades físicas</h2>
            <button class="button primary" data-edit-profile-section="activities" type="button">Editar</button>
          </div>
          <dl class="goal-summary-list">
            ${profileValue("Meta semanal", `${profile.weeklyActivityGoalDays || 3} dias ativos`)}
            ${profileValue("Meta de tempo", activityMinutes
              ? `${activityMinutes} minutos por dia`
              : "Não utilizada")}
            ${profileValue("Atividades preferidas", preferred.join(", ") || "Nenhuma selecionada")}
          </dl>
        </article>
      </section>

      ${previousCycles.length ? `
        <section class="card">
          <div class="chart-header">
            <div>
              <h2>Projetos anteriores</h2>
              <p class="muted">Ciclos preservados sem interferir no acompanhamento atual.</p>
            </div>
          </div>
          <div class="cycle-list">
            ${previousCycles.map((cycle) => `
              <article class="cycle-list-item">
                <div>
                  <strong>${escapeHtml(cycle.name || "Ciclo de acompanhamento")}</strong>
                  <small>${formatDate(cycle.startedAt)}${cycle.endedAt ? ` a ${formatDate(cycle.endedAt)}` : ""}</small>
                </div>
                <span class="badge">${escapeHtml(cycleStatusLabels[cycle.status] || cycle.status)}</span>
                <button class="button" data-view-cycle="${escapeAttribute(cycle.id)}" type="button">Consultar</button>
              </article>
            `).join("")}
          </div>
        </section>
      ` : ""}
      ${renderCycleDialog(state)}
    </div>
  `;
}

function renderBasicProfileEditor(state, options) {
  const p = state.profile;
  const baselineLocked = state.activeCycleId
    && (p.baselineLocked === true || (state.entries || []).length > 0);
  return `
    <form class="form profile-form" id="basic-profile-form">
      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">Ficha do perfil</p>
            <h2>Dados pessoais</h2>
            <p class="muted">${state.activeCycleId
              ? "Edite somente seus dados pessoais e de contato."
              : "Medidas, metas e planejamento serão definidos ao criar um projeto."}</p>
          </div>
        </div>
        <div class="form-grid">
          <div class="field">
            <label for="basic-profile-name">Nome completo</label>
            <input id="basic-profile-name" name="name" required minlength="2"
              value="${escapeAttribute(p.name || "")}" />
          </div>
          <div class="field">
            <label for="basic-profile-birth-date">Data de nascimento</label>
            <input id="basic-profile-birth-date" name="birthDate" type="date" max="${todayISO()}"
              value="${escapeAttribute(p.birthDate || "")}" required />
          </div>
          <div class="field">
            <label for="basic-profile-sex">Sexo</label>
            <select id="basic-profile-sex" name="sex" ${baselineLocked ? "disabled" : ""}>
              <option value="" ${!p.sex ? "selected" : ""}>Prefiro informar depois</option>
              <option value="male" ${p.sex === "male" ? "selected" : ""}>Masculino</option>
              <option value="female" ${p.sex === "female" ? "selected" : ""}>Feminino</option>
            </select>
          </div>
          <div class="field">
            <label for="basic-profile-height">Altura (cm)</label>
            <input id="basic-profile-height" name="heightCm" inputmode="decimal" ${baselineLocked ? "disabled" : ""}
              value="${escapeAttribute(p.heightCm ?? "")}" />
          </div>
          ${options.canEditContact !== false ? `
            <div class="field">
              <label for="basic-profile-phone">Telefone</label>
              <input id="basic-profile-phone" name="phone" type="tel"
                value="${escapeAttribute(formatPhone(state.contact?.phone || ""))}" />
            </div>
          ` : ""}
        </div>
        <div class="button-row profile-card-save">
          <button class="button" id="cancel-basic-profile" type="button">Cancelar</button>
          <button class="button primary" type="submit">Salvar</button>
        </div>
      </section>
    </form>
  `;
}

function renderActivityProfileEditor(state) {
  const p = state.profile;
  return `
    <form class="form profile-form" id="activity-profile-form">
      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">Atividades físicas</p>
            <h2>Preferências e meta semanal</h2>
            <p class="muted">Essas configurações podem ser utilizadas mesmo sem um projeto corporal ativo.</p>
          </div>
        </div>
        <div class="form-grid">
          <div class="field activity-goal-field">
            <label for="activity-profile-days">Meta semanal de dias ativos</label>
            <input id="activity-profile-days" name="weeklyActivityGoalDays" type="number" min="1" max="7"
              value="${escapeAttribute(p.weeklyActivityGoalDays ?? 3)}" />
          </div>
          <div class="field">
            <span class="field-label">Meta de tempo</span>
            <label class="toggle-option">
              <input id="activity-profile-track-duration" name="trackActivityDuration" type="checkbox"
                ${Number(p.averageActivityDurationMinutes) > 0 ? "checked" : ""} />
              <span>
                <strong>Acompanhar também meta de tempo</strong>
                <small>Opcional. Ative para comparar minutos planejados e realizados.</small>
              </span>
            </label>
          </div>
          <div class="field activity-duration-goal" ${Number(p.averageActivityDurationMinutes) > 0 ? "" : "hidden"}>
            <label for="activity-profile-duration">Duração média pretendida por dia (minutos)</label>
            <input id="activity-profile-duration" name="averageActivityDurationMinutes" type="number"
              min="1" max="1440" ${Number(p.averageActivityDurationMinutes) > 0 ? "" : "disabled"}
              value="${escapeAttribute(p.averageActivityDurationMinutes ?? "")}" />
          </div>
        </div>
        <div class="field">
          <label>Atividades preferidas</label>
          ${preferredActivityPicker(p.preferredActivities || [])}
        </div>
        <div class="button-row profile-card-save">
          <button class="button" id="cancel-activity-profile" type="button">Cancelar</button>
          <button class="button primary" type="submit">Salvar</button>
        </div>
      </section>
    </form>
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
    startBodyFatMethod: normalizeBodyFatMethod(value("startBodyFatMethod", currentProfile.startBodyFatMethod)),
    startBodyFatManual: bodyFatMethodIsEstimated(value("startBodyFatMethod", currentProfile.startBodyFatMethod))
      ? null
      : toNumber(value("startBodyFatManual", currentProfile.startBodyFatManual)),
    targetBmi: toNumber(data.get("targetBmi")) || 24.9,
    goalWeightKg: toNumber(data.get("goalWeightKg")),
    goalType: data.get("goalType") || "",
    customGoalLabel: data.get("customGoalLabel")?.trim() || "",
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
    goalDeadlineMode: data.get("goalDeadlineMode") === "custom" ? "custom" : "auto",
    weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
    averageActivityDurationMinutes: data.has("trackActivityDuration")
      ? toNumber(data.get("averageActivityDurationMinutes"))
      : null,
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
  const canEditIdentity = options.canEditIdentity !== false;
  const editing = options.forceEdit === true ? "identity" : profileEditMode;
  if (!editing) return renderProfileSummary(state, { canEditContact, canEditIdentity });
  if (!state.activeCycleId && !canEditIdentity) {
    profileEditMode = false;
    return renderProfileSummary(state, { canEditContact, canEditIdentity });
  }
  if (editing === "activities") {
    return renderActivityProfileEditor(state);
  }
  if (!state.activeCycleId || editing === "identity") {
    return renderBasicProfileEditor(state, { canEditContact, canEditIdentity });
  }
  const activeEntries = state.activeCycleId
    ? state.entries.filter((entry) => !entry.cycleId || entry.cycleId === state.activeCycleId)
    : [];
  const baselineLocked = p.baselineLocked === true || activeEntries.length > 0;
  const baselineDisabled = baselineLocked ? "disabled" : "";
  const identityReadOnly = canEditIdentity ? "" : "readonly aria-readonly=\"true\"";
  const suggestedGoal = getSuggestedGoalWeight(p);
  const previewProfile = resolveGoalTiming({
    ...p,
    goalWeightKg: p.goalWeightKg ?? suggestedGoal,
    goalDeadlineMode: p.goalDeadlineMode === "custom" ? "custom" : "auto"
  });

  return `
    <form class="form profile-form" id="profile-form" data-profile-editor="${escapeAttribute(editing)}">
      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">${editing === "baseline" ? "Projeto atual" : "Objetivo e planejamento"}</p>
            <h2>${editing === "baseline" ? "Editar linha de base" : "Editar meta"}</h2>
          </div>
        </div>
        ${editing === "baseline" && baselineLocked ? `
          <p class="form-notice">Os dados da linha de base estão bloqueados porque o acompanhamento já possui medições. Metas, prazo e demais dados do perfil continuam editáveis.</p>
        ` : editing === "baseline" ? `
          <p class="form-notice">Os dados iniciais poderão ser ajustados até o primeiro registro de acompanhamento.</p>
        ` : ""}
        ${editing === "baseline" && !canEditIdentity ? `
          <p class="form-notice">Dados de identidade pertencem ao paciente e estão disponíveis somente para consulta. Você pode editar as informações corporais e o planejamento.</p>
        ` : ""}
        <div class="form-grid">
          <div class="field">
            <label for="name">Nome completo</label>
            <input id="name" name="name" required minlength="2" autocomplete="name" ${identityReadOnly} value="${escapeAttribute(p.name || "")}" />
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
            <input id="birthDate" name="birthDate" type="date" max="${todayISO()}" ${identityReadOnly} value="${escapeAttribute(p.birthDate || "")}" />
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
            <span class="help-text">Usado na estimativa feminina por medidas e opcional no acompanhamento geral.</span>
          </div>
          <div class="field">
            <label for="startBodyFatMethod">Origem da gordura corporal</label>
            <select id="startBodyFatMethod" name="startBodyFatMethod" ${baselineDisabled}>
              ${bodyFatMethods.map((method) => `
                <option value="${method.value}" ${method.value === normalizeBodyFatMethod(p.startBodyFatMethod) ? "selected" : ""}>${method.label}</option>
              `).join("")}
            </select>
          </div>
          <div class="field" data-profile-body-fat-value>
            <label for="startBodyFatManual">Percentual inicial informado (%)</label>
            <input id="startBodyFatManual" name="startBodyFatManual" inputmode="decimal" ${baselineDisabled}
              value="${escapeAttribute(p.startBodyFatManual ?? "")}" />
            <span class="help-text">Preencha quando o resultado vier de medição ou avaliação externa.</span>
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
          ${editing === "baseline"
            ? `<button class="button danger" id="close-cycle-from-editor" type="button">Encerrar projeto</button>`
            : ""}
          <button class="button" id="cancel-profile-edit" type="button">Cancelar</button>
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
            <label class="toggle-option">
              <input id="trackActivityDuration" name="trackActivityDuration" type="checkbox"
                ${Number(p.averageActivityDurationMinutes) > 0 ? "checked" : ""} />
              <span>
                <strong>Acompanhar também meta de tempo</strong>
                <small>Opcional. Ative para comparar minutos planejados e realizados.</small>
              </span>
            </label>
          </div>
          <div class="field activity-duration-goal" ${Number(p.averageActivityDurationMinutes) > 0 ? "" : "hidden"}>
            <label for="averageActivityDurationMinutes">Duração média pretendida por dia (minutos)</label>
            <input id="averageActivityDurationMinutes" name="averageActivityDurationMinutes" type="number"
              min="1" max="1440" ${Number(p.averageActivityDurationMinutes) > 0 ? "" : "disabled"}
              value="${escapeAttribute(p.averageActivityDurationMinutes ?? "")}" />
            <span class="help-text">A meta semanal será calculada pelos dias ativos.</span>
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

function configureProfileSectionEditor(form) {
  const editor = form.dataset.profileEditor;
  const baselineFields = new Set([
    "startDate", "startWeightKg", "startWaistCm", "startNeckCm",
    "startHipCm", "startBodyFatMethod", "startBodyFatManual"
  ]);
  const goalFields = new Set([
    "goalType", "customGoalLabel", "targetBmi", "goalWeightKg",
    "weeklyChangeGoalKg", "goalDeadlineMonths", "goalDeadlineMode"
  ]);
  const visibleFields = editor === "baseline" ? baselineFields : goalFields;
  const sections = form.querySelectorAll(":scope > section.card");
  if (sections[0]) sections[0].hidden = editor === "activities";
  if (sections[1]) sections[1].hidden = editor !== "activities";
  sections[0]?.querySelectorAll(".field").forEach((field) => {
    const controls = [...field.querySelectorAll("[name]")];
    field.hidden = controls.length > 0 && !controls.some((control) => visibleFields.has(control.name));
  });
  const goalPreview = document.getElementById("profile-goal-preview");
  const planPreview = document.getElementById("profile-plan-preview");
  if (goalPreview) goalPreview.hidden = editor !== "goals";
  if (planPreview) planPreview.hidden = editor !== "goals";
}

export function bindProfile(state, persist, render) {
  const activityForm = document.getElementById("activity-profile-form");
  if (activityForm) {
    const setDurationVisibility = () => {
      const enabled = activityForm.elements.trackActivityDuration.checked;
      const field = activityForm.querySelector(".activity-duration-goal");
      const input = activityForm.elements.averageActivityDurationMinutes;
      field.hidden = !enabled;
      input.disabled = !enabled;
    };
    activityForm.elements.trackActivityDuration.addEventListener("change", setDurationVisibility);
    document.getElementById("cancel-activity-profile")?.addEventListener("click", () => {
      profileEditMode = false;
      render();
    });
    activityForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const validation = await validateNumericFields(activityForm, {
        weeklyActivityGoalDays: { rule: "activityDays", label: "Dias ativos", required: true },
        averageActivityDurationMinutes: { rule: "activityMinutes", label: "Duração média" }
      });
      if (!validation.valid) return;
      const data = new FormData(activityForm);
      state.profile = {
        ...state.profile,
        weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
        averageActivityDurationMinutes: data.has("trackActivityDuration")
          ? toNumber(data.get("averageActivityDurationMinutes"))
          : null,
        preferredActivities: data.getAll("preferredActivities")
      };
      profileEditMode = false;
      persist({ type: "profile-plan" });
      showToast("Preferências de atividades atualizadas.");
      render();
    });
    return;
  }
  const basicForm = document.getElementById("basic-profile-form");
  if (basicForm) {
    document.getElementById("cancel-basic-profile")?.addEventListener("click", () => {
      profileEditMode = false;
      render();
    });
    basicForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const heightField = event.currentTarget.elements.heightCm;
      if (heightField.value && !await resolveHeightInput(heightField)) return;
      if (data.has("phone") && !phoneIsValid(data.get("phone"))) {
        showToast("Informe um telefone válido, com DDD.");
        return;
      }
      const validation = await validateNumericFields(event.currentTarget, {
        heightCm: { rule: "heightCm", label: "Altura" }
      });
      if (!validation.valid) return;
      state.profile = {
        ...state.profile,
        name: String(data.get("name") || "").trim(),
        birthDate: data.get("birthDate"),
        sex: data.has("sex") ? data.get("sex") : state.profile.sex,
        heightCm: data.has("heightCm") ? toNumber(data.get("heightCm")) : state.profile.heightCm
      };
      if (data.has("phone")) {
        state.contact = { ...(state.contact || {}), phone: normalizePhone(data.get("phone")) };
      }
      profileEditMode = false;
      persist({ type: "profile-plan" });
      showToast("Perfil atualizado.");
      render();
    });
    return;
  }
  const form = document.getElementById("profile-form");
  if (!form) {
    document.querySelectorAll("[data-edit-profile-section]").forEach((button) => {
      button.addEventListener("click", () => {
        profileEditMode = button.dataset.editProfileSection;
        render();
      });
    });
    document.getElementById("edit-profile")?.addEventListener("click", () => {
      profileEditMode = "identity";
      render();
    });
    const openCycleDialog = (mode) => {
      cycleDialogMode = mode;
      render();
    };
    const closeCycleDialog = () => {
      cycleDialogMode = null;
      selectedCycleId = null;
      render();
    };
    document.getElementById("start-new-cycle")?.addEventListener("click", () => openCycleDialog("new"));
    document.querySelectorAll("[data-view-cycle]").forEach((button) => {
      button.addEventListener("click", () => {
        selectedCycleId = button.dataset.viewCycle;
        openCycleDialog("view");
      });
    });
    document.querySelectorAll("[data-close-cycle-dialog]").forEach((button) => {
      button.addEventListener("click", closeCycleDialog);
    });
    const cycleDialog = document.getElementById("cycle-dialog");
    if (cycleDialog) {
      cycleDialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        closeCycleDialog();
      });
      cycleDialog.showModal();
    }
    document.getElementById("close-cycle-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      if (!await confirmAction({
        title: "Encerrar projeto?",
        message: "O histórico será preservado, mas novos registros não serão associados a este projeto.",
        confirmLabel: "Encerrar",
        tone: "warning"
      })) return;
      Object.assign(state, closeActiveCycle(state, data.get("status"), {
        endedAt: data.get("endedAt"),
        endReason: data.get("endReason")
      }));
      cycleDialogMode = null;
      persist({ type: "profile-plan" });
      showToast("Projeto encerrado.");
      render();
    });
    document.getElementById("new-cycle-form")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      const startWeightKg = toNumber(data.get("startWeightKg"));
      const goalWeightKg = toNumber(data.get("goalWeightKg"));
      const weeklyChangeGoalKg = toNumber(data.get("weeklyChangeGoalKg"));
      if (![startWeightKg, goalWeightKg, weeklyChangeGoalKg].every(Number.isFinite)) {
        showToast("Revise peso inicial, peso final e mudança semanal.");
        return;
      }
      if (data.get("goalType") === "weight-loss" && goalWeightKg >= startWeightKg) {
        showToast("Para emagrecimento, o peso final deve ser menor que o peso inicial.");
        return;
      }
      if (["weight-gain", "recovery"].includes(data.get("goalType")) && goalWeightKg <= startWeightKg) {
        showToast("Para ganho ou recuperação, o peso final deve ser maior que o peso inicial.");
        return;
      }
      const next = startNewCycle(state, {
        name: data.get("name"),
        startDate: data.get("startDate"),
        startWeightKg,
        startWaistCm: toNumber(data.get("startWaistCm")),
        startNeckCm: toNumber(data.get("startNeckCm")),
        startHipCm: toNumber(data.get("startHipCm")),
        startBodyFatMethod: "circumference",
        startBodyFatManual: null,
        goalType: data.get("goalType"),
        goalWeightKg,
        weeklyChangeGoalKg,
        weeklyLossGoalKg: weeklyChangeGoalKg,
        goalDeadlineMode: "auto",
        goalDeadlineMonths: null
      });
      const resolvedProfile = resolveGoalTiming(next.profile);
      Object.assign(state, {
        ...next,
        profile: resolvedProfile,
        goalPlan: createDefaultMonthlyPlan(resolvedProfile)
      });
      cycleDialogMode = null;
      persist({ type: "profile-plan" });
      showToast("Novo projeto iniciado.");
      render();
    });
    return;
  }
  const heightField = form.elements.heightCm;
  const goalWeightField = form.elements.goalWeightKg;
  const weeklyField = form.elements.weeklyChangeGoalKg;
  const deadlineField = form.elements.goalDeadlineMonths;
  const mobileSave = document.getElementById("profile-mobile-save");
  let goalPlannerTimer = null;
  profileHasPendingChanges = false;
  const bodyFatInputLocked = form.elements.startBodyFatManual?.disabled === true;

  const updateBodyFatFields = () => {
    const estimated = bodyFatMethodIsEstimated(form.elements.startBodyFatMethod?.value);
    const field = form.querySelector("[data-profile-body-fat-value]");
    const input = form.elements.startBodyFatManual;
    if (field) field.hidden = estimated;
    if (input) {
      input.disabled = bodyFatInputLocked || estimated;
      input.required = !estimated;
    }
  };
  form.elements.startBodyFatMethod?.addEventListener("change", updateBodyFatFields);
  updateBodyFatFields();
  configureProfileSectionEditor(form);

  const setDurationGoalVisibility = () => {
    const enabled = form.elements.trackActivityDuration?.checked === true;
    const field = form.querySelector(".activity-duration-goal");
    const input = form.elements.averageActivityDurationMinutes;
    if (field) field.hidden = !enabled;
    if (input) input.disabled = !enabled;
  };

  const markDirty = () => {
    profileHasPendingChanges = true;
    mobileSave.hidden = false;
  };

  const updateGoalPlanner = (sourceName = "") => {
    const draft = readProfileForm(form, state.profile);
    const maintenance = getProgressMode(draft) === "maintain";
    const customDeadline = draft.goalDeadlineMode === "custom";
    weeklyField.readOnly = customDeadline || maintenance;
    deadlineField.readOnly = !customDeadline || maintenance;
    if (sourceName !== "weeklyChangeGoalKg" && document.activeElement !== weeklyField) {
      weeklyField.value = draft.weeklyChangeGoalKg || "";
    }
    if (sourceName !== "goalDeadlineMonths" && document.activeElement !== deadlineField) {
      deadlineField.value = draft.goalDeadlineMonths
        ? Number(draft.goalDeadlineMonths).toFixed(1)
        : "";
    }
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

  heightField?.addEventListener("blur", async () => {
    if (await resolveHeightInput(heightField)) updateGoalPlanner();
  });
  document.getElementById("apply-goal-suggestion")?.addEventListener("click", applyGoalSuggestion);
  form.elements.trackActivityDuration?.addEventListener("change", () => {
    setDurationGoalVisibility();
    markDirty();
  });
  document.getElementById("close-cycle-from-editor")?.addEventListener("click", async () => {
    if (profileHasPendingChanges && !await confirmAction({
      title: "Descartar alterações antes de encerrar?",
      message: "As modificações feitas na linha de base não serão salvas.",
      confirmLabel: "Descartar e continuar",
      tone: "warning"
    })) return;
    profileHasPendingChanges = false;
    profileEditMode = false;
    cycleDialogMode = "close";
    render();
  });
  document.getElementById("cancel-profile-edit")?.addEventListener("click", async () => {
    if (profileHasPendingChanges && !await confirmAction({
      title: "Descartar alterações?",
      message: "As modificações feitas no perfil não serão salvas.",
      confirmLabel: "Descartar",
      tone: "warning"
    })) return;
    profileHasPendingChanges = false;
    profileEditMode = false;
    render();
  });
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
      if (["weeklyChangeGoalKg", "goalDeadlineMonths"].includes(event.target.name)) {
        const sourceName = event.target.name;
        window.clearTimeout(goalPlannerTimer);
        goalPlannerTimer = window.setTimeout(
          () => updateGoalPlanner(sourceName),
          180
        );
        return;
      }
      updateGoalPlanner(event.target.name);
    }
  });
  updateGoalPlanner();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!await resolveHeightInput(heightField)) return;
    const data = new FormData(form);
    const phone = data.get("phone");
    if (phone !== null && !phoneIsValid(phone)) {
      showToast("Informe um telefone válido, com DDD.");
      form.elements.phone?.focus();
      return;
    }

    const deadlineMode = data.get("goalDeadlineMode") === "custom" ? "custom" : "auto";
    const maintenanceGoal = data.get("goalType") === "maintenance";
    const validation = await validateNumericFields(form, {
      heightCm: { rule: "heightCm", label: "Altura", required: true },
      startWeightKg: { rule: "weightKg", label: "Peso inicial", required: true },
      startWaistCm: { rule: "circumferenceCm", label: "Cintura inicial" },
      startNeckCm: { rule: "circumferenceCm", label: "Pescoço inicial" },
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

    const nextProfile = readProfileForm(form, state.profile);
    if (!goalDirectionIsValid(nextProfile, goalWeightField)) {
      showToast("Revise a direção da meta.");
      return;
    }
    if (deadlineMode === "custom" && getProgressMode(nextProfile) !== "maintain") {
      const accepted = await confirmAction({
        title: "Aplicar novo ritmo?",
        message: `Para cumprir esse prazo, o ritmo será de ${formatKg(Number(nextProfile.weeklyChangeGoalKg))} por semana.`,
        confirmLabel: "Aplicar",
        tone: "warning"
      });
      if (!accepted) return;
    }

    state.profile = nextProfile;
    if (phone !== null) state.contact = { ...(state.contact || {}), phone: normalizePhone(phone) };
    state.goalPlan = createDefaultMonthlyPlan(nextProfile);
    profileHasPendingChanges = false;
    const savedSection = form.dataset.profileEditor;
    profileEditMode = false;
    persist({ type: "profile-plan" });
    showToast(savedSection === "baseline" ? "Linha de base atualizada." : "Objetivo e planejamento atualizados.");
    render();
  });
}

export function resetProfileMode() {
  profileHasPendingChanges = false;
  profileEditMode = false;
  cycleDialogMode = null;
  selectedCycleId = null;
}
