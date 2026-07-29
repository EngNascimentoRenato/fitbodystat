import { bodyFatMethods, normalizeBodyFatMethod } from "../models/goal-model.js";
import { todayISO } from "../utils/date-utils.js";
import { measurementFields } from "./measurement-form.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { skinfoldCalculator } from "./skinfold-calculator.js";

export function entryForm(profile, entry = {}, options = {}) {
  const bodyFatMethod = normalizeBodyFatMethod(entry.bodyFatMethod);
  const isEditing = options.isEditing === true;
  return `
    <form class="form card" id="entry-form">
      <div class="chart-header">
        <div>
          <h2>${isEditing ? "Editar medição" : "Registrar medidas"}</h2>
          <p class="muted">${isEditing
            ? "Atualize somente os dados deste registro."
            : "Informe as medidas coletadas nesta data."}</p>
        </div>
      </div>
      <fieldset class="measurement-group">
        <legend>Dados principais</legend>
        <div class="form-grid compact-measurement-grid">
        <div class="field">
          <label for="date">Data</label>
          <input id="date" name="date" type="date" required max="${todayISO()}" value="${escapeAttribute(entry.date || todayISO())}" />
        </div>
        <div class="field">
          <label for="weightKg">Peso (kg)</label>
          <input id="weightKg" name="weightKg" inputmode="decimal" required value="${escapeAttribute(entry.weightKg ?? "")}" />
        </div>
        </div>
      </fieldset>
      <fieldset class="measurement-group">
        <legend>Circunferências</legend>
        <div class="form-grid">
        ${measurementFields(profile, entry, bodyFatMethod)}
        </div>
      </fieldset>
      <fieldset class="measurement-group">
        <legend>Composição corporal</legend>
        <div class="form-grid">
        <div class="field">
          <label for="bodyFatMethod">Origem do percentual de gordura</label>
          <select id="bodyFatMethod" name="bodyFatMethod">
            ${bodyFatMethods.map((method) => `<option value="${method.value}" ${method.value === bodyFatMethod ? "selected" : ""}>${method.label}</option>`).join("")}
          </select>
        </div>
        <div class="field" data-body-fat-value-field>
          <label for="bodyFatManual">Percentual informado (%)</label>
          <input id="bodyFatManual" name="bodyFatManual" inputmode="decimal" value="${escapeAttribute(entry.bodyFatManual ?? "")}" />
          <span class="help-text" data-body-fat-help></span>
          <div data-skinfold-calculator>
            ${skinfoldCalculator("entry", profile, entry.skinfolds)}
          </div>
        </div>
        </div>
        <p class="form-notice measurement-method-notice" data-body-fat-notice></p>
      </fieldset>
      <div class="field">
        <label for="notes">Observações</label>
        <textarea id="notes" name="notes">${escapeHtml(entry.notes || "")}</textarea>
      </div>
      <div class="button-row">
        <button class="button" id="cancel-measurement-entry" type="button">Cancelar</button>
        ${isEditing
          ? `<button class="button danger" id="delete-measurement-edit" type="button">Excluir</button>`
          : ""}
        <button class="button primary" type="submit">${isEditing ? "Salvar alterações" : "Salvar registro"}</button>
      </div>
    </form>
  `;
}
