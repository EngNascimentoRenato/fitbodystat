import { activityLabel } from "../data/activity-catalog.js";
import {
  monthCalendar,
  monthLabel,
  recentWeekTotals,
  shiftMonth,
  weeklyActivitySummary
} from "../services/activity-service.js";
import { formatDate, todayISO } from "../utils/date-utils.js";
import { formatDecimal } from "../utils/number-utils.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { confirmAction } from "../components/modal.js";
import { showToast } from "../components/toast.js";

let visibleMonth = todayISO().slice(0, 7);

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const intensityLabels = {
  light: "Leve",
  moderate: "Moderada",
  vigorous: "Intensa"
};

function activityNames(activity) {
  const names = (activity.activityTypeIds || []).map(activityLabel);
  if (activity.customActivityName) names.push(activity.customActivityName);
  return names.join(", ") || "Atividade";
}

function renderCalendar(activities) {
  const cells = monthCalendar(visibleMonth, activities);
  const today = todayISO();
  return `
    <section class="card">
      <div class="calendar-toolbar">
        <button class="icon-button" data-calendar-shift="-1" type="button" aria-label="Mês anterior">‹</button>
        <h2>${monthLabel(visibleMonth)}</h2>
        <button class="icon-button" data-calendar-shift="1" type="button" aria-label="Próximo mês">›</button>
      </div>
      <div class="activity-calendar">
        ${weekdayLabels.map((label) => `<span class="calendar-weekday">${label}</span>`).join("")}
        ${cells.map((cell) => {
          if (!cell) return `<div class="calendar-day empty"></div>`;
          const active = cell.activity?.completed;
          return `
            <div class="calendar-day ${active ? "active" : ""} ${cell.date === today ? "today" : ""}"
              title="${escapeAttribute(active ? activityNames(cell.activity) : formatDate(cell.date))}">
              <strong>${cell.day}</strong>
              ${active ? `<span class="calendar-check" aria-hidden="true">✓</span>` : ""}
              ${active ? `<small>${escapeHtml(activityNames(cell.activity))}</small>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderRecentWeeks(activities, goalDays) {
  const weeks = recentWeekTotals(activities);
  return `
    <section class="card">
      <h2>Últimas quatro semanas</h2>
      <div class="grid four">
        ${weeks.map((week) => {
          const percentage = Math.min(100, (week.count / Math.max(1, goalDays)) * 100);
          return `
            <article class="mini-stat">
              <span>Semana de ${formatDate(week.start).slice(0, 5)}</span>
              <strong>${week.count} ${week.count === 1 ? "dia" : "dias"}</strong>
              <div class="progress-track" aria-label="${formatDecimal(percentage, 0)}% da meta">
                <div class="progress-fill" style="width:${percentage}%"></div>
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderHistory(activities) {
  const rows = [...activities].sort((a, b) => b.date.localeCompare(a.date));
  return `
    <section class="card">
      <div class="chart-header">
        <div>
          <h2>Histórico de atividades</h2>
          <p class="muted">Cada data representa um dia ativo.</p>
        </div>
      </div>
      ${rows.length ? `
        <div class="activity-history-list">
          <div class="activity-history-header" aria-hidden="true">
            <span>Data</span>
            <span>Atividade</span>
            <span>Duração</span>
            <span>Intensidade</span>
            <span>Observações</span>
            <span>Ações</span>
          </div>
          ${rows.map((activity) => `
            <article class="activity-history-row">
              <strong>${formatDate(activity.date)}</strong>
              <div class="activity-row-main">
                <p>${escapeHtml(activityNames(activity))}</p>
                <small>${escapeHtml(activity.notes || "")}</small>
              </div>
              <span>${activity.durationMinutes ? `${activity.durationMinutes} min` : "-"}</span>
              <span>${intensityLabels[activity.intensity] || "-"}</span>
              <span>${escapeHtml(activity.notes || "-")}</span>
              <div class="table-actions">
                <button class="button" data-edit-activity="${escapeAttribute(activity.date)}" type="button">Editar</button>
                <button class="button danger" data-delete-activity="${escapeAttribute(activity.id)}" type="button">Excluir</button>
              </div>
            </article>
          `).join("")}
        </div>
      ` : `<div class="empty-state"><p class="muted">Nenhuma atividade registrada.</p></div>`}
    </section>
  `;
}

export function renderActivities(state) {
  const activities = state.activities || [];
  const goalDays = state.profile.weeklyActivityGoalDays || 3;
  const summary = weeklyActivitySummary(activities, goalDays);
  return `
    <div class="view-stack">
      <section class="grid three">
        <article class="mini-stat">
          <span>Esta semana</span>
          <strong>${summary.completedDays} de ${summary.goalDays} dias</strong>
          <small>${summary.progress}% da meta semanal</small>
        </article>
        <article class="mini-stat">
          <span>Total registrado</span>
          <strong>${activities.length} ${activities.length === 1 ? "dia" : "dias"}</strong>
          <small>Desde o primeiro registro</small>
        </article>
        <article class="mini-stat">
          <span>Última atividade</span>
          <strong>${activities.length ? formatDate([...activities].sort((a, b) => b.date.localeCompare(a.date))[0].date) : "-"}</strong>
          <small>${activities.length ? activityNames([...activities].sort((a, b) => b.date.localeCompare(a.date))[0]) : "Sem registros"}</small>
        </article>
      </section>
      ${renderCalendar(activities)}
      ${renderRecentWeeks(activities, goalDays)}
      ${renderHistory(activities)}
    </div>
  `;
}

export function bindActivities(state, persist, render) {
  document.querySelectorAll("[data-calendar-shift]").forEach((button) => {
    button.addEventListener("click", () => {
      visibleMonth = shiftMonth(visibleMonth, Number(button.dataset.calendarShift));
      render();
    });
  });

  document.querySelectorAll("[data-edit-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      sessionStorage.setItem("fitbodystat-edit-activity-date", button.dataset.editActivity);
      location.hash = location.hash.includes("/me/") ? "#/me/registro" : "#/registro";
    });
  });

  document.querySelectorAll("[data-delete-activity]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!confirmAction("Excluir esta atividade?")) return;
      const activityId = button.dataset.deleteActivity;
      state.activities = state.activities.filter((activity) => activity.id !== activityId);
      persist({ type: "activity-delete", activityId });
      showToast("Atividade excluída.");
      render();
    });
  });
}
