import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { formatKg } from "../utils/number-utils.js";

function milestoneStatus(milestone) {
  if (milestone.statusText) return milestone.statusText;
  if (milestone.reached) return "Alcançado";
  if (Number.isFinite(Number(milestone.remaining))) {
    return `Faltam ${formatKg(Math.abs(Number(milestone.remaining)))}`;
  }
  return "Em andamento";
}

export function milestoneTimeline(journey, options = {}) {
  const milestones = journey?.milestones || [];
  if (!milestones.length) return "";
  const compact = options.compact === true;
  return `
    <div class="milestone-timeline-wrap ${compact ? "compact" : ""}">
      <div class="milestone-timeline-progress">
        <span>Progresso total do projeto</span>
        <strong>${journey.totalProgress}%</strong>
      </div>
      <div class="milestone-timeline" role="list" aria-label="Linha do tempo do projeto">
        ${milestones.map((milestone) => `
          <div class="milestone-timeline-item ${escapeAttribute(milestone.state)}"
            role="listitem" aria-label="${escapeAttribute(`${milestone.title}: ${milestone.state}`)}">
            <span class="milestone-timeline-dot">${milestone.state === "completed" ? "✓" : milestone.sequence}</span>
            <div class="milestone-timeline-content">
              <strong>${escapeHtml(milestone.title)}</strong>
              ${milestone.detail ? `<span>${escapeHtml(milestone.detail)}</span>` : ""}
              <span class="badge ${milestone.reached ? "" : "warning"}">${escapeHtml(milestoneStatus(milestone))}</span>
            </div>
          </div>
        `).join("")}
      </div>
      <p class="milestone-timeline-summary">
        ${journey.completedCount} de ${journey.totalCount} marcos principais concluídos
      </p>
    </div>
  `;
}

export function milestoneEmptyState() {
  return `
    <div class="milestone-empty-state" role="status">
      <strong>Todas as metas foram desativadas.</strong>
      <p>Para configurar novamente, acesse Perfil &gt; Objetivo e planejamento e selecione Editar.</p>
    </div>
  `;
}
