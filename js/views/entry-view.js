import { entryForm } from "../components/entry-form.js";
import { activityPicker } from "../components/activity-picker.js";
import { createEntry } from "../models/entry-model.js";
import { createActivity } from "../models/activity-model.js";
import { todayISO } from "../utils/date-utils.js";
import { toNumber } from "../utils/number-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { showToast } from "../components/toast.js";
import { mergeDailyActivity } from "../services/activity-service.js";
import { validateNumericFields } from "../utils/validation-utils.js";
import { confirmAction } from "../components/modal.js";
import { bodyFatMethodIsEstimated } from "../models/goal-model.js";
import {
  bindSkinfoldCalculator,
  parseSkinfoldData
} from "../components/skinfold-calculator.js";
import {
  circumferenceCatalog,
  normalizeCircumferenceKeys
} from "../data/circumference-catalog.js";

let activeEntryMode = "activity";
let selectedActivityDate = todayISO();
let editingActivityDate = null;
let editingMeasurementId = null;
let entryHasPendingChanges = false;

export function resetEntryMode() {
  activeEntryMode = "activity";
  selectedActivityDate = todayISO();
  editingActivityDate = null;
  editingMeasurementId = null;
  entryHasPendingChanges = false;
}

function consumeActivityEditRequest() {
  const editDate = sessionStorage.getItem("fitbodystat-edit-activity-date");
  if (!editDate) return;
  activeEntryMode = "activity";
  selectedActivityDate = editDate;
  editingActivityDate = editDate;
  sessionStorage.removeItem("fitbodystat-edit-activity-date");
}

function consumeMeasurementEditRequest() {
  const entryId = sessionStorage.getItem("fitbodystat-edit-entry-id");
  if (!entryId) return;
  activeEntryMode = "measurement";
  editingMeasurementId = entryId;
  editingActivityDate = null;
  sessionStorage.removeItem("fitbodystat-edit-entry-id");
}

function renderModeSelector() {
  return `
    <div class="entry-mode" role="tablist" aria-label="Tipo de registro">
      <button data-entry-mode="measurement" type="button" role="tab"
        aria-selected="${activeEntryMode === "measurement"}"
        ${editingActivityDate ? "disabled" : ""}>Medidas corporais</button>
      <button data-entry-mode="activity" type="button" role="tab"
        aria-selected="${activeEntryMode === "activity"}"
        ${editingMeasurementId ? "disabled" : ""}>Atividade física</button>
    </div>
  `;
}

function renderActivityForm(state) {
  const existingActivity = state.activities.find((item) => item.date === selectedActivityDate);
  const isEditing = editingActivityDate === selectedActivityDate && Boolean(existingActivity);
  const activity = isEditing ? existingActivity : {};
  return `
    <form class="form card" id="activity-form">
      <div class="chart-header">
        <div>
          <h2>${isEditing ? "Atualizar atividade" : "Registrar atividade"}</h2>
          <p class="muted">Marque as modalidades realizadas. Os demais detalhes são opcionais.</p>
        </div>
      </div>
      ${existingActivity && !isEditing
        ? `<p class="form-notice">Já existe atividade nesta data. Este novo preenchimento será acrescentado ao registro do dia.</p>`
        : ""}
      <div class="form-grid">
        <div class="field">
          <label for="activityDate">Data</label>
          <input id="activityDate" name="date" type="date" required max="${todayISO()}"
            value="${escapeAttribute(selectedActivityDate)}" />
        </div>
        ${activityPicker(
          state.profile.preferredActivities || [],
          activity.activityTypeIds || [],
          activity.customActivityName || ""
        )}
        <div class="field">
          <label for="durationMinutes">Duração total (minutos)</label>
          <input id="durationMinutes" name="durationMinutes" type="number" min="1" max="1440"
            value="${escapeAttribute(activity.durationMinutes ?? "")}" />
        </div>
        <div class="field">
          <label for="intensity">Intensidade</label>
          <select id="intensity" name="intensity">
            <option value="" ${!activity.intensity ? "selected" : ""}>Não informada</option>
            <option value="light" ${activity.intensity === "light" ? "selected" : ""}>Leve</option>
            <option value="moderate" ${activity.intensity === "moderate" ? "selected" : ""}>Moderada</option>
            <option value="vigorous" ${activity.intensity === "vigorous" ? "selected" : ""}>Intensa</option>
          </select>
        </div>
      </div>
      <div class="field">
        <label for="activityNotes">Observações</label>
        <textarea id="activityNotes" name="notes">${escapeHtml(activity.notes || "")}</textarea>
      </div>
      <div class="button-row">
        ${isEditing ? `
          <button class="button" id="cancel-activity-edit" type="button">Cancelar</button>
          <button class="button danger" id="delete-activity-edit" data-activity-id="${escapeAttribute(existingActivity.id)}" type="button">Excluir</button>
        ` : `<button class="button" id="cancel-activity-entry" type="button">Cancelar</button>`}
        <button class="button primary" type="submit">${isEditing ? "Atualizar atividade" : "Registrar atividade"}</button>
      </div>
    </form>
  `;
}

function renderMeasurementUnavailable() {
  const profileRoute = location.hash.includes("/me/") ? "#/me/perfil" : "#/perfil";
  return `
    <section class="card empty-state">
      <h2>Crie um projeto antes de registrar medidas</h2>
      <p class="muted">Peso e medidas corporais precisam de uma linha de base para que a evolução seja calculada corretamente. As atividades físicas continuam disponíveis sem projeto.</p>
      <div class="button-row">
        <a class="button primary" href="${profileRoute}">Ir para o perfil</a>
      </div>
    </section>
  `;
}

export function renderEntry(state) {
  consumeActivityEditRequest();
  consumeMeasurementEditRequest();
  const editingMeasurement = editingMeasurementId
    ? state.entries.find((entry) => entry.id === editingMeasurementId)
    : null;
  if (editingMeasurementId && !editingMeasurement) editingMeasurementId = null;
  return `
    <div class="view-stack">
      ${renderModeSelector()}
      ${activeEntryMode === "activity" ? renderActivityForm(state) : `
        ${state.activeCycleId ? `
          ${entryForm(state.profile, editingMeasurement || {}, { isEditing: Boolean(editingMeasurement) })}
          <section class="card">
            <h2>Como medir</h2>
            <p class="muted">Para consistência, registre pela manhã, em jejum, depois de ir ao banheiro. No método por medidas, mantenha a fita nivelada e sem apertar a pele.</p>
          </section>
        ` : renderMeasurementUnavailable()}
      `}
    </div>
  `;
}

function bindMeasurementForm(state, persist, render) {
  const form = document.getElementById("entry-form");
  const methodField = form?.elements.bodyFatMethod;
  const valueField = form?.elements.bodyFatManual;
  const updateBodyFatFields = () => {
    const estimated = bodyFatMethodIsEstimated(methodField?.value);
    const field = form?.querySelector("[data-body-fat-value-field]");
    const help = form?.querySelector("[data-body-fat-help]");
    const notice = form?.querySelector("[data-body-fat-notice]");
    const calculator = form?.querySelector("[data-skinfold-calculator]");
    if (field) field.hidden = estimated;
    if (valueField) {
      valueField.disabled = estimated;
      valueField.required = !estimated;
    }
    if (help) help.textContent = estimated ? "" : "Informe o resultado obtido pelo método selecionado.";
    if (notice) notice.textContent = estimated
      ? "O aplicativo calculará uma estimativa pelas circunferências. O resultado não substitui uma avaliação profissional."
      : "O valor informado será priorizado. Para comparar a evolução, procure repetir o mesmo método e condições.";
    if (calculator) calculator.hidden = methodField?.value !== "caliper";
    const tracked = new Set(normalizeCircumferenceKeys(state.profile.trackedCircumferences));
    form?.querySelectorAll("[data-circumference-field]").forEach((field) => {
      const key = field.dataset.circumferenceField;
      const requiredForEstimate = estimated
        && ["waist", "neck"].includes(key)
        || estimated && state.profile.sex === "female" && key === "hip";
      field.hidden = !tracked.has(key) && !requiredForEstimate;
      field.querySelectorAll("input").forEach((input) => {
        input.disabled = field.hidden;
        input.required = requiredForEstimate;
      });
    });
  };
  methodField?.addEventListener("change", updateBodyFatFields);
  updateBodyFatFields();
  bindSkinfoldCalculator({
    prefix: "entry",
    profile: state.profile,
    measurementDate: () => form?.elements.date?.value,
    targetInput: valueField,
    onResult: () => {
      entryHasPendingChanges = true;
    }
  });
  const historyRoute = () => location.hash.includes("/me/") ? "#/me/historico" : "#/historico";
  const dashboardRoute = () => location.hash.includes("/me/") ? "#/me/dashboard" : "#/dashboard";
  const cancelMeasurement = async () => {
    if (entryHasPendingChanges && !await confirmAction({
      title: editingMeasurementId ? "Cancelar edição?" : "Descartar registro?",
      message: editingMeasurementId
        ? "As alterações realizadas não serão salvas."
        : "Os dados preenchidos não serão salvos.",
      confirmLabel: "Descartar",
      tone: "warning"
    })) return;
    entryHasPendingChanges = false;
    const destination = editingMeasurementId
      ? historyRoute()
      : dashboardRoute();
    editingMeasurementId = null;
    location.hash = destination;
    render();
  };
  document.getElementById("cancel-measurement-entry")?.addEventListener("click", cancelMeasurement);

  document.getElementById("delete-measurement-edit")?.addEventListener("click", async () => {
    if (!editingMeasurementId || !await confirmAction({
      title: "Excluir registro?",
      message: "Esta medição será removida do histórico.",
      confirmLabel: "Excluir",
      tone: "danger"
    })) return;
    const entryId = editingMeasurementId;
    state.entries = state.entries.filter((entry) => entry.id !== entryId);
    persist({ type: "entry-delete", entryId });
    entryHasPendingChanges = false;
    editingMeasurementId = null;
    showToast("Registro excluído.");
    location.hash = historyRoute();
    render();
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = data.get("date");
    if (state.profile.startDate && date <= state.profile.startDate) {
      showToast("A data deve ser posterior à data inicial do perfil.");
      return;
    }
    if (state.entries.some((item) => item.id !== editingMeasurementId && item.date === date)) {
      showToast("Já existe um registro nessa data. Edite-o pelo histórico.");
      return;
    }
    const circumferenceRules = {};
    event.currentTarget.querySelectorAll("[data-circumference-field] input:not(:disabled)")
      .forEach((input) => {
        const item = circumferenceCatalog.find((candidate) =>
          candidate.legacyField === input.name
          || `circumference_${candidate.key}` === input.name
          || input.name.startsWith(`circumference_${candidate.key}_`)
        );
        circumferenceRules[input.name] = {
          rule: "circumferenceCm",
          label: item?.label || "Circunferência",
          required: input.required
        };
      });
    const validation = await validateNumericFields(event.currentTarget, {
      weightKg: { rule: "weightKg", label: "Peso", required: true },
      ...circumferenceRules,
      bodyFatManual: {
        rule: "bodyFatPercent",
        label: "Gordura corporal",
        required: !bodyFatMethodIsEstimated(data.get("bodyFatMethod"))
      }
    });
    if (!validation.valid) {
      showToast("Revise os campos destacados.");
      return;
    }

    const currentEntry = editingMeasurementId
      ? state.entries.find((item) => item.id === editingMeasurementId)
      : null;
    const circumferences = { ...(currentEntry?.circumferences || {}) };
    normalizeCircumferenceKeys(state.profile.trackedCircumferences).forEach((key) => {
      const item = circumferenceCatalog.find((candidate) => candidate.key === key);
      if (!item || item.legacyField) return;
      circumferences[key] = item.bilateral
        ? {
            right: toNumber(data.get(`circumference_${key}_right`)),
            left: toNumber(data.get(`circumference_${key}_left`))
          }
        : toNumber(data.get(`circumference_${key}`));
    });
    const entry = createEntry({
      ...(currentEntry || {}),
      cycleId: state.activeCycleId || null,
      date,
      weightKg: toNumber(data.get("weightKg")),
      waistCm: toNumber(data.get("waistCm")),
      neckCm: toNumber(data.get("neckCm")),
      hipCm: toNumber(data.get("hipCm")),
      circumferences,
      bodyFatMethod: data.get("bodyFatMethod"),
      bodyFatManual: toNumber(data.get("bodyFatManual")),
      skinfolds: data.get("bodyFatMethod") === "caliper"
        ? parseSkinfoldData(data.get("skinfoldData"))
        : null,
      notes: data.get("notes").trim()
    });
    state.entries = [
      ...state.entries.filter((item) => item.id !== entry.id),
      entry
    ].sort((a, b) => a.date.localeCompare(b.date));
    const profileChanged = state.profile.baselineLocked !== true;
    if (profileChanged) {
      state.profile = {
        ...state.profile,
        baselineLocked: true,
        baselineLockedAt: new Date().toISOString()
      };
    }
    persist({ type: "entry-upsert", entry, profileChanged });
    entryHasPendingChanges = false;
    const wasEditing = Boolean(editingMeasurementId);
    editingMeasurementId = null;
    showToast(wasEditing ? "Registro atualizado." : "Registro salvo.");
    location.hash = wasEditing ? historyRoute() : dashboardRoute();
    render();
  });
}

function bindActivityForm(state, persist, render) {
  const activityRoute = () => location.hash.includes("/me/") ? "#/me/atividades" : "#/atividades";

  const cancelActivity = async () => {
    if (entryHasPendingChanges && !await confirmAction({
      title: editingActivityDate ? "Cancelar edição?" : "Descartar registro?",
      message: "As alterações realizadas não serão salvas.",
      confirmLabel: "Descartar",
      tone: "warning"
    })) return;
    entryHasPendingChanges = false;
    editingActivityDate = null;
    location.hash = activityRoute();
    render();
  };
  document.getElementById("cancel-activity-edit")?.addEventListener("click", cancelActivity);
  document.getElementById("cancel-activity-entry")?.addEventListener("click", cancelActivity);

  document.getElementById("delete-activity-edit")?.addEventListener("click", async (event) => {
    if (!await confirmAction({
      title: "Excluir atividade?",
      message: "Este registro será removido do histórico.",
      confirmLabel: "Excluir",
      tone: "danger"
    })) return;
    const activityId = event.currentTarget.dataset.activityId;
    state.activities = state.activities.filter((activity) => activity.id !== activityId);
    persist({ type: "activity-delete", activityId });
    entryHasPendingChanges = false;
    editingActivityDate = null;
    showToast("Atividade excluída.");
    location.hash = activityRoute();
    render();
  });

  document.getElementById("activityDate")?.addEventListener("change", (event) => {
    selectedActivityDate = event.currentTarget.value || todayISO();
    editingActivityDate = null;
    render();
  });

  document.getElementById("activity-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = data.get("date");
    const activityTypeIds = data.getAll("activityTypeIds");
    const customActivityName = data.get("customActivityName")?.trim() || "";
    const durationMinutes = toNumber(data.get("durationMinutes"));

    if (!date || date > todayISO()) {
      showToast("Informe uma data válida, sem usar dias futuros.");
      return;
    }
    if (!activityTypeIds.length && !customActivityName) {
      showToast("Selecione ou informe ao menos uma atividade.");
      return;
    }
    if (durationMinutes !== null && (durationMinutes <= 0 || durationMinutes > 1440)) {
      showToast("Informe uma duração válida.");
      return;
    }

    const newActivity = createActivity({
      date,
      activityTypeIds,
      customActivityName,
      durationMinutes,
      intensity: data.get("intensity"),
      notes: data.get("notes").trim()
    });
    const existingActivity = state.activities.find((item) => item.date === date);
    const isEditing = editingActivityDate === date && Boolean(existingActivity);
    const activity = !existingActivity || isEditing
      ? newActivity
      : mergeDailyActivity(existingActivity, newActivity);
    state.activities = [
      ...state.activities.filter((item) => item.id !== activity.id),
      activity
    ].sort((a, b) => a.date.localeCompare(b.date));
    persist({ type: "activity-upsert", activity });
    entryHasPendingChanges = false;
    editingActivityDate = null;
    showToast(isEditing
      ? "Atividade atualizada."
      : existingActivity ? "Atividade acrescentada ao registro do dia." : "Atividade registrada.");
    location.hash = activityRoute();
    render();
  });
}

export function bindEntry(state, persist, render) {
  document.querySelectorAll("#entry-form, #activity-form").forEach((form) => {
    form.addEventListener("input", () => {
      entryHasPendingChanges = true;
    });
    form.addEventListener("change", () => {
      entryHasPendingChanges = true;
    });
  });
  document.querySelectorAll("[data-entry-mode]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (button.dataset.entryMode === activeEntryMode) return;
      if (entryHasPendingChanges && !await confirmAction({
        title: "Trocar tipo de registro?",
        message: "Os dados preenchidos nesta aba não serão salvos.",
        confirmLabel: "Trocar e descartar",
        tone: "warning"
      })) return;
      entryHasPendingChanges = false;
      activeEntryMode = button.dataset.entryMode;
      if (activeEntryMode === "activity") {
        selectedActivityDate = todayISO();
        editingActivityDate = null;
      }
      render();
    });
  });
  bindMeasurementForm(state, persist, render);
  bindActivityForm(state, persist, render);
}
