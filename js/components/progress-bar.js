import { clamp } from "../utils/number-utils.js";

export function progressBar(value) {
  const safe = clamp(value || 0, 0, 100);
  return `
    <div class="progress-track" aria-label="Progresso de ${safe}%">
      <div class="progress-fill" style="width: ${safe}%"></div>
    </div>
  `;
}
