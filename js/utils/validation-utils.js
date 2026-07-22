export function requiredFields(payload, fields) {
  return fields.filter((field) => payload[field] === null || payload[field] === undefined || payload[field] === "");
}

export function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}
