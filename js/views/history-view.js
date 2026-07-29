import { enrichEntries } from "../services/progress-service.js";
import { bodyFatMethodLabel } from "../models/goal-model.js";
import { formatDate } from "../utils/date-utils.js";
import { formatCm, formatDecimal, formatKg, formatPercent } from "../utils/number-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import {
  circumferenceCatalog,
  circumferenceValue,
  normalizeCircumferenceKeys
} from "../data/circumference-catalog.js";

function renderBodyFat(entry) {
  return `
    <span>${formatPercent(entry.bodyFat)}</span>
    <small class="table-secondary">${escapeHtml(bodyFatMethodLabel(entry.bodyFatMethod))}</small>
  `;
}

function renderActions(entry, baselineLocked) {
  if (entry.isBaseline) {
    return `
      <div class="table-actions">
        <span class="badge">Inicial</span>
        ${baselineLocked ? "" : `<a class="button" href="#/perfil">Editar no perfil</a>`}
      </div>
    `;
  }

  return `
    <div class="table-actions">
      <button class="icon-button history-edit-button" data-edit-entry="${escapeAttribute(entry.id)}"
        type="button" aria-label="Editar registro de ${escapeAttribute(formatDate(entry.date))}" title="Editar registro">✎</button>
    </div>
  `;
}

export function renderHistory(state) {
  const rows = enrichEntries(state.profile, state.entries).reverse();
  const extraCircumferences = normalizeCircumferenceKeys(state.profile.trackedCircumferences)
    .map((key) => circumferenceCatalog.find((item) => item.key === key))
    .filter((item) => item && !["waist", "neck", "hip"].includes(item.key));
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
              ${extraCircumferences.map((item) => item.bilateral
                ? `<th class="number">${escapeHtml(item.label)} D</th><th class="number">${escapeHtml(item.label)} E</th>`
                : `<th class="number">${escapeHtml(item.label)}</th>`
              ).join("")}
              <th class="number">IMC</th>
              <th class="number">Gordura</th>
              <th class="number">Semana</th>
              <th>Obs.</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((entry) => {
              return `
                <tr data-entry-row="${escapeAttribute(entry.id)}">
                  <td>${formatDate(entry.date)}</td>
                  <td class="number">${formatKg(entry.weightKg)}</td>
                  <td class="number">${formatCm(entry.waistCm)}</td>
                  <td class="number">${formatCm(entry.neckCm)}</td>
                  <td class="number">${formatCm(entry.hipCm)}</td>
                  ${extraCircumferences.map((item) => item.bilateral
                    ? `<td class="number">${formatCm(circumferenceValue(entry, item.key, "", "right"))}</td>
                       <td class="number">${formatCm(circumferenceValue(entry, item.key, "", "left"))}</td>`
                    : `<td class="number">${formatCm(circumferenceValue(entry, item.key))}</td>`
                  ).join("")}
                  <td class="number">${formatDecimal(entry.bmi, 1)}</td>
                  <td class="number">${renderBodyFat(entry)}</td>
                  <td class="number">${formatKg(entry.weekDiff)}</td>
                  <td>${escapeHtml(entry.notes || "-")}</td>
                  <td>${renderActions(entry, baselineLocked)}</td>
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
      sessionStorage.setItem("fitbodystat-edit-entry-id", button.dataset.editEntry);
      location.hash = location.hash.includes("/me/") ? "#/me/registro" : "#/registro";
    });
  });
}
