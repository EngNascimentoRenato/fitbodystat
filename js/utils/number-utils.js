export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatKg(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${value.toFixed(1).replace(".", ",")} kg`;
}

export function formatCm(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${Math.round(value)} cm`;
}

export function formatPercent(value) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : `${value.toFixed(1).replace(".", ",")}%`;
}

export function formatDecimal(value, digits = 1) {
  return value === null || value === undefined || Number.isNaN(value) ? "-" : value.toFixed(digits).replace(".", ",");
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}
