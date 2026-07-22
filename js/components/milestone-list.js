import { formatKg, formatCm } from "../utils/number-utils.js";

export function milestoneList(milestones) {
  return `
    <ul class="milestone-list">
      ${milestones.map((item) => `
        <li class="milestone-item">
          <span class="milestone-dot">${item.reached ? "✓" : "•"}</span>
          <div>
            <strong>${item.title}</strong>
            <p class="muted">${item.detail}</p>
            <span class="badge ${item.reached ? "" : "warning"}">
              ${item.reached ? "Alcançado" : `Faltam ${item.waistTarget ? formatCm(Math.abs(item.remaining)) : formatKg(Math.abs(item.remaining))}`}
            </span>
          </div>
        </li>
      `).join("")}
    </ul>
  `;
}
