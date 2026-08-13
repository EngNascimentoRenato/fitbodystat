export const circumferenceCatalog = [
  { key: "waist", label: "Cintura", legacyField: "waistCm", helpKey: "waist" },
  { key: "abdomen", label: "Abdômen" },
  { key: "hip", label: "Quadril", legacyField: "hipCm", helpKey: "hip" },
  { key: "chest", label: "Peitoral" },
  { key: "shoulders", label: "Ombros" },
  { key: "relaxedArm", label: "Braço relaxado", bilateral: true },
  { key: "flexedArm", label: "Braço contraído", bilateral: true },
  { key: "forearm", label: "Antebraço", bilateral: true },
  { key: "thigh", label: "Coxa", bilateral: true },
  { key: "calf", label: "Panturrilha", bilateral: true },
  { key: "neck", label: "Pescoço", legacyField: "neckCm", helpKey: "neck", calculationOnly: true }
];

export const defaultCircumferenceKeys = ["waist"];

export function normalizeCircumferenceKeys(keys) {
  const valid = new Set(circumferenceCatalog.map((item) => item.key));
  const source = Array.isArray(keys) ? keys : defaultCircumferenceKeys;
  return [...new Set(["waist", ...source.filter((key) => valid.has(key))])];
}

export function circumferenceItem(key) {
  return circumferenceCatalog.find((item) => item.key === key) || null;
}

export function circumferenceValue(record = {}, key, prefix = "", side = null) {
  const item = circumferenceItem(key);
  if (!item) return null;
  if (item.legacyField) {
    const field = prefix
      ? `${prefix}${item.legacyField[0].toUpperCase()}${item.legacyField.slice(1)}`
      : item.legacyField;
    return record[field] ?? record.circumferences?.[key] ?? null;
  }
  const value = record.circumferences?.[key];
  if (!item.bilateral || !side) return value ?? null;
  if (value && typeof value === "object") return value[side] ?? null;
  return side === "right" ? value ?? null : null;
}
