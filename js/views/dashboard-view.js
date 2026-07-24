import { statCard } from "../components/stat-card.js";
import { progressRing } from "../components/progress-ring.js";
import { progressBar } from "../components/progress-bar.js";
import { lineChart } from "../components/chart-card.js";
import { milestoneList } from "../components/milestone-list.js";
import {
  enrichEntries,
  generatePlannedSeries,
  getLatestEntry,
  getMilestones,
  goalProgress,
  nextMilestone
} from "../services/progress-service.js";
import { formatCm, formatDecimal, formatKg, formatPercent } from "../utils/number-utils.js";
import { formatDate } from "../utils/date-utils.js";
import { weeklyActivityCard } from "../components/activity-summary.js";

export function renderDashboard(state, routePrefix = "", options = {}) {
  const { profile, entries } = state;
  const enriched = enrichEntries(profile, entries);
  const latest = getLatestEntry(profile, entries);
  const progress = goalProgress(profile, latest);
  const next = nextMilestone(profile, latest);
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
    <div class="view-stack">
      <section class="card hero-panel">
        <div>
          <p class="eyebrow">Resumo atual</p>
          <h2>${latest ? `Último registro em ${formatDate(latest.date)}` : "Comece pelo primeiro registro"}</h2>
          <p>${next ? `Próximo marco: ${next.title}.` : "Todos as principais metas foram alcançadas."}</p>
          ${progressBar(progress)}
        </div>
        ${progressRing(progress, "da meta")}
      </section>

      ${evolutionOnly ? "" : `<section class="grid four">
        ${statCard("Peso atual", formatKg(latest?.weightKg), `${formatKg(latest?.accumulatedLoss || 0)} de diferença`)}
        ${statCard("IMC", formatDecimal(latest?.bmi, 1), latest?.bmiClass || "Sem dados")}
        ${statCard("Cintura", formatCm(latest?.waistCm), `Inicial: ${formatCm(profile.startWaistCm)}`)}
        ${statCard("Gordura corporal", formatPercent(latest?.bodyFat), latest?.bodyFatClass || "Por medidas ou medidor")}
      </section>`}

      ${weeklyActivityCard(profile, state.activities || [], routePrefix)}

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
