import { statCard } from "../components/stat-card.js";
import { progressRing } from "../components/progress-ring.js";
import { progressBar } from "../components/progress-bar.js";
import { lineChart } from "../components/chart-card.js";
import { milestoneList } from "../components/milestone-list.js";
import {
  enrichEntries,
  generatePlannedSeries,
  getLatestEntry,
  getMaintenanceStatus,
  getMilestones,
  getProgressMode,
  goalProgress,
  nextMilestone
} from "../services/progress-service.js";
import { formatCm, formatDecimal, formatKg, formatPercent } from "../utils/number-utils.js";
import { formatDate } from "../utils/date-utils.js";
import { weeklyActivityCard } from "../components/activity-summary.js";
import { formatActivityMinutes, weeklyActivitySummary } from "../services/activity-service.js";

function dashboardSummary(profile, latest, activities) {
  const mode = getProgressMode(profile);
  const activity = weeklyActivitySummary(activities, profile.weeklyActivityGoalDays);
  const targetMinutes = activity.goalDays * (Number(profile.averageActivityDurationMinutes) || 0);

  if (mode === "maintain") {
    const maintenance = getMaintenanceStatus(profile, latest);
    const activityDetail = targetMinutes
      ? `${formatActivityMinutes(activity.totalMinutes)} de ${formatActivityMinutes(targetMinutes)} planejados nesta semana.`
      : `${activity.completedDays} de ${activity.goalDays} dias ativos nesta semana.`;
    if (!maintenance) {
      return {
        title: "Construa sua consistência semanal",
        detail: activityDetail,
        progress: activity.progress,
        ringLabel: "da semana"
      };
    }
    const position = maintenance.current > maintenance.maximum ? "acima" : "abaixo";
    return {
      title: maintenance.reached
        ? "Peso dentro da faixa de manutenção"
        : `${maintenance.distance.toFixed(1).replace(".", ",")} kg ${position} da faixa`,
      detail: activityDetail,
      progress: activity.progress,
      ringLabel: "da semana"
    };
  }

  const next = nextMilestone(profile, latest);
  return {
    title: latest ? `Último registro em ${formatDate(latest.date)}` : "Comece pelo primeiro registro",
    detail: next ? `Próximo marco: ${next.title}.` : "Todas as principais metas foram alcançadas.",
    progress: goalProgress(profile, latest),
    ringLabel: "da meta"
  };
}

export function renderDashboard(state, routePrefix = "", options = {}) {
  const { profile, entries } = state;
  const enriched = enrichEntries(profile, entries);
  const latest = getLatestEntry(profile, entries);
  const summary = dashboardSummary(profile, latest, state.activities || []);
  const startDate = profile.startDate || latest?.date;
  const startTime = startDate ? new Date(`${startDate}T00:00:00`).getTime() : Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const daysFromStart = (date) => (new Date(`${date}T00:00:00`).getTime() - startTime) / dayMs;

  const actualWeight = enriched.map((entry) => ({
    label: formatDate(entry.date),
    value: entry.weightKg,
    x: daysFromStart(entry.date)
  }));
  const plannedWeight = generatePlannedSeries(profile, "weight");

  const actualWaist = enriched
    .filter((entry) => entry.waistCm)
    .map((entry) => ({
      label: formatDate(entry.date),
      value: entry.waistCm,
      x: daysFromStart(entry.date)
    }));
  const plannedWaist = generatePlannedSeries(profile, "waist");
  const evolutionOnly = options.presentationMode === "evolution";

  return `
    <div class="view-stack dashboard-stack">
      ${weeklyActivityCard(profile, state.activities || [], routePrefix)}

      <section class="card hero-panel dashboard-summary-card">
        <div>
          <p class="eyebrow">Resumo atual</p>
          <h2>${summary.title}</h2>
          <p>${summary.detail}</p>
          ${progressBar(summary.progress)}
        </div>
        ${progressRing(summary.progress, summary.ringLabel)}
      </section>

      ${evolutionOnly ? "" : `<section class="grid four dashboard-metrics">
        ${statCard("Peso atual", formatKg(latest?.weightKg), `${formatKg(latest?.weightKg - profile.startWeightKg)} desde o início`)}
        ${statCard("IMC", formatDecimal(latest?.bmi, 1), latest?.bmiClass || "Sem dados")}
        ${statCard("Cintura", formatCm(latest?.waistCm), `Inicial: ${formatCm(profile.startWaistCm)}`)}
        ${statCard("Gordura corporal", formatPercent(latest?.bodyFat), latest?.bodyFatClass || "Por medidas ou medidor")}
      </section>`}

      ${evolutionOnly
        ? lineChart({ title: "Peso real vs planejado", description: "A linha planejada cobre todo o prazo da meta.", actual: actualWeight, planned: plannedWeight, unit: "kg" })
        : `<div class="split">
        ${lineChart({ title: "Peso real vs planejado", description: "A linha planejada cobre todo o prazo da meta.", actual: actualWeight, planned: plannedWeight, unit: "kg" })}
        <section class="card">
          <h2>Metas</h2>
          ${milestoneList(getMilestones(profile, latest))}
        </section>
      </div>`}

      ${lineChart({ title: "Cintura real vs planejada", description: "Acompanhe tendência de cintura junto da mudança de peso.", actual: actualWaist, planned: plannedWaist, unit: "cm" })}
    </div>
  `;
}
