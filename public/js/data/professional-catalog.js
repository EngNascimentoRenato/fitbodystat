export const professionalCatalog = Object.freeze([
  { value: "personal-trainer", label: "Personal Trainer", careArea: "physical-training" },
  { value: "physical-educator", label: "Educador(a) Físico(a)", careArea: "physical-training" },
  { value: "nutritionist", label: "Nutricionista", careArea: "nutrition" },
  { value: "nutrologist", label: "Nutrólogo(a)", careArea: "nutrition" }
]);

const legacyCareAreas = Object.freeze({
  physician: "medical",
  "physical-therapist": "physical-therapy",
  other: "other"
});

export const careAreaLabels = Object.freeze({
  "physical-training": "Treinamento físico",
  nutrition: "Nutrição",
  medical: "Medicina",
  "physical-therapy": "Fisioterapia",
  other: "Outra área"
});

export function professionalTypeLabel(value) {
  return professionalCatalog.find((item) => item.value === value)?.label
    || ({ physician: "Médico", "physical-therapist": "Fisioterapeuta", other: "Outra área" })[value]
    || value
    || "Área não informada";
}

export function careAreaForProfession(value) {
  return professionalCatalog.find((item) => item.value === value)?.careArea
    || legacyCareAreas[value]
    || "other";
}

export function careAreaLabel(value) {
  return careAreaLabels[value] || value || "Área não informada";
}

export function professionalOptions(selected = "") {
  return professionalCatalog.map((item) =>
    `<option value="${item.value}" ${item.value === selected ? "selected" : ""}>${item.label}</option>`
  ).join("");
}
