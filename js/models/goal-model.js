export const bodyFatMethods = [
  { value: "circumference", label: "Estimativa por medidas corporais", estimated: true },
  { value: "bioimpedance", label: "Bioimpedância" },
  { value: "caliper", label: "Adipômetro" },
  { value: "dexa", label: "DEXA" },
  { value: "professional", label: "Informado por profissional" },
  { value: "other", label: "Outro método" }
];

export function normalizeBodyFatMethod(method) {
  return method === "navy" || !method ? "circumference" : method;
}

export function bodyFatMethodLabel(method) {
  const normalized = normalizeBodyFatMethod(method);
  return bodyFatMethods.find((item) => item.value === normalized)?.label || "Método não informado";
}

export function bodyFatMethodIsEstimated(method) {
  return normalizeBodyFatMethod(method) === "circumference";
}
