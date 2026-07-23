import { entryForm } from "../components/entry-form.js";
import { activityPicker } from "../components/activity-picker.js";
import { createEntry } from "../models/entry-model.js";
import { createActivity } from "../models/activity-model.js";
import { todayISO } from "../utils/date-utils.js";
import { toNumber } from "../utils/number-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { showToast } from "../components/toast.js";

let activeEntryMode = "measurement";
let selectedActivityDate = todayISO();

function consumeActivityEditRequest() {
  const editDate = sessionStorage.getItem("fitbodystat-edit-activity-date");
  if (!editDate) return;
  activeEntryMode = "activity";
  selectedActivityDate = editDate;
  sessionStorage.removeItem("fitbodystat-edit-activity-date");
}

function renderModeSelector() {
  return `
    <div class="entry-mode" role="tablist" aria-label="Tipo de registro">
      <button data-entry-mode="measurement" type="button" role="tab"
        aria-selected="${activeEntryMode === "measurement"}">Medidas corporais</button>
      <button data-entry-mode="activity" type="button" role="tab"
        aria-selected="${activeEntryMode === "activity"}">Atividade física</button>
    </div>
  `;
}

function renderActivityForm(state) {
  const activity = state.activities.find((item) => item.date === selectedActivityDate) || {};
  const isEditing = Boolean(activity.id);
  return `
    <form class="form card" id="activity-form">
      <div class="chart-header">
        <div>
          <h2>${isEditing ? "Atualizar atividade" : "Registrar atividade"}</h2>
          <p class="muted">Marque as modalidades realizadas. Os demais detalhes são opcionais.</p>
        </div>
      </div>
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
        <button class="button primary" type="submit">${isEditing ? "Atualizar atividade" : "Registrar atividade"}</button>
      </div>
    </form>
  `;
}

export function renderEntry(state) {
  consumeActivityEditRequest();
  return `
    <div class="view-stack">
      ${renderModeSelector()}
      ${activeEntryMode === "activity" ? renderActivityForm(state) : `
        ${entryForm(state.profile)}
        <section class="card">
          <h2>Como medir</h2>
          <p class="muted">Para consistência, registre pela manhã, em jejum, depois de ir ao banheiro. No método por medidas, mantenha a fita nivelada e sem apertar a pele.</p>
        </section>
      `}
    </div>
  `;
}

function bindMeasurementForm(state, persist, render) {
  document.getElementById("entry-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const date = data.get("date");
    if (state.profile.startDate && date <= state.profile.startDate) {
      showToast("A data deve ser posterior à data inicial do perfil.");
      return;
    }
    if (state.entries.some((item) => item.date === date)) {
      showToast("Já existe um registro nessa data. Edite-o pelo histórico.");
      return;
    }

    const entry = createEntry({
      date,
      weightKg: toNumber(data.get("weightKg")),
      waistCm: toNumber(data.get("waistCm")),
      neckCm: toNumber(data.get("neckCm")),
      hipCm: toNumber(data.get("hipCm")),
      bodyFatMethod: data.get("bodyFatMethod"),
      bodyFatManual: toNumber(data.get("bodyFatManual")),
      notes: data.get("notes").trim()
    });
    state.entries = [...state.entries, entry].sort((a, b) => a.date.localeCompare(b.date));
    const profileChanged = state.profile.baselineLocked !== true;
    if (profileChanged) {
      state.profile = {
        ...state.profile,
        baselineLocked: true,
        baselineLockedAt: new Date().toISOString()
      };
    }
    persist({ type: "entry-upsert", entry, profileChanged });
    showToast("Registro salvo.");
    location.hash = "#/dashboard";
    render();
  });
}

function bindActivityForm(state, persist, render) {
  document.getElementById("activityDate")?.addEventListener("change", (event) => {
    selectedActivityDate = event.currentTarget.value || todayISO();
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

    const activity = createActivity({
      date,
      activityTypeIds,
      customActivityName,
      durationMinutes,
      intensity: data.get("intensity"),
      notes: data.get("notes").trim()
    });
    state.activities = [
      ...state.activities.filter((item) => item.id !== activity.id),
      activity
    ].sort((a, b) => a.date.localeCompare(b.date));
    persist({ type: "activity-upsert", activity });
    showToast("Atividade registrada.");
    location.hash = location.hash.includes("/me/") ? "#/me/atividades" : "#/atividades";
    render();
  });
}

export function bindEntry(state, persist, render) {
  document.querySelectorAll("[data-entry-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      activeEntryMode = button.dataset.entryMode;
      if (activeEntryMode === "activity") selectedActivityDate = todayISO();
      render();
    });
  });
  bindMeasurementForm(state, persist, render);
  bindActivityForm(state, persist, render);
}
