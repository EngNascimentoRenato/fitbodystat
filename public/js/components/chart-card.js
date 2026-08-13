import { formatDecimal } from "../utils/number-utils.js";

function scale(value, min, max, size, offset = 0) {
  if (max === min) return offset + size / 2;
  return offset + size - ((value - min) / (max - min)) * size;
}

export function lineChart({ title, description, actual = [], planned = [], unit = "kg" }) {
  const width = 760;
  const height = 300;
  const pad = { top: 22, right: 24, bottom: 42, left: 54 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const normalize = (series) =>
    series
      .filter((point) => Number.isFinite(point.value))
      .map((point, index) => ({
        ...point,
        x: Number.isFinite(point.x) ? point.x : index
      }));

  const actualSeries = normalize(actual);
  const plannedSeries = normalize(planned);
  const all = [...actualSeries, ...plannedSeries];

  if (all.length < 2 || actualSeries.length + plannedSeries.length < 2) {
    return `
      <section class="card chart-shell">
        <div class="chart-header">
          <div><h2>${title}</h2><p class="muted">${description}</p></div>
        </div>
        <div class="empty-state muted">Preencha o perfil e adicione registros para ver o gráfico.</div>
      </section>
    `;
  }

  const values = all.map((point) => point.value);
  const xs = all.map((point) => point.x);
  const minY = Math.floor(Math.min(...values) - 1);
  const maxY = Math.ceil(Math.max(...values) + 1);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const xFor = (x) => maxX === minX ? pad.left : pad.left + ((x - minX) / (maxX - minX)) * plotW;
  const yFor = (value) => scale(value, minY, maxY, plotH, pad.top);
  const pathFor = (series) => series.map((point, index) => `${index === 0 ? "M" : "L"} ${xFor(point.x).toFixed(1)} ${yFor(point.value).toFixed(1)}`).join(" ");
  const ticks = [minY, Math.round((minY + maxY) / 2), maxY];

  return `
    <section class="card chart-shell">
      <div class="chart-header">
        <div><h2>${title}</h2><p class="muted">${description}</p></div>
      </div>
      <div class="chart" role="img" aria-label="${title}: valores em ${unit}">
        <svg viewBox="0 0 ${width} ${height}">
          ${ticks.map((tick) => `<line class="chart-grid-line" x1="${pad.left}" y1="${yFor(tick)}" x2="${width - pad.right}" y2="${yFor(tick)}"></line><text class="chart-label" x="12" y="${yFor(tick) + 4}">${formatDecimal(tick, 0)} ${unit}</text>`).join("")}
          <line class="chart-axis" x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}"></line>
          ${plannedSeries.length > 1 ? `<path class="chart-line-secondary" d="${pathFor(plannedSeries)}"></path>` : ""}
          ${actualSeries.length > 1 ? `<path class="chart-line-primary" d="${pathFor(actualSeries)}"></path>` : ""}
          ${actualSeries.map((point) => `<circle class="chart-dot" cx="${xFor(point.x)}" cy="${yFor(point.value)}" r="5"><title>${point.label}: ${formatDecimal(point.value)} ${unit}</title></circle>`).join("")}
        </svg>
      </div>
      <div class="legend">
        <span class="legend-item"><span class="legend-swatch"></span>Real</span>
        ${plannedSeries.length > 1 ? `<span class="legend-item"><span class="legend-swatch secondary"></span>Planejado</span>` : ""}
      </div>
    </section>
  `;
}
