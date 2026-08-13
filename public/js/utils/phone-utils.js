export function normalizePhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if ((digits.length === 10 || digits.length === 11)) return `+55${digits}`;
  return `+${digits}`;
}

export function phoneIsValid(value) {
  const digits = String(value || "").replace(/\D/g, "");
  return !digits || (digits.length >= 10 && digits.length <= 15);
}

export function formatPhone(value) {
  const normalized = normalizePhone(value);
  const digits = normalized.replace(/\D/g, "");
  if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
    const local = digits.slice(2);
    const area = local.slice(0, 2);
    const first = local.length === 11 ? local.slice(2, 7) : local.slice(2, 6);
    const last = local.slice(-4);
    return `(${area}) ${first}-${last}`;
  }
  return normalized;
}
