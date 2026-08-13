export function statCard(label, value, detail = "") {
  return `
    <article class="card stat-card">
      <span class="stat-label">${label}</span>
      <strong class="stat-value">${value}</strong>
      <span class="stat-detail">${detail}</span>
    </article>
  `;
}
