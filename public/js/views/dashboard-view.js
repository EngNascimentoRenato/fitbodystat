import { statCard } from "../components/stat-card.js";
import { progressRing } from "../components/progress-ring.js";
import { progressBar } from "../components/progress-bar.js";
import { lineChart } from "../components/chart-card.js";
import { milestoneList } from "../components/milestone-list.js";
import { milestoneEmptyState, milestoneTimeline } from "../components/milestone-timeline.js";
import {
  enrichEntries,
  generatePlannedSeries,
  getLatestEntry,
  getGoalJourney,
  getMaintenanceStatus,
  getProgressMode
} from "../services/progress-service.js";
import { formatCm, formatDecimal, formatKg, formatPercent } from "../utils/number-utils.js";
import { bodyFatMethodLabel } from "../models/goal-model.js";
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

  const journey = getGoalJourney(profile, latest);
  const next = journey.next;
  const milestoneProgress = journey.stageProgress;
  const milestoneDetail = milestoneProgress.total
    ? `${formatDecimal(milestoneProgress.completed, 1)} de ${formatDecimal(milestoneProgress.total, 1)} ${milestoneProgress.unit} concluídos nesta etapa.`
    : "";
  return {
    title: latest ? `Último registro em ${formatDate(latest.date)}` : "Comece pelo primeiro registro",
    detail: next
      ? `Próximo marco: ${next.title}. ${milestoneDetail}`
      : "Todas as principais metas foram alcançadas.",
    progress: milestoneProgress.value,
    ringLabel: "do próximo marco",
    journey
  };
}

export function renderDashboard(state, routePrefix = "", options = {}) {
  if (!state.activeCycleId) {
    const pendingInvitations = Number(options.pendingInvitations) || 0;
    const professionalCount = Number(options.professionalCount) || 0;
    const installCard = options.showInstallSuggestion ? `
      <section class="card install-suggestion-card">
        <div>
          <p class="eyebrow">Acesso rápido</p>
          <h2>Instale o FitBodyStat</h2>
          <p class="muted">Abra como aplicativo no celular ou computador.</p>
        </div>
        <div class="button-row">
          <button class="button" id="dashboard-install-app" type="button">Instalar aplicativo</button>
          <button class="button text-button" id="dismiss-install-suggestion" type="button">Agora não</button>
        </div>
      </section>
    ` : "";
    if (options.patientContext === true) {
      return `
        <div class="view-stack">
          <section class="card hero-panel">
            <div>
              <p class="eyebrow">Paciente sem projeto</p>
              <h2>Este paciente ainda não possui um projeto ativo</h2>
              <p>Crie a linha de base e o planejamento quando houver informações suficientes para iniciar o acompanhamento.</p>
            </div>
          </section>
          <section class="card">
            <p class="eyebrow">Próximo passo</p>
            <h2>Iniciar acompanhamento</h2>
            <p class="muted">O projeto reunirá medidas iniciais, objetivo e ritmo planejado.</p>
            <div class="button-row">
              <a class="button primary" href="#/perfil">Criar projeto</a>
              <a class="button" href="#/pacientes">Voltar aos pacientes</a>
            </div>
          </section>
        </div>
      `;
    }
    const linkedProfessionalText = professionalCount === 1
      ? "Você possui 1 profissional vinculado."
      : `Você possui ${professionalCount} profissionais vinculados.`;
    return `
      <div class="view-stack project-onboarding-stack">
        <section class="card project-onboarding-card">
          <div class="project-onboarding-copy">
            <p class="eyebrow">Primeiro passo</p>
            <h2>Comece seu acompanhamento</h2>
            <p>Crie um projeto para definir seu ponto de partida e liberar registros, metas, atividades e histórico.</p>
          </div>
          <a class="button primary project-onboarding-action" href="#${routePrefix}/perfil">Criar meu projeto</a>
        </section>

        ${pendingInvitations || professionalCount ? `
          <section class="card project-context-card">
            ${pendingInvitations ? `
              <p class="eyebrow">Convite pendente</p>
              <h2>Você recebeu um convite profissional</h2>
              <p class="muted">${pendingInvitations} convite${pendingInvitations === 1 ? "" : "s"} aguardando sua decisão.</p>
              <a class="button" href="#${routePrefix}/vinculos">Revisar convite</a>
            ` : `
              <p class="eyebrow">Acompanhamento profissional</p>
              <h2>${linkedProfessionalText}</h2>
              <p class="muted">Seu projeto também poderá ser acompanhado por um profissional autorizado.</p>
              <a class="button" href="#${routePrefix}/vinculos">Meus profissionais</a>
            `}
          </section>
        ` : ""}
        ${installCard}
      </div>
    `;
  }
  const { profile, entries } = state;
  const enriched = enrichEntries(profile, entries);
  const latest = getLatestEntry(profile, entries);
  const summary = dashboardSummary(profile, latest, state.activities || []);
  const goalJourney = getGoalJourney(profile, latest);
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
        ${statCard(
          "Peso atual",
          formatKg(latest?.weightKg),
          `${formatKg(latest?.weightKg - profile.startWeightKg)} desde o dia ${formatDate(profile.startDate)}`
        )}
        ${statCard("IMC", formatDecimal(latest?.bmi, 1), latest?.bmiClass || "Sem dados")}
        ${statCard("Cintura", formatCm(latest?.waistCm), `Inicial: ${formatCm(profile.startWaistCm)}`)}
        ${statCard(
          "Gordura corporal",
          formatPercent(latest?.bodyFat),
          latest?.bodyFat
            ? `${latest.bodyFatClass} · ${bodyFatMethodLabel(latest.bodyFatMethod)}`
            : "Sem dados"
        )}
      </section>`}

      ${evolutionOnly
        ? lineChart({ title: "Peso real vs planejado", description: "A linha planejada cobre todo o prazo da meta.", actual: actualWeight, planned: plannedWeight, unit: "kg" })
        : `<div class="split">
        ${lineChart({ title: "Peso real vs planejado", description: "A linha planejada cobre todo o prazo da meta.", actual: actualWeight, planned: plannedWeight, unit: "kg" })}
        <section class="card">
          <h2>Metas</h2>
          ${goalJourney.totalCount || goalJourney.complementary.length
            ? milestoneTimeline(goalJourney, { compact: true })
            : milestoneEmptyState()}
          ${goalJourney.complementary.length
            ? `<h3 class="section-subtitle">Marcos complementares</h3>${milestoneList(goalJourney.complementary)}`
            : ""}
        </section>
      </div>`}

      ${lineChart({ title: "Cintura real vs planejada", description: "Acompanhe tendência de cintura junto da mudança de peso.", actual: actualWaist, planned: plannedWaist, unit: "cm" })}
    </div>
  `;
}
