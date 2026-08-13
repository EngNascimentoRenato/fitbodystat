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
  enrichEntries,
  getGoalDirection,
  getGoalWeight,
  getLatestEntry,
  getSuggestedMilestones,
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
import { objectiveHelpButton } from "../components/objective-guide.js";
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
  cycleHasMeasurements,
  startNewCycle
} from "../models/cycle-model.js";
import {
  circumferenceCatalog,
  defaultCircumferenceKeys,
  normalizeCircumferenceKeys
} from "../data/circumference-catalog.js";
import {
  bindSkinfoldCalculator,
  parseSkinfoldData,
  skinfoldCalculator
} from "../components/skinfold-calculator.js";

let profileHasPendingChanges = false;
let profileEditMode = false;
let cycleDialogMode = null;
let selectedCycleId = null;
let newCycleStep = 1;
let newCycleDraft = null;
let newCycleHistoryGuard = false;
let newCycleExitPending = false;
let activeProfileRender = null;

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

function planningSnapshot(profile = {}) {
  return {
    goalType: profile.goalType || "",
    customGoalLabel: profile.customGoalLabel || "",
    goalWeightKg: profile.goalWeightKg ?? null,
    targetBmi: profile.targetBmi ?? null,
    weeklyChangeGoalKg: profile.weeklyChangeGoalKg ?? null,
    goalDeadlineMonths: profile.goalDeadlineMonths ?? null,
    goalDeadlineMode: profile.goalDeadlineMode || "auto",
    milestoneConfig: profile.milestoneConfig || null
  };
}

function planningChanged(previous, next) {
  return JSON.stringify(previous) !== JSON.stringify(next);
}

const cycleStatusLabels = {
  draft: "Rascunho",
  active: "Ativo",
  completed: "Concluído",
  abandoned: "Abandonado",
  expired: "Expirado",
  replaced: "Substituído",
  archived: "Arquivado"
};

function renderCircumferenceTracking(profile, baselineDisabled = "") {
  const selected = new Set(normalizeCircumferenceKeys(
    profile.trackedCircumferences || defaultCircumferenceKeys
  ));
  const startValues = profile.startCircumferences || {};
  const options = circumferenceCatalog.filter((item) =>
    !item.calculationOnly && item.key !== "waist"
  );
  const baselineItems = circumferenceCatalog.filter((item) =>
    item.key === "hip" || (!item.legacyField && !item.calculationOnly)
  );
  return `
    <div class="field circumference-tracking-field">
      <input type="hidden" name="trackedCircumferencesEditor" value="true" />
      <label>Medidas adicionais acompanhadas</label>
      <span class="help-text">A cintura faz parte de todos os projetos.</span>
      <div class="circumference-picker">
        ${options.map((item) => `
          <label>
            <input type="checkbox" name="trackedCircumferences" value="${item.key}"
              ${selected.has(item.key) ? "checked" : ""} />
            <span>${item.label}</span>
          </label>
        `).join("")}
      </div>
      <span class="help-text">As medidas selecionadas aparecerão nos próximos registros.</span>
      <div class="circumference-baseline-values">
        ${baselineItems.map((item) => item.bilateral ? `
          <fieldset class="field bilateral-circumference measurement-compact-item"
            data-start-circumference="${item.key}"
            ${selected.has(item.key) ? "" : "hidden"}>
            <legend>${item.label} inicial (cm)</legend>
            <div class="bilateral-circumference-grid">
              <div class="field">
                <label for="startCircumference_${item.key}_right">Direito</label>
                <input id="startCircumference_${item.key}_right"
                  name="startCircumference_${item.key}_right" inputmode="decimal" ${baselineDisabled}
                  ${baselineDisabled ? 'data-baseline-locked="true"' : ""}
                  value="${escapeAttribute(
                    typeof startValues[item.key] === "object"
                      ? startValues[item.key]?.right ?? ""
                      : startValues[item.key] ?? ""
                  )}" />
              </div>
              <div class="field">
                <label for="startCircumference_${item.key}_left">Esquerdo</label>
                <input id="startCircumference_${item.key}_left"
                  name="startCircumference_${item.key}_left" inputmode="decimal" ${baselineDisabled}
                  ${baselineDisabled ? 'data-baseline-locked="true"' : ""}
                  value="${escapeAttribute(
                    typeof startValues[item.key] === "object"
                      ? startValues[item.key]?.left ?? ""
                      : ""
                  )}" />
              </div>
            </div>
          </fieldset>
        ` : `
          <div class="field measurement-compact-item"
            data-start-circumference="${item.key}"
            ${item.key === "hip" ? "data-new-cycle-estimated-field" : ""}
            ${selected.has(item.key) ? "" : "hidden"}>
            <label for="startCircumference_${item.key}">${item.label} inicial (cm) ${item.helpKey ? measurementHelpButton(item.helpKey) : ""}</label>
            <input id="startCircumference_${item.key}"
              name="${item.legacyField || `startCircumference_${item.key}`}"
              inputmode="decimal" ${baselineDisabled}
              ${baselineDisabled ? 'data-baseline-locked="true"' : ""}
              value="${escapeAttribute(
                item.legacyField
                  ? profile[`start${item.legacyField[0].toUpperCase()}${item.legacyField.slice(1)}`] ?? ""
                  : startValues[item.key] ?? ""
              )}" />
            ${item.key === "hip"
              ? `<span class="help-text" data-hip-required-help
                  ${profile.sex === "female" && bodyFatMethodIsEstimated(profile.startBodyFatMethod) ? "" : "hidden"}>
                  Obrigatório na estimativa feminina por circunferências.
                </span>`
              : ""}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

function renderBodyFatAcquisitionDialog(draft) {
  const method = normalizeBodyFatMethod(draft.startBodyFatMethod);
  const estimated = bodyFatMethodIsEstimated(method);
  const female = draft.sex === "female";
  return `
    <dialog class="account-dialog body-fat-acquisition-dialog" id="body-fat-acquisition-dialog">
      <div class="body-fat-acquisition-content">
        <div class="account-dialog-header">
          <div>
            <p class="eyebrow">Percentual de gordura corporal</p>
            <h2>Informar percentual de gordura</h2>
          </div>
          <button class="icon-button" data-close-body-fat-dialog type="button" aria-label="Fechar">&times;</button>
        </div>
        <div class="field">
          <label for="body-fat-acquisition-method">Método de obtenção do percentual</label>
          <select id="body-fat-acquisition-method">
            ${bodyFatMethods.map((item) => `
              <option value="${item.value}" ${item.value === method ? "selected" : ""}>${item.label}</option>
            `).join("")}
          </select>
        </div>
        <section data-body-fat-circumference ${estimated ? "" : "hidden"}>
          <p class="help-text">
            A estimativa usa a referencia corporal <strong>${escapeHtml(sexLabels[draft.sex] || "nao informada")}</strong> do perfil.
            ${female
              ? "Informe altura, cintura, pescoco e quadril."
              : "Informe altura, cintura e pescoco."}
          </p>
          <div class="form-grid compact-measurement-grid">
            <div class="field">
              <label for="body-fat-height">Altura (cm)</label>
              <input id="body-fat-height" inputmode="decimal" value="${escapeAttribute(draft.heightCm ?? "")}" />
            </div>
            <div class="field">
              <label for="body-fat-waist">Cintura (cm) ${measurementHelpButton("waist")}</label>
              <input id="body-fat-waist" inputmode="decimal" value="${escapeAttribute(draft.startWaistCm ?? "")}" />
            </div>
            <div class="field">
              <label for="body-fat-neck">Pescoco (cm) ${measurementHelpButton("neck")}</label>
              <input id="body-fat-neck" inputmode="decimal" value="${escapeAttribute(draft.startNeckCm ?? "")}" />
            </div>
            ${female ? `
              <div class="field">
                <label for="body-fat-hip">Quadril (cm) ${measurementHelpButton("hip")}</label>
                <input id="body-fat-hip" inputmode="decimal" value="${escapeAttribute(draft.startHipCm ?? "")}" />
              </div>
            ` : ""}
          </div>
        </section>
        <section data-body-fat-manual ${estimated ? "hidden" : ""}>
          <div class="field">
            <label for="body-fat-acquisition-value">Percentual obtido (%)</label>
            <input id="body-fat-acquisition-value" inputmode="decimal"
              value="${escapeAttribute(draft.startBodyFatManual ?? "")}" />
            <span class="help-text">Informe o resultado fornecido pelo equipamento, exame ou profissional.</span>
          </div>
          <div data-body-fat-skinfold ${method === "caliper" ? "" : "hidden"}>
            ${skinfoldCalculator("new-cycle", draft, draft.startSkinfolds)}
          </div>
        </section>
        <div class="body-fat-acquisition-result" id="body-fat-acquisition-result"></div>
        <div class="account-dialog-actions">
          <button class="button" data-close-body-fat-dialog type="button">Cancelar</button>
          <button class="button primary" id="apply-body-fat-acquisition" type="button">Usar dados</button>
        </div>
      </div>
    </dialog>
  `;
}

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
    title: cycleDialogMode === "new" ? "Abandonar criação do projeto?" : "Descartar alterações?",
    message: cycleDialogMode === "new"
      ? "Os dados preenchidos nas duas etapas serão apagados."
      : "Há alterações não salvas no perfil.",
    confirmLabel: cycleDialogMode === "new" ? "Abandonar" : "Descartar",
    tone: "warning"
  })) {
    profileHasPendingChanges = false;
    cycleDialogMode = null;
    newCycleDraft = null;
    newCycleStep = 1;
    newCycleHistoryGuard = false;
    location.hash = link.hash;
    return;
  }
});

window.addEventListener("popstate", async () => {
  if (!cycleDialogMode || !newCycleHistoryGuard) return;
  if (newCycleExitPending) {
    newCycleExitPending = false;
    newCycleHistoryGuard = false;
    return;
  }
  if (newCycleStep === 2) {
    newCycleStep = 1;
    history.pushState({ fitBodyStatNewCycle: true }, "", location.href);
    activeProfileRender?.();
    return;
  }
  const discard = await confirmAction({
    title: "Abandonar criação do projeto?",
    message: "Os dados preenchidos nas duas etapas serão apagados.",
    confirmLabel: "Abandonar",
    tone: "warning"
  });
  if (!discard) {
    history.pushState({ fitBodyStatNewCycle: true }, "", location.href);
    return;
  }
  cycleDialogMode = null;
  newCycleDraft = null;
  newCycleHistoryGuard = false;
  profileHasPendingChanges = false;
  activeProfileRender?.();
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

function renderNewCycleBaselinePreview(profile) {
  const bmi = calculateBmi(profile.startWeightKg, profile.heightCm);
  const bodyFat = resolveProfileBodyFat(profile);
  const estimated = bodyFatMethodIsEstimated(profile.startBodyFatMethod);
  return `
    <div class="grid two">
      <article class="mini-stat">
        <span>IMC inicial</span>
        <strong>${formatDecimal(bmi, 1)}</strong>
        <small>${escapeHtml(classifyBmi(bmi))}</small>
      </article>
      <article class="mini-stat">
        <span>Gordura corporal</span>
        <strong>${formatPercent(bodyFat)}</strong>
        <small>${bodyFat
          ? escapeHtml(estimated ? "Estimativa por circunferências" : bodyFatMethodLabel(profile.startBodyFatMethod))
          : "Complete os dados necessários"}</small>
      </article>
    </div>
    <p class="muted">${estimated
      ? "A estimativa usa as circunferências e a referência corporal selecionada. Ela não substitui uma avaliação profissional."
      : "O percentual informado será utilizado no lugar da estimativa por circunferências."}</p>
  `;
}

function initialNewCycleDraft(state) {
  const latest = [...(state.entries || [])].sort((a, b) => b.date.localeCompare(a.date))[0];
  const reference = latest || state.profile;
  return {
    name: "",
    startDate: todayISO(),
    sex: state.profile.sex || "",
    birthDate: state.profile.birthDate || "",
    heightCm: state.profile.heightCm ?? null,
    startWeightKg: reference.weightKg ?? reference.startWeightKg ?? null,
    startWaistCm: reference.waistCm ?? reference.startWaistCm ?? null,
    startNeckCm: reference.neckCm ?? reference.startNeckCm ?? null,
    startHipCm: reference.hipCm ?? reference.startHipCm ?? null,
    startBodyFatMethod: normalizeBodyFatMethod(reference.bodyFatMethod || reference.startBodyFatMethod),
    startBodyFatManual: reference.bodyFatManual ?? reference.startBodyFatManual ?? null,
    startSkinfolds: reference.skinfolds ?? reference.startSkinfolds ?? null,
    trackedCircumferences: normalizeCircumferenceKeys(
      state.profile.trackedCircumferences || defaultCircumferenceKeys
    ),
    startCircumferences: { ...(reference.circumferences || reference.startCircumferences || {}) },
    goalType: "weight-loss",
    customGoalLabel: "",
    targetBmi: 24.9,
    goalWeightKg: null,
    weeklyChangeGoalKg: 0.5,
    weeklyLossGoalKg: 0.5,
    goalDeadlineMonths: null,
    goalDeadlineMode: "auto"
  };
}

function renderCycleDialog(state) {
  if (!cycleDialogMode) return "";
  if (cycleDialogMode === "view") {
    const cycle = (state.cycles || []).find((item) => item.id === selectedCycleId);
    if (!cycle) return "";
    const cycleEntries = enrichEntries(
      { ...cycle, activeCycleId: cycle.id },
      (state.entries || []).filter((entry) => entry.cycleId === cycle.id)
    );
    const firstEntry = cycleEntries[0] || null;
    const lastEntry = cycleEntries.at(-1) || null;
    const hasMetric = (value) => value !== null
      && value !== undefined
      && value !== ""
      && Number.isFinite(Number(value));
    const weightChange = firstEntry && lastEntry
      ? Number(lastEntry.weightKg) - Number(firstEntry.weightKg)
      : null;
    const waistChange = firstEntry && lastEntry
      && hasMetric(firstEntry.waistCm)
      && hasMetric(lastEntry.waistCm)
      ? Number(lastEntry.waistCm) - Number(firstEntry.waistCm)
      : null;
    const signedMetric = (value, unit) => Number.isFinite(value)
      ? `${value > 0 ? "+" : ""}${formatDecimal(value, 1)} ${unit}`
      : "-";
    return `
      <dialog class="account-dialog cycle-details-dialog" id="cycle-dialog">
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
          <section class="cycle-result">
            <div>
              <span>Peso final registrado</span>
              <strong>${formatKg(lastEntry?.weightKg)}</strong>
              <small>${signedMetric(weightChange, "kg")} no projeto</small>
            </div>
            <div>
              <span>Cintura final registrada</span>
              <strong>${formatCm(lastEntry?.waistCm)}</strong>
              <small>${signedMetric(waistChange, "cm")} no projeto</small>
            </div>
            <div>
              <span>IMC final</span>
              <strong>${formatDecimal(lastEntry?.bmi, 1)}</strong>
              <small>${escapeHtml(lastEntry?.bmiClass || "Sem dados suficientes")}</small>
            </div>
            <div>
              <span>Registros</span>
              <strong>${cycleEntries.length}</strong>
              <small>incluindo a linha de base</small>
            </div>
          </section>
          <section class="cycle-history">
            <div class="chart-header">
              <div>
                <h3>Histórico deste projeto</h3>
                <p class="muted">Medições isoladas dos demais ciclos.</p>
              </div>
            </div>
            ${cycleEntries.length ? `
              <div class="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th class="number">Peso</th>
                      <th class="number">Cintura</th>
                      <th class="number">IMC</th>
                      <th class="number">Gordura</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${cycleEntries.slice().reverse().map((entry) => `
                      <tr>
                        <td>${formatDate(entry.date)}</td>
                        <td class="number">${formatKg(entry.weightKg)}</td>
                        <td class="number">${formatCm(entry.waistCm)}</td>
                        <td class="number">${formatDecimal(entry.bmi, 1)}</td>
                        <td class="number">${formatPercent(entry.bodyFat)}</td>
                      </tr>
                    `).join("")}
                  </tbody>
                </table>
              </div>
            ` : `<p class="empty-inline">Este projeto não possui medições registradas.</p>`}
          </section>
          <div class="account-dialog-actions">
            <button class="button primary" data-close-cycle-dialog type="button">Fechar</button>
          </div>
        </form>
      </dialog>
    `;
  }
  const current = activeCycle(state);
  if (["close", "replace"].includes(cycleDialogMode) && current) {
    const replacing = cycleDialogMode === "replace";
    return `
      <dialog class="account-dialog" id="cycle-dialog">
        <form id="close-cycle-form">
          <div class="account-dialog-header">
            <h2>${replacing ? "Substituir projeto" : "Encerrar projeto"}</h2>
            <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
          </div>
          <p class="muted">As medições e o planejamento serão preservados para consulta.</p>
          <div class="form-grid">
            <div class="field">
              <label for="cycle-close-status">Como este projeto terminou?</label>
              <select id="cycle-close-status" name="status" required ${replacing ? "disabled" : ""}>
                ${replacing ? `<option value="replaced" selected>Substituído</option>` : `
                  <option value="completed">Concluído</option>
                  <option value="abandoned">Abandonado</option>
                  <option value="expired">Expirado</option>
                `}
              </select>
              ${replacing ? `<input type="hidden" name="status" value="replaced" />` : ""}
            </div>
            <div class="field">
              <label for="cycle-ended-at">Data de encerramento</label>
              <input id="cycle-ended-at" name="endedAt" type="date" max="${todayISO()}" value="${todayISO()}" required />
            </div>
          </div>
          <div class="field">
            <label for="cycle-end-reason">Motivo ou observação</label>
            <textarea id="cycle-end-reason" name="endReason">${replacing ? "Objetivo principal será redefinido em um novo projeto." : ""}</textarea>
          </div>
          <div class="account-dialog-actions">
            <button class="button" data-close-cycle-dialog type="button">Cancelar</button>
            <button class="button primary" type="submit">${replacing ? "Encerrar e continuar" : "Encerrar projeto"}</button>
          </div>
        </form>
      </dialog>
    `;
  }

  const draft = newCycleDraft || initialNewCycleDraft(state);
  if (newCycleStep === 2) {
    const preview = resolveGoalTiming({
      ...draft,
      goalWeightKg: draft.goalWeightKg ?? getSuggestedGoalWeight(draft)
    });
    return `
      <dialog class="account-dialog new-cycle-dialog" id="cycle-dialog">
        <form id="new-cycle-goal-form">
          <div class="account-dialog-header">
            <div>
              <p class="eyebrow">Etapa 2 de 2</p>
              <h2>Objetivo e planejamento</h2>
            </div>
            <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
          </div>
          <p class="muted">Defina a meta a partir da linha de base informada. O peso sugerido continua livre para ajuste.</p>
          <div class="form-grid">
            <div class="field">
              <label for="cycle-goal-type">Objetivo principal ${objectiveHelpButton()}</label>
              <select id="cycle-goal-type" name="goalType" required>
                ${Object.entries(goalTypeLabels).map(([value, label]) =>
                  `<option value="${value}" ${preview.goalType === value ? "selected" : ""}>${label}</option>`
                ).join("")}
              </select>
            </div>
            <div class="field">
              <label for="cycle-custom-goal">Descrição personalizada</label>
              <input id="cycle-custom-goal" name="customGoalLabel" maxlength="80"
                value="${escapeAttribute(preview.customGoalLabel || "")}" />
              <span class="help-text">Opcional. Use apenas se precisar complementar o objetivo principal.</span>
            </div>
            <div class="field">
              <label for="cycle-target-bmi">IMC de referência</label>
              <input id="cycle-target-bmi" name="targetBmi" inputmode="decimal"
                value="${escapeAttribute(preview.targetBmi ?? 24.9)}" />
              <span class="help-text">24,9 corresponde ao limite superior da faixa normal de IMC.</span>
            </div>
            <div class="field">
              <label for="cycle-goal-weight">Peso final desejado (kg)</label>
              <input id="cycle-goal-weight" name="goalWeightKg" inputmode="decimal"
                value="${escapeAttribute(preview.goalWeightKg ?? "")}" />
              <span class="help-text">Sugestão inicial calculada pelo IMC 24,9, limite entre a faixa normal e o sobrepeso. O valor pode ser alterado.</span>
              <button class="button text-button field-action" id="cycle-apply-goal-suggestion" type="button">Usar peso sugerido pelo IMC</button>
            </div>
            <div class="field">
              <label for="cycle-weekly-change">Mudança semanal desejada (kg)</label>
              <input id="cycle-weekly-change" name="weeklyChangeGoalKg" inputmode="decimal"
                value="${escapeAttribute(preview.weeklyChangeGoalKg ?? 0.5)}" />
            </div>
            <div class="field">
              <label for="cycle-goal-deadline">Prazo da meta (meses)</label>
              <input id="cycle-goal-deadline" name="goalDeadlineMonths" inputmode="decimal"
                value="${escapeAttribute(preview.goalDeadlineMonths ? Number(preview.goalDeadlineMonths).toFixed(1) : "")}" />
            </div>
            <fieldset class="field goal-mode-field">
              <legend>Como deseja planejar?</legend>
              <div class="radio-row">
                <label class="radio-card">
                  <input type="radio" name="goalDeadlineMode" value="auto"
                    ${preview.goalDeadlineMode !== "custom" ? "checked" : ""} />
                  <span><strong>Calcular prazo</strong><small>Prioriza o ritmo semanal.</small></span>
                </label>
                <label class="radio-card">
                  <input type="radio" name="goalDeadlineMode" value="custom"
                    ${preview.goalDeadlineMode === "custom" ? "checked" : ""} />
                  <span><strong>Definir prazo</strong><small>Recalcula o ritmo necessário.</small></span>
                </label>
              </div>
            </fieldset>
          </div>
          <div class="goal-preview" id="new-cycle-goal-preview">
            ${renderProfileInsight(preview)}
          </div>
          <div id="new-cycle-plan-preview">
            ${renderPlanEditor(preview)}
          </div>
          <div class="account-dialog-actions">
            <button class="button" id="new-cycle-back" type="button">Voltar</button>
            <button class="button primary" type="submit">Criar projeto</button>
          </div>
        </form>
      </dialog>
    `;
  }

  return `
    <dialog class="account-dialog new-cycle-dialog" id="cycle-dialog">
      <form id="new-cycle-baseline-form" novalidate>
        <div class="account-dialog-header">
          <div>
            <p class="eyebrow">Etapa 1 de 2</p>
            <h2>Linha de base do projeto</h2>
          </div>
          <button class="icon-button" data-close-cycle-dialog type="button" aria-label="Fechar">×</button>
        </div>
        <p class="muted">Esses dados permitem calcular o IMC e estimar a gordura corporal.</p>
        <div class="new-cycle-baseline-groups">
          <fieldset class="measurement-group">
            <legend>Identificação do projeto</legend>
            <div class="form-grid">
          <div class="field">
            <label for="cycle-name">Nome do projeto</label>
            <input id="cycle-name" name="name" maxlength="80" placeholder="Ex.: Acompanhamento inicial"
              value="${escapeAttribute(draft.name || "")}" required />
          </div>
          <div class="field">
            <label for="cycle-start-date">Data inicial</label>
            <input id="cycle-start-date" name="startDate" type="date" max="${todayISO()}"
              value="${escapeAttribute(draft.startDate || todayISO())}" required />
          </div>
            </div>
          </fieldset>
          <fieldset class="measurement-group">
            <legend>Medições principais</legend>
            <p class="help-text">A cintura é obrigatória porque o aplicativo acompanha esse indicador durante todo o projeto.</p>
            <div class="form-grid new-cycle-primary-measures">
          <div class="field">
            <label for="cycle-height">Altura (cm)</label>
            <input id="cycle-height" name="heightCm" inputmode="decimal"
              value="${escapeAttribute(draft.heightCm ?? "")}" required />
          </div>
          <div class="field">
            <label for="cycle-start-weight">Peso inicial (kg)</label>
            <input id="cycle-start-weight" name="startWeightKg" inputmode="decimal"
              value="${escapeAttribute(draft.startWeightKg ?? "")}" required />
          </div>
          <div class="field body-measure-field" data-new-cycle-waist-field>
            <label for="cycle-start-waist">Cintura inicial (cm) ${measurementHelpButton("waist")}</label>
            <input id="cycle-start-waist" name="startWaistCm" inputmode="decimal"
              value="${escapeAttribute(draft.startWaistCm ?? "")}" required />
          </div>
            </div>
          </fieldset>
          <fieldset class="measurement-group">
            <legend>Percentual de gordura corporal</legend>
            <div class="body-fat-acquisition-summary">
              <div>
                <span>Método de obtenção do percentual de gordura</span>
                <strong>${escapeHtml(bodyFatMethodLabel(draft.startBodyFatMethod))}</strong>
                <small>${resolveProfileBodyFat(draft)
                  ? `Percentual registrado: ${formatPercent(resolveProfileBodyFat(draft))}`
                  : "Informe os dados necessários para obter o percentual de gordura."}</small>
              </div>
              <button class="button" id="open-body-fat-acquisition" type="button">Informar ou calcular</button>
            </div>
            <input type="hidden" name="startBodyFatMethod" value="${escapeAttribute(normalizeBodyFatMethod(draft.startBodyFatMethod))}" />
            <input type="hidden" name="startBodyFatManual" value="${escapeAttribute(draft.startBodyFatManual ?? "")}" />
            <input type="hidden" name="startNeckCm" value="${escapeAttribute(draft.startNeckCm ?? "")}" />
            <input type="hidden" name="startHipCm" value="${escapeAttribute(draft.startHipCm ?? "")}" />
            <input type="hidden" name="startSkinfoldData" value="${escapeAttribute(JSON.stringify(draft.startSkinfolds || {}))}" />
            <div class="form-grid">
          ${renderCircumferenceTracking(draft)}
            </div>
          </fieldset>
        </div>
        <div class="goal-preview" id="new-cycle-baseline-preview">
          ${renderNewCycleBaselinePreview(draft)}
        </div>
        <div class="account-dialog-actions">
          <button class="button" data-close-cycle-dialog type="button">Cancelar</button>
          <button class="button primary" id="continue-new-cycle-goal" type="button">
            Continuar para objetivo
          </button>
        </div>
      </form>
      ${renderBodyFatAcquisitionDialog(draft)}
    </dialog>
  `;
}

function renderProfileSummary(state, options) {
  const profile = state.profile;
  const presentation = options.presentationMode && options.presentationMode !== "off";
  const currentCycle = activeCycle(state);
  const previousCycles = (state.cycles || [])
    .filter((cycle) => cycle.id !== currentCycle?.id)
    .sort((a, b) => String(b.startedAt || "").localeCompare(String(a.startedAt || "")));
  const preferred = (profile.preferredActivities || []).map(activityLabel).filter(Boolean);
  const trackedCircumferenceLabels = normalizeCircumferenceKeys(profile.trackedCircumferences)
    .map((key) => circumferenceCatalog.find((item) => item.key === key)?.label)
    .filter(Boolean);
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
            <h2>${escapeHtml(presentation ? "Usuário de demonstração" : profile.name || "Perfil corporal")}</h2>
            <p class="muted">Informações consolidadas do acompanhamento atual.</p>
          </div>
          ${options.canEditIdentity !== false && !presentation ? `
            <button class="button primary" data-edit-profile-section="identity" type="button">
              <span class="profile-edit-label-full">Editar perfil</span>
              <span class="profile-edit-label-short">Editar</span>
            </button>
          ` : ""}
        </div>
        <dl class="profile-summary-grid">
          ${profileValue("Sexo", sexLabels[profile.sex])}
          ${profileValue("Data de nascimento", presentation ? "Informação ocultada" : formatDate(profile.birthDate))}
          ${profileValue("Altura", formatCm(profile.heightCm))}
          ${options.canEditContact !== false ? profileValue("Telefone", presentation ? "Informação ocultada" : formatPhone(state.contact?.phone || "")) : ""}
        </dl>
      </section>

      <section class="card">
        <div class="chart-header">
          <div>
            <p class="eyebrow">Projeto atual</p>
            <h2>${escapeHtml(currentCycle?.name || "Nenhum projeto ativo")}</h2>
          </div>
          <div class="button-row">
            ${currentCycle && !presentation ? `<button class="button primary" data-edit-profile-section="baseline" type="button">Editar</button>` : ""}
          </div>
        </div>
        <dl class="profile-summary-grid">
          ${profileValue("Data inicial", currentCycle ? formatDate(profile.startDate) : "-")}
          ${profileValue("Peso inicial", currentCycle ? formatKg(profile.startWeightKg) : "-")}
          ${profileValue("Cintura inicial", currentCycle ? formatCm(profile.startWaistCm) : "-")}
          ${profileValue("Pescoço inicial", currentCycle ? formatCm(profile.startNeckCm) : "-")}
          ${profileValue("Quadril inicial", currentCycle ? formatCm(profile.startHipCm) : "-")}
          ${profileValue("Gordura corporal", formatPercent(bodyFat))}
          ${profileValue("Método do percentual de gordura", currentCycle ? bodyFatMethodLabel(profile.startBodyFatMethod) : "-")}
          ${profileValue("Medidas acompanhadas", trackedCircumferenceLabels.join(", ") || "Nenhuma selecionada")}
        </dl>
        <div class="button-row profile-card-save">
          ${currentCycle
            ? `<span class="badge">${escapeHtml(cycleStatusLabels[currentCycle.status] || currentCycle.status)}</span>`
            : !presentation ? `<button class="button primary" id="start-new-cycle" type="button">Iniciar novo projeto</button>` : ""}
        </div>
      </section>

      <section class="grid two">
        <article class="card">
          <div class="chart-header">
            <h2>Objetivo e planejamento</h2>
            ${currentCycle && !presentation ? `<button class="button primary" data-edit-profile-section="goals" type="button">Editar</button>` : ""}
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
            ${profile.planningRevisions?.length
              ? profileValue("Revisões preservadas", String(profile.planningRevisions.length))
              : ""}
          </dl>
        </article>
        <article class="card">
          <div class="chart-header">
            <h2>Atividades físicas</h2>
            ${!presentation ? `<button class="button primary" data-edit-profile-section="activities" type="button">Editar</button>` : ""}
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
                ${!presentation ? `<button class="button" data-view-cycle="${escapeAttribute(cycle.id)}" type="button">Consultar</button>` : ""}
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
            <select id="basic-profile-sex" name="sex" required ${baselineLocked ? "disabled" : ""}>
              <option value="" ${!p.sex ? "selected" : ""} disabled>Selecione</option>
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
  const trackDuration = p.trackActivityDuration !== false;
  const activityDuration = Number(p.averageActivityDurationMinutes) > 0
    ? p.averageActivityDurationMinutes
    : 30;
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
                ${trackDuration ? "checked" : ""} />
              <span>
                <strong>Acompanhar também meta de tempo</strong>
                <small>Opcional. Ative para comparar minutos planejados e realizados.</small>
              </span>
            </label>
          </div>
          <div class="field activity-duration-goal" ${trackDuration ? "" : "hidden"}>
            <label for="activity-profile-duration">Duração média pretendida por dia (minutos)</label>
            <input id="activity-profile-duration" name="averageActivityDurationMinutes" type="number"
              min="1" max="1440" ${trackDuration ? "" : "disabled"}
              value="${escapeAttribute(activityDuration)}" />
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
  const trackedCircumferences = data.has("trackedCircumferencesEditor")
    ? normalizeCircumferenceKeys(data.getAll("trackedCircumferences"))
    : normalizeCircumferenceKeys(currentProfile.trackedCircumferences);
  const startCircumferences = { ...(currentProfile.startCircumferences || {}) };
  circumferenceCatalog.filter((item) => !item.legacyField).forEach((item) => {
    const field = `startCircumference_${item.key}`;
    if (item.bilateral && data.has(`${field}_right`)) {
      startCircumferences[item.key] = {
        right: toNumber(data.get(`${field}_right`)),
        left: toNumber(data.get(`${field}_left`))
      };
    } else if (data.has(field)) {
      startCircumferences[item.key] = toNumber(data.get(field));
    }
  });
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
    startSkinfolds: value("startBodyFatMethod", currentProfile.startBodyFatMethod) === "caliper"
      ? parseSkinfoldData(value("skinfoldData", ""))
      : null,
    trackedCircumferences,
    startCircumferences,
    targetBmi: toNumber(data.get("targetBmi")) || 24.9,
    goalWeightKg: toNumber(data.get("goalWeightKg")),
    goalType: data.get("goalType") || "",
    customGoalLabel: data.get("customGoalLabel")?.trim() || "",
    milestoneConfig: readMilestoneConfig(form, currentProfile),
    weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
    goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
    goalDeadlineMode: data.get("goalDeadlineMode") === "custom" ? "custom" : "auto",
    weeklyActivityGoalDays: toNumber(data.get("weeklyActivityGoalDays")) || 3,
    trackActivityDuration: data.has("trackActivityDuration"),
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

function customWeightMilestonesAreValid(profile, form) {
  const start = Number(profile.startWeightKg);
  const goal = Number(profile.goalWeightKg);
  if (![start, goal].every(Number.isFinite)) return true;
  for (const item of customMilestoneTypes.filter((candidate) => ["weight", "bmi"].includes(candidate.type))) {
    const checkbox = form.elements[`customGoalEnabled_${item.type}`];
    const field = form.elements[`customGoalTarget_${item.type}`];
    if (!checkbox?.checked || !field) continue;
    const rawTarget = toNumber(field.value);
    const target = item.type === "bmi"
      ? Number(profile.heightCm) > 0 ? rawTarget * ((Number(profile.heightCm) / 100) ** 2) : null
      : rawTarget;
    clearFieldError(field);
    const minimum = Math.min(start, goal);
    const maximum = Math.max(start, goal);
    const valid = item.type === "weight"
      ? Number.isFinite(target) && target > 0 && target <= Math.abs(goal - start)
      : Number.isFinite(target) && target >= minimum && target <= maximum;
    if (!valid) {
      setFieldError(field, item.type === "weight"
        ? `A variação deve ser maior que zero e não pode ultrapassar ${formatKg(Math.abs(goal - start))}.`
        : `${item.label} deve estar no caminho entre o valor inicial e o peso final.`);
      field.focus();
      return false;
    }
  }
  return true;
}

const customMilestoneTypes = [
  { type: "weight", label: "Variação de peso acumulada", unit: "kg", rule: "weeklyChangeKg", help: "Informe quantos quilos deseja perder ou ganhar até este marco." },
  { type: "bmi", label: "IMC intermediário", unit: "", rule: "targetBmi", help: "Informe um IMC entre a linha de base e a meta final." },
  { type: "body-fat", label: "Gordura corporal", unit: "%", rule: "bodyFatPercent" },
  { type: "waist", label: "Cintura", unit: "cm", rule: "circumferenceCm" }
];

function customMilestoneValidationSpecs(profile) {
  const startWeight = Number(profile.startWeightKg);
  const goalWeight = Number(profile.goalWeightKg);
  const height = Number(profile.heightCm);
  const weightBounds = [startWeight, goalWeight].every(Number.isFinite)
    ? { min: 0.1, max: Math.abs(goalWeight - startWeight) }
    : null;
  const startBmi = calculateBmi(startWeight, height);
  const goalBmi = calculateBmi(goalWeight, height);
  const bmiBounds = [startBmi, goalBmi].every(Number.isFinite)
    ? { min: Math.min(startBmi, goalBmi), max: Math.max(startBmi, goalBmi) }
    : null;

  return Object.fromEntries(customMilestoneTypes.map((item) => {
    const bounds = item.type === "weight" ? weightBounds : item.type === "bmi" ? bmiBounds : null;
    return [
      `customGoalTarget_${item.type}`,
      {
        ...(bounds || { rule: item.rule }),
        label: item.label,
        required: true
      }
    ];
  }));
}

function renderMilestoneEditor(profile, latest) {
  const config = profile.milestoneConfig || {};
  const disabled = new Set(config.disabledSuggestedIds || []);
  const custom = new Map((config.customGoals || []).map((goal) => [goal.type, goal]));
  const suggested = getSuggestedMilestones({ ...profile, milestoneConfig: null }, latest);
  return `
    <fieldset class="field milestone-config-editor">
      <input type="hidden" name="milestoneConfigEditor" value="true" />
      <legend>Marcos do projeto</legend>
      <p class="help-text">As sugestões podem ser retiradas deste projeto. Metas adicionais não alteram o peso final nem o prazo planejado.</p>
      <div class="milestone-config-group">
        <strong>Sugestões do sistema</strong>
        ${suggested.length ? suggested.map((milestone) => {
          const required = milestone.isGoal || milestone.id === "maintenance-range";
          return `
            <label class="milestone-config-option">
              <input type="checkbox" name="enabledSuggestedMilestones" value="${escapeAttribute(milestone.id)}"
                ${required || !disabled.has(milestone.id) ? "checked" : ""} ${required ? "disabled" : ""} />
              ${required ? `<input type="hidden" name="enabledSuggestedMilestones" value="${escapeAttribute(milestone.id)}" />` : ""}
              <span>
                <strong>${escapeHtml(milestone.title)}</strong>
                <small>${escapeHtml(milestone.detail)}${required ? " · Meta principal obrigatória" : ""}</small>
              </span>
            </label>
          `;
        }).join("") : `<span class="muted">Nenhuma sugestão disponível para este planejamento.</span>`}
      </div>
      <div class="milestone-config-group">
        <strong>Metas adicionais</strong>
        <div class="custom-milestone-grid">
          ${customMilestoneTypes.map((item) => {
            const goal = custom.get(item.type);
            const label = item.type === "weight"
              ? getProgressMode(profile) === "gain" ? "Ganho acumulado" : "Perda acumulada"
              : item.label;
            return `
              <label class="custom-milestone-option">
                <span class="toggle-line">
                  <input type="checkbox" name="customGoalEnabled_${item.type}" ${goal ? "checked" : ""} />
                  <strong>${label}</strong>
                </span>
                <span class="input-with-unit">
                  <input name="customGoalTarget_${item.type}" inputmode="decimal"
                    aria-label="Meta adicional de ${label.toLowerCase()}"
                    value="${escapeAttribute(goal?.target ?? "")}" ${goal ? "" : "disabled"} />
                  ${item.unit ? `<span>${item.unit}</span>` : ""}
                </span>
                ${item.help ? `<small class="help-text">${escapeHtml(item.help)}</small>` : ""}
              </label>
            `;
          }).join("")}
        </div>
      </div>
    </fieldset>
  `;
}

function readMilestoneConfig(form, currentProfile) {
  if (form.dataset.profileEditor !== "goals") return currentProfile.milestoneConfig ?? null;
  const data = new FormData(form);
  const planningProfile = {
    ...currentProfile,
    goalType: data.get("goalType") || currentProfile.goalType,
    targetBmi: toNumber(data.get("targetBmi")) || currentProfile.targetBmi,
    goalWeightKg: toNumber(data.get("goalWeightKg")) ?? currentProfile.goalWeightKg,
    milestoneConfig: null
  };
  const suggested = getSuggestedMilestones(planningProfile, null);
  const enabled = new Set(data.getAll("enabledSuggestedMilestones"));
  const customGoals = customMilestoneTypes
    .filter((item) => data.has(`customGoalEnabled_${item.type}`))
    .map((item) => ({
      id: `custom-${item.type}`,
      type: item.type,
      target: toNumber(data.get(`customGoalTarget_${item.type}`))
    }))
    .filter((goal) => goal.target !== null);
  return {
    disabledSuggestedIds: suggested.map((item) => item.id).filter((id) => !enabled.has(id)),
    customGoals
  };
}

export function renderProfile(state, options = {}) {
  const p = state.profile;
  const canEditContact = options.canEditContact !== false;
  const canEditIdentity = options.canEditIdentity !== false;
  const presentation = options.presentationMode && options.presentationMode !== "off";
  if (presentation) profileEditMode = false;
  const editing = presentation ? false : options.forceEdit === true ? "identity" : profileEditMode;
  if (!editing) return renderProfileSummary(state, {
    canEditContact,
    canEditIdentity,
    presentationMode: options.presentationMode
  });
  if (!state.activeCycleId && !canEditIdentity) {
    profileEditMode = false;
    return renderProfileSummary(state, {
      canEditContact,
      canEditIdentity,
      presentationMode: options.presentationMode
    });
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
  const objectiveLocked = cycleHasMeasurements(state);
  const baselineDisabled = baselineLocked ? "disabled" : "";
  const identityReadOnly = canEditIdentity ? "" : "readonly aria-readonly=\"true\"";
  const suggestedGoal = getSuggestedGoalWeight(p);
  const previewProfile = resolveGoalTiming({
    ...p,
    goalWeightKg: p.goalWeightKg ?? suggestedGoal,
    goalDeadlineMode: p.goalDeadlineMode === "custom" ? "custom" : "auto"
  });

  return `
    <form class="form profile-form" id="profile-form" data-profile-editor="${escapeAttribute(editing)}" novalidate>
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
              <option value="" ${!p.sex ? "selected" : ""} disabled>Selecione</option>
              <option value="male" ${p.sex === "male" ? "selected" : ""}>Masculino</option>
              <option value="female" ${p.sex === "female" ? "selected" : ""}>Feminino</option>
            </select>
            <span class="help-text">Usado na seleção da equação para estimativas corporais.</span>
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
          <div class="field body-measure-field">
            <label for="startWaistCm">Cintura inicial (cm) ${measurementHelpButton("waist")}</label>
            <input id="startWaistCm" name="startWaistCm" inputmode="decimal" required
              ${baselineDisabled} value="${escapeAttribute(p.startWaistCm ?? "")}" />
          </div>
          <div class="field body-measure-field">
            <label for="startNeckCm">Pescoço inicial (cm) ${measurementHelpButton("neck")}</label>
            <input id="startNeckCm" name="startNeckCm" inputmode="decimal" ${baselineDisabled} value="${escapeAttribute(p.startNeckCm ?? "")}" />
          </div>
          <div class="field">
            <label for="startBodyFatMethod">Método de obtenção do percentual de gordura</label>
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
            <div data-profile-skinfold-calculator>
              ${skinfoldCalculator("profile", p, p.startSkinfolds)}
            </div>
          </div>
          ${renderCircumferenceTracking(p, baselineDisabled)}
          <div class="field">
            <label for="goalType">Objetivo principal ${objectiveHelpButton()}</label>
            <select id="goalType" name="goalType" ${editing === "goals" && objectiveLocked ? "disabled aria-disabled=\"true\"" : ""}>
              <option value="" ${!p.goalType ? "selected" : ""}>Selecione</option>
              <option value="weight-loss" ${p.goalType === "weight-loss" ? "selected" : ""}>Emagrecimento</option>
              <option value="weight-gain" ${p.goalType === "weight-gain" ? "selected" : ""}>Ganho de peso</option>
              <option value="muscle-gain" ${p.goalType === "muscle-gain" ? "selected" : ""}>Ganho de massa muscular</option>
              <option value="maintenance" ${p.goalType === "maintenance" ? "selected" : ""}>Manutenção</option>
              <option value="recovery" ${p.goalType === "recovery" ? "selected" : ""}>Recuperação de peso</option>
              <option value="other" ${p.goalType === "other" ? "selected" : ""}>Outro</option>
            </select>
            ${editing === "goals" && objectiveLocked ? `
              <input type="hidden" name="goalType" value="${escapeAttribute(p.goalType || "")}" />
              <span class="help-text">O objetivo não pode ser alterado após o primeiro registro corporal.</span>
              <button class="button text-button field-action" id="replace-cycle-for-objective" type="button">
                Iniciar projeto com outro objetivo
              </button>
            ` : ""}
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
        ${editing === "goals"
          ? `<div id="milestone-editor-container">${renderMilestoneEditor(previewProfile, getLatestEntry(previewProfile, activeEntries))}</div>`
          : ""}
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
    "sex", "heightCm", "startDate", "startWeightKg", "startWaistCm", "startNeckCm",
    "startHipCm", "startBodyFatMethod", "startBodyFatManual",
    "trackedCircumferences", "trackedCircumferencesEditor",
    ...circumferenceCatalog.map((item) => `startCircumference_${item.key}`)
  ]);
  const goalFields = new Set([
    "goalType", "customGoalLabel", "targetBmi", "goalWeightKg",
    "weeklyChangeGoalKg", "goalDeadlineMonths", "goalDeadlineMode",
    "milestoneConfigEditor"
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
  activeProfileRender = render;
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
        trackActivityDuration: data.has("trackActivityDuration"),
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
      if (mode === "new") {
        newCycleStep = 1;
        newCycleDraft = initialNewCycleDraft(state);
        profileHasPendingChanges = true;
        if (!newCycleHistoryGuard) {
          history.pushState({ fitBodyStatNewCycle: true }, "", location.href);
          newCycleHistoryGuard = true;
        }
      }
      render();
    };
    const closeCycleDialog = async () => {
      if (cycleDialogMode === "new") {
        const discard = await confirmAction({
          title: "Abandonar criação do projeto?",
          message: "Os dados preenchidos nas duas etapas serão apagados.",
          confirmLabel: "Abandonar",
          tone: "warning"
        });
        if (!discard) return;
      }
      cycleDialogMode = null;
      selectedCycleId = null;
      newCycleStep = 1;
      newCycleDraft = null;
      profileHasPendingChanges = false;
      if (newCycleHistoryGuard) {
        newCycleExitPending = true;
        history.back();
      }
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
      const replacing = data.get("status") === "replaced";
      const closingCycleId = state.activeCycleId;
      if (!await confirmAction({
        title: replacing ? "Substituir projeto?" : "Encerrar projeto?",
        message: replacing
          ? "O projeto e seu histórico serão preservados. Em seguida, você poderá criar o projeto com o novo objetivo."
          : "O histórico será preservado, mas novos registros não serão associados a este projeto.",
        confirmLabel: replacing ? "Substituir" : "Encerrar",
        tone: "warning"
      })) return;
      Object.assign(state, closeActiveCycle(state, data.get("status"), {
        endedAt: data.get("endedAt"),
        endReason: data.get("endReason")
      }));
      cycleDialogMode = replacing ? "new" : null;
      if (replacing) {
        newCycleStep = 1;
        newCycleDraft = initialNewCycleDraft(state);
      }
      persist({
        type: "profile-plan",
        auditEvent: {
          type: replacing ? "project_replaced" : "project_closed",
          cycleId: closingCycleId,
          reasonCode: replacing ? "objective_redefined" : data.get("status")
        }
      });
      showToast(replacing ? "Projeto anterior preservado. Defina a nova linha de base." : "Projeto encerrado.");
      render();
    });
    const baselineForm = document.getElementById("new-cycle-baseline-form");
    const readBaselineDraft = () => {
      const data = new FormData(baselineForm);
      const trackedCircumferences = normalizeCircumferenceKeys(data.getAll("trackedCircumferences"));
      const startCircumferences = {};
      circumferenceCatalog.filter((item) => !item.legacyField).forEach((item) => {
        const field = `startCircumference_${item.key}`;
        startCircumferences[item.key] = item.bilateral
          ? {
              right: toNumber(data.get(`${field}_right`)),
              left: toNumber(data.get(`${field}_left`))
            }
          : toNumber(data.get(field));
      });
      return {
        ...(newCycleDraft || initialNewCycleDraft(state)),
        name: String(data.get("name") || "").trim(),
        startDate: data.get("startDate"),
        sex: (newCycleDraft || initialNewCycleDraft(state)).sex || state.profile.sex,
        heightCm: toNumber(data.get("heightCm")),
        startWeightKg: toNumber(data.get("startWeightKg")),
        startWaistCm: toNumber(data.get("startWaistCm")),
        startNeckCm: toNumber(data.get("startNeckCm")),
        startHipCm: toNumber(data.get("startHipCm")),
        startBodyFatMethod: normalizeBodyFatMethod(data.get("startBodyFatMethod")),
        startBodyFatManual: bodyFatMethodIsEstimated(data.get("startBodyFatMethod"))
          ? null
          : toNumber(data.get("startBodyFatManual")),
        startSkinfolds: data.get("startBodyFatMethod") === "caliper"
          ? parseSkinfoldData(data.get("startSkinfoldData"))
          : null,
        trackedCircumferences,
        startCircumferences
      };
    };
    const updateBaselinePreview = () => {
      if (!baselineForm) return;
      const draft = readBaselineDraft();
      const tracked = new Set(draft.trackedCircumferences);
      baselineForm.querySelectorAll("[data-start-circumference]").forEach((field) => {
        const key = field.dataset.startCircumference;
        const visible = tracked.has(key);
        field.hidden = !visible;
        field.querySelectorAll("input").forEach((input) => {
          input.disabled = !visible;
        });
      });
      document.getElementById("new-cycle-baseline-preview").innerHTML =
        renderNewCycleBaselinePreview(draft);
    };
    baselineForm?.addEventListener("input", () => {
      profileHasPendingChanges = true;
      updateBaselinePreview();
    });

    const bodyFatDialog = document.getElementById("body-fat-acquisition-dialog");
    const bodyFatMethodField = document.getElementById("body-fat-acquisition-method");
    const bodyFatValueField = document.getElementById("body-fat-acquisition-value");
    const updateBodyFatDialog = () => {
      const method = normalizeBodyFatMethod(bodyFatMethodField?.value);
      const estimated = bodyFatMethodIsEstimated(method);
      const circumference = bodyFatDialog?.querySelector("[data-body-fat-circumference]");
      const manual = bodyFatDialog?.querySelector("[data-body-fat-manual]");
      const skinfold = bodyFatDialog?.querySelector("[data-body-fat-skinfold]");
      if (circumference) circumference.hidden = !estimated;
      if (manual) manual.hidden = estimated;
      if (skinfold) skinfold.hidden = method !== "caliper";
      const result = estimated
        ? resolveProfileBodyFat({
            ...state.profile,
            sex: newCycleDraft?.sex || state.profile.sex,
            heightCm: toNumber(document.getElementById("body-fat-height")?.value),
            startWaistCm: toNumber(document.getElementById("body-fat-waist")?.value),
            startNeckCm: toNumber(document.getElementById("body-fat-neck")?.value),
            startHipCm: toNumber(document.getElementById("body-fat-hip")?.value),
            startBodyFatManual: null
          })
        : toNumber(bodyFatValueField?.value);
      const resultBox = document.getElementById("body-fat-acquisition-result");
      if (resultBox) {
        resultBox.innerHTML = result
          ? `<span>Percentual de gordura</span><strong>${formatPercent(result)}</strong>`
          : "";
      }
    };
    document.getElementById("open-body-fat-acquisition")?.addEventListener("click", () => {
      const heightInput = document.getElementById("body-fat-height");
      const waistInput = document.getElementById("body-fat-waist");
      if (heightInput) heightInput.value = baselineForm?.elements.heightCm?.value || "";
      if (waistInput) waistInput.value = baselineForm?.elements.startWaistCm?.value || "";
      updateBodyFatDialog();
      bodyFatDialog?.showModal();
    });
    bodyFatMethodField?.addEventListener("change", updateBodyFatDialog);
    bodyFatDialog?.addEventListener("input", updateBodyFatDialog);
    bodyFatDialog?.querySelectorAll("[data-close-body-fat-dialog]").forEach((button) => {
      button.addEventListener("click", () => bodyFatDialog.close());
    });
    bodyFatDialog?.addEventListener("cancel", (event) => {
      event.preventDefault();
      bodyFatDialog.close();
    });
    bindSkinfoldCalculator({
      prefix: "new-cycle",
      profile: { ...state.profile, sex: newCycleDraft?.sex || state.profile.sex },
      measurementDate: () => baselineForm?.elements.startDate?.value,
      targetInput: bodyFatValueField,
      onResult: updateBodyFatDialog
    });
    document.getElementById("apply-body-fat-acquisition")?.addEventListener("click", async () => {
      const method = normalizeBodyFatMethod(bodyFatMethodField?.value);
      const estimated = bodyFatMethodIsEstimated(method);
      const height = estimated ? toNumber(document.getElementById("body-fat-height")?.value) : null;
      const waist = estimated ? toNumber(document.getElementById("body-fat-waist")?.value) : null;
      const neck = estimated ? toNumber(document.getElementById("body-fat-neck")?.value) : null;
      const hip = estimated ? toNumber(document.getElementById("body-fat-hip")?.value) : null;
      const manual = estimated ? null : toNumber(bodyFatValueField?.value);
      if (estimated && (!height || !waist || !neck || (state.profile.sex === "female" && !hip))) {
        showToast("Preencha todas as medidas necessárias para a estimativa.");
        return;
      }
      if (!estimated && !manual) {
        showToast("Informe o percentual obtido pelo método selecionado.");
        return;
      }
      baselineForm.elements.startBodyFatMethod.value = method;
      baselineForm.elements.startBodyFatManual.value = manual ?? "";
      baselineForm.elements.startNeckCm.value = neck ?? "";
      baselineForm.elements.startHipCm.value = hip ?? "";
      baselineForm.elements.heightCm.value = height ?? baselineForm.elements.heightCm.value;
      baselineForm.elements.startWaistCm.value = waist ?? baselineForm.elements.startWaistCm.value;
      const skinfoldData = document.getElementById("new-cycle-skinfold-data")?.value || "{}";
      baselineForm.elements.startSkinfoldData.value = method === "caliper" ? skinfoldData : "{}";
      newCycleDraft = readBaselineDraft();
      profileHasPendingChanges = true;
      bodyFatDialog.close();
      render();
    });
    updateBaselinePreview();
    const continueToGoal = async () => {
      try {
        const heightField = baselineForm.elements.heightCm;
        if (!await resolveHeightInput(heightField)) return;
        const draft = readBaselineDraft();
        const estimated = bodyFatMethodIsEstimated(draft.startBodyFatMethod);
        if (estimated && !draft.sex) {
          showToast("Informe o sexo no perfil para usar a estimativa por circunferências.");
          return;
        }
        const validation = await validateNumericFields(baselineForm, {
        heightCm: { rule: "heightCm", label: "Altura", required: true },
        startWeightKg: { rule: "weightKg", label: "Peso inicial", required: true },
        startWaistCm: { rule: "circumferenceCm", label: "Cintura inicial", required: true },
        startNeckCm: { rule: "circumferenceCm", label: "Pescoço inicial", required: estimated },
        startHipCm: {
          rule: "circumferenceCm",
          label: "Quadril inicial",
          required: estimated && draft.sex === "female"
        },
        startBodyFatManual: {
          rule: "bodyFatPercent",
          label: "Gordura corporal",
          required: !estimated
        },
        ...Object.fromEntries(
          circumferenceCatalog
            .filter((item) => !item.legacyField && draft.trackedCircumferences.includes(item.key))
            .flatMap((item) => item.bilateral
              ? [
                  [`startCircumference_${item.key}_right`, {
                    rule: "circumferenceCm",
                    label: `${item.label} direito inicial`
                  }],
                  [`startCircumference_${item.key}_left`, {
                    rule: "circumferenceCm",
                    label: `${item.label} esquerdo inicial`
                  }]
                ]
              : [[`startCircumference_${item.key}`, {
                  rule: "circumferenceCm",
                  label: `${item.label} inicial`
                }]]
            )
        )
        });
        if (!validation.valid) {
          showToast("Revise os dados da linha de base.");
          return;
        }
        newCycleDraft = {
          ...draft,
          goalWeightKg: draft.goalWeightKg ?? getSuggestedGoalWeight(draft)
        };
        profileHasPendingChanges = true;
        newCycleStep = 2;
        render();
      } catch (error) {
        console.error("Falha ao avançar para o objetivo:", error);
        showToast("Não foi possível avançar. Revise os dados e tente novamente.");
      }
    };
    document.getElementById("continue-new-cycle-goal")
      ?.addEventListener("click", continueToGoal);
    baselineForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      continueToGoal();
    });

    const goalForm = document.getElementById("new-cycle-goal-form");
    let newCycleGoalTimer = null;
    const readGoalDraft = (sourceName = "") => {
      const data = new FormData(goalForm);
      const rawDraft = {
        ...newCycleDraft,
        goalType: data.get("goalType"),
        customGoalLabel: String(data.get("customGoalLabel") || "").trim(),
        targetBmi: toNumber(data.get("targetBmi")) || 24.9,
        goalWeightKg: toNumber(data.get("goalWeightKg")),
        weeklyChangeGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
        weeklyLossGoalKg: toNumber(data.get("weeklyChangeGoalKg")),
        goalDeadlineMonths: toNumber(data.get("goalDeadlineMonths")),
        goalDeadlineMode: data.get("goalDeadlineMode") === "custom" ? "custom" : "auto"
      };
      const draft = rawDraft.goalDeadlineMode === "custom"
        && !(Number(rawDraft.goalDeadlineMonths) > 0)
        ? rawDraft
        : resolveGoalTiming(rawDraft);
      const weekly = goalForm.elements.weeklyChangeGoalKg;
      const deadline = goalForm.elements.goalDeadlineMonths;
      const maintenance = getProgressMode(draft) === "maintain";
      const custom = draft.goalDeadlineMode === "custom";
      weekly.readOnly = custom || maintenance;
      deadline.readOnly = !custom || maintenance;
      if (sourceName !== "weeklyChangeGoalKg" && document.activeElement !== weekly) {
        weekly.value = draft.weeklyChangeGoalKg || "";
      }
      if (sourceName !== "goalDeadlineMonths" && document.activeElement !== deadline) {
        deadline.value = draft.goalDeadlineMonths ? Number(draft.goalDeadlineMonths).toFixed(1) : "";
      }
      return draft;
    };
    const updateNewCycleGoal = (sourceName = "") => {
      if (!goalForm) return;
      const draft = readGoalDraft(sourceName);
      document.getElementById("new-cycle-goal-preview").innerHTML = renderProfileInsight(draft);
      document.getElementById("new-cycle-plan-preview").innerHTML = renderPlanEditor(draft);
    };
    const applyNewCycleSuggestion = () => {
      const data = new FormData(goalForm);
      const suggestion = getSuggestedGoalWeight({
        ...newCycleDraft,
        goalType: data.get("goalType"),
        targetBmi: toNumber(data.get("targetBmi")) || 24.9
      });
      goalForm.elements.goalWeightKg.value = suggestion !== null ? suggestion.toFixed(1) : "";
      updateNewCycleGoal("goalWeightKg");
    };
    document.getElementById("cycle-apply-goal-suggestion")?.addEventListener("click", applyNewCycleSuggestion);
    goalForm?.querySelector('select[name="goalType"]')
      ?.addEventListener("change", applyNewCycleSuggestion);
    goalForm?.addEventListener("input", (event) => {
      profileHasPendingChanges = true;
      window.clearTimeout(newCycleGoalTimer);
      newCycleGoalTimer = window.setTimeout(() => updateNewCycleGoal(event.target.name), 180);
    });
    document.getElementById("new-cycle-back")?.addEventListener("click", () => {
      newCycleDraft = readGoalDraft();
      newCycleStep = 1;
      render();
    });
    updateNewCycleGoal();
    goalForm?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const draft = readGoalDraft();
      const maintenance = getProgressMode(draft) === "maintain";
      const validation = await validateNumericFields(goalForm, {
        targetBmi: { rule: "targetBmi", label: "IMC de referência", required: true },
        goalWeightKg: { rule: "weightKg", label: "Peso final", required: true },
        weeklyChangeGoalKg: {
          rule: "weeklyChangeKg",
          label: "Mudança semanal",
          required: draft.goalDeadlineMode === "auto" && !maintenance
        },
        goalDeadlineMonths: {
          rule: "deadlineMonths",
          label: "Prazo",
          required: draft.goalDeadlineMode === "custom" && !maintenance
        }
      });
      if (!validation.valid) {
        showToast("Revise o objetivo e o planejamento.");
        return;
      }
      if (!goalDirectionIsValid(draft, goalForm.elements.goalWeightKg)) {
        showToast("Revise a direção da meta.");
        return;
      }
      const next = startNewCycle(state, draft);
      const resolvedProfile = resolveGoalTiming(next.profile);
      Object.assign(state, {
        ...next,
        profile: resolvedProfile,
        goalPlan: createDefaultMonthlyPlan(resolvedProfile)
      });
      cycleDialogMode = null;
      newCycleStep = 1;
      newCycleDraft = null;
      profileHasPendingChanges = false;
      if (newCycleHistoryGuard) {
        newCycleExitPending = true;
        history.back();
      }
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
  const originalObjective = state.profile.goalType || "";
  const discardedCustomGoalCount = state.profile.milestoneConfig?.customGoals?.length || 0;
  let objectiveChanged = false;
  profileHasPendingChanges = false;
  const bodyFatInputLocked = form.elements.startBodyFatManual?.disabled === true;

  const updateBodyFatFields = () => {
    const estimated = bodyFatMethodIsEstimated(form.elements.startBodyFatMethod?.value);
    const field = form.querySelector("[data-profile-body-fat-value]");
    const input = form.elements.startBodyFatManual;
    const calculator = form.querySelector("[data-profile-skinfold-calculator]");
    if (field) field.hidden = estimated;
    if (input) {
      input.disabled = bodyFatInputLocked || estimated;
      input.required = !estimated;
    }
    if (calculator) {
      calculator.hidden = bodyFatInputLocked || form.elements.startBodyFatMethod?.value !== "caliper";
    }
  };
  form.elements.startBodyFatMethod?.addEventListener("change", updateBodyFatFields);
  updateBodyFatFields();
  bindSkinfoldCalculator({
    prefix: "profile",
    profile: state.profile,
    measurementDate: () => form.elements.startDate?.value,
    targetInput: form.elements.startBodyFatManual,
    onResult: () => {
      profileHasPendingChanges = true;
      mobileSave.hidden = false;
    }
  });
  configureProfileSectionEditor(form);
  const bindCustomMilestoneInputs = () => {
    form.querySelectorAll('[name^="customGoalEnabled_"]').forEach((checkbox) => {
      const type = checkbox.name.replace("customGoalEnabled_", "");
      const target = form.elements[`customGoalTarget_${type}`];
      const sync = () => {
        if (target) target.disabled = !checkbox.checked;
      };
      checkbox.addEventListener("change", () => {
        sync();
        markDirty();
        if (checkbox.checked) target?.focus();
      });
      sync();
    });
  };
  bindCustomMilestoneInputs();
  const updateCircumferenceTracking = () => {
    const selected = new Set(
      [...form.querySelectorAll('input[name="trackedCircumferences"]:checked')]
        .map((input) => input.value)
    );
    form.querySelectorAll("[data-start-circumference]").forEach((field) => {
      const key = field.dataset.startCircumference;
      const requiredForFemaleEstimate = key === "hip"
        && bodyFatMethodIsEstimated(form.elements.startBodyFatMethod?.value)
        && form.elements.sex?.value === "female";
      field.hidden = !selected.has(key) && !requiredForFemaleEstimate;
      field.querySelectorAll("input").forEach((input) => {
        if (!input.hasAttribute("data-baseline-locked")) input.disabled = field.hidden;
      });
    });
    const hipHelp = form.querySelector("[data-hip-required-help]");
    if (hipHelp) {
      hipHelp.hidden = !(
        bodyFatMethodIsEstimated(form.elements.startBodyFatMethod?.value)
        && form.elements.sex?.value === "female"
      );
    }
  };
  form.querySelectorAll('input[name="trackedCircumferences"]').forEach((input) => {
    input.addEventListener("change", () => {
      updateCircumferenceTracking();
      markDirty();
    });
  });
  form.elements.startBodyFatMethod?.addEventListener("change", updateCircumferenceTracking);
  form.elements.sex?.addEventListener("change", updateCircumferenceTracking);
  updateCircumferenceTracking();

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
    if (objectiveChanged && ["goalType", "targetBmi", "goalWeightKg"].includes(sourceName)) {
      const milestoneContainer = document.getElementById("milestone-editor-container");
      if (milestoneContainer) {
        const cleanDraft = { ...draft, milestoneConfig: { disabledSuggestedIds: [], customGoals: [] } };
        milestoneContainer.innerHTML = renderMilestoneEditor(
          cleanDraft,
          getLatestEntry(cleanDraft, state.entries || [])
        );
        bindCustomMilestoneInputs();
      }
    }
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
  document.getElementById("replace-cycle-for-objective")?.addEventListener("click", async () => {
    if (!await confirmAction({
      title: "Iniciar projeto com outro objetivo?",
      message: "O projeto atual será encerrado como substituído e continuará disponível no histórico.",
      confirmLabel: "Continuar",
      tone: "warning"
    })) return;
    profileHasPendingChanges = false;
    profileEditMode = false;
    cycleDialogMode = "replace";
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
  form.querySelector('select[name="goalType"]')?.addEventListener("change", async (event) => {
    const nextObjective = event.target.value;
    if (nextObjective === originalObjective) {
      objectiveChanged = false;
      applyGoalSuggestion();
      const milestoneContainer = document.getElementById("milestone-editor-container");
      if (milestoneContainer) {
        const restoredDraft = {
          ...readProfileForm(form, state.profile),
          milestoneConfig: state.profile.milestoneConfig
        };
        milestoneContainer.innerHTML = renderMilestoneEditor(
          restoredDraft,
          getLatestEntry(restoredDraft, state.entries || [])
        );
        bindCustomMilestoneInputs();
      }
      return;
    }
    const accepted = await confirmAction({
      title: "Atualizar objetivo do projeto?",
      message: discardedCustomGoalCount
        ? "O planejamento e as sugestões serão recalculados. As metas personalizadas atuais serão descartadas e precisarão ser configuradas novamente."
        : "O planejamento e as sugestões do sistema serão recalculados para o novo objetivo.",
      confirmLabel: "Atualizar objetivo",
      tone: "warning"
    });
    if (!accepted) {
      event.target.value = originalObjective;
      objectiveChanged = false;
      updateGoalPlanner("goalType");
      return;
    }
    objectiveChanged = true;
    markDirty();
    applyGoalSuggestion();
    updateGoalPlanner("goalType");
  });
  form.addEventListener("input", (event) => {
    if (event.target.name === "goalType") return;
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
    const validationProfile = {
      ...state.profile,
      goalType: data.get("goalType") || state.profile.goalType,
      heightCm: toNumber(data.get("heightCm")) ?? state.profile.heightCm,
      startWeightKg: toNumber(data.get("startWeightKg")) ?? state.profile.startWeightKg,
      goalWeightKg: toNumber(data.get("goalWeightKg"))
    };
    const bodyFatMethod = data.get("startBodyFatMethod") || state.profile.startBodyFatMethod;
    const bodyReference = data.get("sex") || state.profile.sex;
    if (bodyFatMethodIsEstimated(bodyFatMethod) && !bodyReference) {
      showToast("Selecione uma referência corporal ou escolha outro método para a gordura corporal.");
      form.elements.sex?.focus();
      return;
    }
    const startCircumferenceRules = {};
    form.querySelectorAll("[data-start-circumference] input:not(:disabled)").forEach((input) => {
      const key = input.closest("[data-start-circumference]")?.dataset.startCircumference;
      const item = circumferenceCatalog.find((candidate) => candidate.key === key);
      startCircumferenceRules[input.name] = {
        rule: "circumferenceCm",
        label: `${item?.label || "Medida"} inicial`
      };
    });
    const validation = await validateNumericFields(form, {
      heightCm: { rule: "heightCm", label: "Altura", required: true },
      startWeightKg: { rule: "weightKg", label: "Peso inicial", required: true },
      startWaistCm: {
        rule: "circumferenceCm",
        label: "Cintura inicial",
        required: true
      },
      startNeckCm: {
        rule: "circumferenceCm",
        label: "Pescoço inicial",
        required: bodyFatMethodIsEstimated(bodyFatMethod)
      },
      startHipCm: {
        rule: "circumferenceCm",
        label: "Quadril inicial",
        required: bodyFatMethodIsEstimated(bodyFatMethod) && bodyReference === "female"
      },
      startBodyFatManual: {
        rule: "bodyFatPercent",
        label: "Gordura corporal inicial",
        required: !bodyFatMethodIsEstimated(bodyFatMethod)
      },
      ...startCircumferenceRules,
      targetBmi: { rule: "targetBmi", label: "IMC de referência", required: true },
      goalWeightKg: { rule: "weightKg", label: "Peso final", required: true },
      weeklyChangeGoalKg: { rule: "weeklyChangeKg", label: "Mudança semanal", required: deadlineMode === "auto" && !maintenanceGoal },
      goalDeadlineMonths: { rule: "deadlineMonths", label: "Prazo", required: deadlineMode === "custom" && !maintenanceGoal },
      weeklyActivityGoalDays: { rule: "activityDays", label: "Dias ativos", required: true },
      averageActivityDurationMinutes: { rule: "activityMinutes", label: "Duração média" },
      ...customMilestoneValidationSpecs(validationProfile)
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
    if (!customWeightMilestonesAreValid(nextProfile, form)) {
      showToast("Revise as metas adicionais.");
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

    const savedSection = form.dataset.profileEditor;
    const previousPlanning = planningSnapshot(state.profile);
    const nextPlanning = planningSnapshot(nextProfile);
    const hasPlanningRevision = savedSection === "goals"
      && planningChanged(previousPlanning, nextPlanning);
    if (hasPlanningRevision) {
      const revision = {
        id: globalThis.crypto?.randomUUID?.() || `planning-${Date.now()}`,
        revisedAt: new Date().toISOString(),
        previous: previousPlanning,
        next: nextPlanning
      };
      nextProfile.planningOriginal = state.profile.planningOriginal || previousPlanning;
      nextProfile.planningRevisions = [...(state.profile.planningRevisions || []), revision];
    }

    state.profile = nextProfile;
    if (phone !== null) state.contact = { ...(state.contact || {}), phone: normalizePhone(phone) };
    state.goalPlan = createDefaultMonthlyPlan(nextProfile);
    profileHasPendingChanges = false;
    profileEditMode = false;
    persist({
      type: "profile-plan",
      ...(hasPlanningRevision ? {
        auditEvent: {
          type: objectiveChanged ? "objective_changed" : "planning_revised",
          cycleId: state.activeCycleId,
          previousObjective: originalObjective,
          nextObjective: nextProfile.goalType,
          discardedCustomGoalCount,
          reasonCode: objectiveChanged ? "changed_before_first_measurement" : "planning_updated",
          previousPlanning,
          nextPlanning
        }
      } : {})
    });
    showToast(savedSection === "baseline" ? "Linha de base atualizada." : "Objetivo e planejamento atualizados.");
    render();
  });
}

export function resetProfileMode() {
  profileHasPendingChanges = false;
  profileEditMode = false;
  cycleDialogMode = null;
  selectedCycleId = null;
  newCycleStep = 1;
  newCycleDraft = null;
}
