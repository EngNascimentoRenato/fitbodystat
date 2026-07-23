import { normalizeMonthlyPlan } from "../data/seed-plan.js";
import { getGoalDeadlineMonths, getLatestEntry, getMilestones, getWeeklyChangeGoal } from "../services/progress-service.js";
import { milestoneList } from "../components/milestone-list.js";
import { formatCm, formatDecimal, formatKg } from "../utils/number-utils.js";
import { escapeHtml } from "../utils/html-utils.js";

export function renderGoals(state) {
  const latest = getLatestEntry(state.profile, state.entries);
  const monthlyPlan = normalizeMonthlyPlan(state.profile, state.goalPlan);
  const deadline = getGoalDeadlineMonths(state.profile);
  return `
    <div class="view-stack">
      <section class="grid two">
        <article class="card">
          <h2>Marcos importantes</h2>
          ${milestoneList(getMilestones(state.profile, latest))}
        </article>
        <article class="card">
          <h2>Ritmo sustentável</h2>
          <p class="muted">A mudança semanal configurada é de ${formatKg(getWeeklyChangeGoal(state.profile))}. O prazo estimado da meta é de ${formatDecimal(deadline, 1)} meses.</p>
        </article>
      </section>

      <section class="card">
        <h2>Planejamento mensal</h2>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Prazo</th>
                <th class="number">Meta peso</th>
                <th class="number">Diferença acum.</th>
                <th class="number">IMC</th>
                <th class="number">Cintura</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyPlan.map((item) => `
                <tr>
                  <td>${escapeHtml(item.label)}</td>
                  <td class="number">${formatKg(item.weightKg)}</td>
                  <td class="number">${formatKg(item.lossKg)}</td>
                  <td class="number">${formatDecimal(item.bmi, 1)}</td>
                  <td class="number">${formatCm(item.waistCm)}</td>
                  <td>${escapeHtml(item.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  `;
}
