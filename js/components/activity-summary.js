import { activityLabel } from "../data/activity-catalog.js";
import { formatActivityMinutes, weeklyActivitySummary } from "../services/activity-service.js";
import { formatDate, todayISO } from "../utils/date-utils.js";
import { escapeAttribute } from "../utils/html-utils.js";
import { progressBar } from "./progress-bar.js";

const weekdayLabels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

function activityNames(activity) {
  const names = (activity?.activityTypeIds || []).map(activityLabel);
  if (activity?.customActivityName) names.push(activity.customActivityName);
  return names.join(", ");
}

export function weeklyActivityCard(profile, activities = [], routePrefix = "") {
  const summary = weeklyActivitySummary(activities, profile.weeklyActivityGoalDays);
  const targetMinutes = summary.goalDays * (Number(profile.averageActivityDurationMinutes) || 0);
  const today = todayISO();
  const activityByDate = new Map(activities.map((activity) => [activity.date, activity]));

  return `
    <section class="card activity-summary-card">
      <div class="chart-header">
        <div>
          <p class="eyebrow">Atividade física</p>
          <h2>${summary.completedDays} de ${summary.goalDays} dias nesta semana</h2>
        </div>
        <a class="button" href="#${routePrefix}/atividades">Ver atividades</a>
      </div>
      ${progressBar(summary.progress)}
      ${targetMinutes ? `
        <p class="activity-minutes-summary">
          <strong>${formatActivityMinutes(summary.totalMinutes)}</strong> de
          ${formatActivityMinutes(targetMinutes)} planejados nesta semana
        </p>
      ` : ""}
      <div class="week-strip">
        ${summary.dates.map((date, index) => {
          const activity = activityByDate.get(date);
          const state = activity ? "active" : date > today ? "future" : "empty";
          const title = activity ? `${formatDate(date)}: ${activityNames(activity)}` : formatDate(date);
          return `
            <div class="week-day ${state}" title="${escapeAttribute(title)}">
              <span>${weekdayLabels[index]}</span>
              <strong>${date.slice(-2)}</strong>
              <small aria-hidden="true">${activity ? "✓" : ""}</small>
            </div>
          `;
        }).join("")}
      </div>
    </section>
  `;
}
