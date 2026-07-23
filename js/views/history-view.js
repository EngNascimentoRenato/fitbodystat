import { enrichEntries } from "../services/progress-service.js";
import { bodyFatMethods } from "../models/goal-model.js";
import { formatDate } from "../utils/date-utils.js";
import { formatCm, formatDecimal, formatKg, formatPercent, toNumber } from "../utils/number-utils.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

let editingEntryId = null;

function numberInput(name, value, label) {
  return `<input class="table-input number" name="${name}" inputmode="decimal" aria-label="${label}" value="${escapeAttribute(value ?? "")}" />`;
}

function renderBodyFatEditor(entry) {
  return `
    <div class="table-edit-stack">
      <select class="table-input" name="bodyFatMethod" aria-label="Método de gordura corporal">
        ${bodyFatMethods.map((method) => `
          <option value="${method.value}" ${method.value === (entry.bodyFatMethod || "navy") ? "selected" : ""}>${method.label}</option>
        `).join("")}
      </select>
      ${numberInput("bodyFatManual", entry.bodyFatManual, "Gordura informada em percentual")}
    </div>
  `;
}

function renderActions(entry, isEditing, baselineLocked) {
  if (entry.isBaseline) {
    return `
      <div class="table-actions">
        <span class="badge">Inicial</span>
        ${baselineLocked ? "" : `<a class="button" href="#/perfil">Editar no perfil</a>`}
      </div>
    `;
  }

  return isEditing ? `
    <div class="table-actions">
      <button class="button" data-cancel-entry type="button">Cancelar</button>
      <button class="button primary" data-save-entry="${escapeAttribute(entry.id)}" type="button">Salvar</button>
    </div>
  ` : `
    <div class="table-actions">
      <button class="button" data-edit-entry="${escapeAttribute(entry.id)}" type="button">Editar</button>
      <button class="button danger" data-delete-entry="${escapeAttribute(entry.id)}" type="button">Excluir</button>
    </div>
  `;
}

export function renderHistory(state) {
  const rows = enrichEntries(state.profile, state.entries).reverse();
  const baselineLocked = state.profile.baselineLocked === true || state.entries.length > 0;
  if (!rows.length) {
    return `<section class="card empty-state"><h2>Nenhum registro ainda</h2><p class="muted">Preencha o perfil para criar a linha inicial.</p></section>`;
  }

  return `
    <section class="card">
      <div class="chart-header">
        <div>
          <h2>Histórico</h2>
          <p class="muted">Registros semanais com cálculos automáticos.</p>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th class="number">Peso</th>
              <th class="number">Cintura</th>
              <th class="number">Pescoço</th>
              <th class="number">Quadril</th>
              <th class="number">IMC</th>
              <th class="number">Gordura</th>
              <th class="number">Semana</th>
              <th>Obs.</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((entry) => {
              const isEditing = !entry.isBaseline && entry.id === editingEntryId;
              return `
                <tr data-entry-row="${escapeAttribute(entry.id)}">
                  <td>${isEditing
                    ? `<input class="table-input" name="date" type="date" required value="${escapeAttribute(entry.date)}" />`
                    : formatDate(entry.date)}</td>
                  <td class="number">${isEditing ? numberInput("weightKg", entry.weightKg, "Peso") : formatKg(entry.weightKg)}</td>
                  <td class="number">${isEditing ? numberInput("waistCm", entry.waistCm, "Cintura") : formatCm(entry.waistCm)}</td>
                  <td class="number">${isEditing ? numberInput("neckCm", entry.neckCm, "Pescoço") : formatCm(entry.neckCm)}</td>
                  <td class="number">${isEditing ? numberInput("hipCm", entry.hipCm, "Quadril") : formatCm(entry.hipCm)}</td>
                  <td class="number">${formatDecimal(entry.bmi, 1)}</td>
                  <td class="number">${isEditing ? renderBodyFatEditor(entry) : formatPercent(entry.bodyFat)}</td>
                  <td class="number">${formatKg(entry.weekDiff)}</td>
                  <td>${isEditing
                    ? `<textarea class="table-input" name="notes" aria-label="Observações">${escapeHtml(entry.notes || "")}</textarea>`
                    : escapeHtml(entry.notes || "-")}</td>
                  <td>${renderActions(entry, isEditing, baselineLocked)}</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindHistory(state, persist, render) {
  document.querySelectorAll("[data-edit-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      editingEntryId = button.dataset.editEntry;
      render();
    });
  });

  document.querySelector("[data-cancel-entry]")?.addEventListener("click", () => {
    editingEntryId = null;
    render();
  });

  document.querySelector("[data-save-entry]")?.addEventListener("click", (event) => {
    const entryId = event.currentTarget.dataset.saveEntry;
    const row = event.currentTarget.closest("[data-entry-row]");
    const currentEntry = state.entries.find((entry) => entry.id === entryId);
    if (!row || !currentEntry) return;

    const value = (name) => row.querySelector(`[name="${name}"]`)?.value ?? "";
    const date = value("date");
    const weightKg = toNumber(value("weightKg"));
    if (!date || !Number.isFinite(weightKg) || weightKg <= 0) {
      showToast("Informe uma data e um peso válidos.");
      return;
    }
    if (state.profile.startDate && date <= state.profile.startDate) {
      showToast("A medição deve ser posterior à data inicial do perfil.");
      return;
    }
    if (state.entries.some((entry) => entry.id !== entryId && entry.date === date)) {
      showToast("Já existe outro registro nessa data.");
      return;
    }

    const updatedEntry = {
      ...currentEntry,
      date,
      weightKg,
      waistCm: toNumber(value("waistCm")),
      neckCm: toNumber(value("neckCm")),
      hipCm: toNumber(value("hipCm")),
      bodyFatMethod: value("bodyFatMethod"),
      bodyFatManual: toNumber(value("bodyFatManual")),
      notes: value("notes").trim()
    };
    state.entries = state.entries
      .map((entry) => entry.id === entryId ? updatedEntry : entry)
      .sort((a, b) => a.date.localeCompare(b.date));
    editingEntryId = null;
    persist({ type: "entry-upsert", entry: updatedEntry });
    showToast("Registro atualizado.");
    render();
  });

  document.querySelectorAll("[data-delete-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirmAction("Excluir este registro?")) return;
      const entryId = button.dataset.deleteEntry;
      state.entries = state.entries.filter((entry) => entry.id !== entryId);
      editingEntryId = null;
      persist({ type: "entry-delete", entryId });
      showToast("Registro excluído.");
      render();
    });
  });
}
