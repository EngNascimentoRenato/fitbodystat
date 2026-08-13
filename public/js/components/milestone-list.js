import { formatKg, formatCm } from "../utils/number-utils.js";

function formatRemaining(item) {
  const value = Math.abs(Number(item.remaining) || 0);
  if (item.unit === "%" || item.bodyFatTarget) return `${value.toFixed(1).replace(".", ",")} p.p.`;
  if (item.unit === "cm" || item.waistTarget) return formatCm(value);
  return formatKg(value);
}

export function milestoneList(milestones) {
  if (!milestones.length) {
    return `<p class="muted">Nenhum marco adicional foi definido para este objetivo.</p>`;
  }
  return `
    <ul class="milestone-list">
      ${milestones.map((item) => `
        <li class="milestone-item ${item.state || (item.reached ? "completed" : "future")}">
          <span class="milestone-dot">${item.reached ? "✓" : "•"}</span>
          <div>
            <strong>${item.title}</strong>
            <p class="muted">${item.detail}</p>
            <span class="badge ${item.reached ? "" : "warning"}">
              ${item.statusText || (item.reached
                ? "Alcançado"
                : `Faltam ${formatRemaining(item)}`)}
            </span>
          </div>
        </li>
      `).join("")}
    </ul>
  `;
}
