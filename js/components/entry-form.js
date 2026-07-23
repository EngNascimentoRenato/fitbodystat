import { bodyFatMethods } from "../models/goal-model.js";
import { todayISO } from "../utils/date-utils.js";
import { measurementFields } from "./measurement-form.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

export function entryForm(profile, entry = {}) {
  return `
    <form class="form card" id="entry-form">
      <div class="form-grid">
        <div class="field">
          <label for="date">Data</label>
          <input id="date" name="date" type="date" required value="${escapeAttribute(entry.date || todayISO())}" />
        </div>
        <div class="field">
          <label for="weightKg">Peso (kg)</label>
          <input id="weightKg" name="weightKg" inputmode="decimal" required value="${escapeAttribute(entry.weightKg ?? "")}" />
        </div>
        ${measurementFields(profile, entry)}
        <div class="field">
          <label for="bodyFatMethod">Método de gordura corporal</label>
          <select id="bodyFatMethod" name="bodyFatMethod">
            ${bodyFatMethods.map((method) => `<option value="${method.value}" ${method.value === (entry.bodyFatMethod || "navy") ? "selected" : ""}>${method.label}</option>`).join("")}
          </select>
        </div>
        <div class="field">
          <label for="bodyFatManual">Gordura informada pelo medidor (%)</label>
          <input id="bodyFatManual" name="bodyFatManual" inputmode="decimal" value="${escapeAttribute(entry.bodyFatManual ?? "")}" />
          <span class="help-text">Opcional. Se preencher, o app usa este valor.</span>
        </div>
      </div>
      <div class="field">
        <label for="notes">Observações</label>
        <textarea id="notes" name="notes">${escapeHtml(entry.notes || "")}</textarea>
      </div>
      <div class="button-row">
        <button class="button primary" type="submit">Salvar registro</button>
      </div>
    </form>
  `;
}
