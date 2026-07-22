import { enrichEntries } from "../services/progress-service.js";
import { formatDate } from "../utils/date-utils.js";
import { formatCm, formatDecimal, formatKg, formatPercent } from "../utils/number-utils.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";

export function renderHistory(state) {
  const rows = enrichEntries(state.profile, state.entries).reverse();
  if (!rows.length) {
    return `<section class="card empty-state"><h2>Nenhum registro ainda</h2><p class="muted">Adicione o primeiro registro semanal.</p></section>`;
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
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((entry) => `
              <tr>
                <td>${formatDate(entry.date)}</td>
                <td class="number">${formatKg(entry.weightKg)}</td>
                <td class="number">${formatCm(entry.waistCm)}</td>
                <td class="number">${formatCm(entry.neckCm)}</td>
                <td class="number">${formatCm(entry.hipCm)}</td>
                <td class="number">${formatDecimal(entry.bmi, 1)}</td>
                <td class="number">${formatPercent(entry.bodyFat)}</td>
                <td class="number">${formatKg(entry.weekDiff)}</td>
                <td>${entry.notes || "-"}</td>
                <td><button class="button" data-delete-entry="${entry.id}" type="button">Excluir</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

export function bindHistory(state, persist, render) {
  document.querySelectorAll("[data-delete-entry]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirmAction("Excluir este registro?")) return;
      state.entries = state.entries.filter((entry) => entry.id !== button.dataset.deleteEntry);
      persist();
      showToast("Registro excluído.");
      render();
    });
  });
}
