import { clamp } from "../utils/number-utils.js";

export function progressRing(value, label = "da meta") {
  const safe = clamp(value || 0, 0, 100);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (safe / 100) * circumference;
  return `
    <div class="progress-ring" role="img" aria-label="${safe}% ${label}">
      <svg viewBox="0 0 180 180">
        <circle class="ring-bg" cx="90" cy="90" r="${radius}"></circle>
        <circle class="ring-fill" cx="90" cy="90" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}"></circle>
        <text class="ring-text" x="90" y="88">${safe}%</text>
        <text class="ring-label" x="90" y="112">${label}</text>
      </svg>
    </div>
  `;
}
