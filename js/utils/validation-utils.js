import { toNumber } from "./number-utils.js";
import { confirmAction } from "../components/modal.js";

export function requiredFields(payload, fields) {
  return fields.filter((field) => payload[field] === null || payload[field] === undefined || payload[field] === "");
}

export function isPositive(value) {
  return Number.isFinite(value) && value > 0;
}

export const numericRules = {
  heightCm: { min: 80, max: 250, unusualMin: 120, unusualMax: 220 },
  weightKg: { min: 20, max: 500, unusualMin: 35, unusualMax: 300 },
  circumferenceCm: { min: 15, max: 300, unusualMin: 25, unusualMax: 220 },
  bodyFatPercent: { min: 1, max: 75 },
  targetBmi: { min: 12, max: 60, unusualMin: 16, unusualMax: 40 },
  weeklyChangeKg: { min: 0.05, max: 5, unusualMax: 1.5 },
  deadlineMonths: { min: 0.25, max: 120, unusualMax: 36 },
  activityDays: { min: 1, max: 7 },
  activityMinutes: { min: 1, max: 1440, unusualMax: 480 }
};

function errorNode(field) {
  const parent = field.closest(".field") || field.parentElement;
  let node = parent?.querySelector(`[data-field-error="${field.name || field.id}"]`);
  if (!node && parent) {
    node = document.createElement("span");
    node.className = "field-error";
    node.dataset.fieldError = field.name || field.id;
    node.setAttribute("role", "alert");
    parent.append(node);
  }
  return node;
}

export function clearFieldError(field) {
  field.removeAttribute("aria-invalid");
  const node = field.closest(".field")?.querySelector(`[data-field-error="${field.name || field.id}"]`)
    || field.parentElement?.querySelector(`[data-field-error="${field.name || field.id}"]`);
  node?.remove();
}

export function setFieldError(field, message) {
  field.setAttribute("aria-invalid", "true");
  const node = errorNode(field);
  if (node) node.textContent = message;
}

export function heightInMetersSuggestion(value) {
  const number = toNumber(value);
  if (number === null || number < 0.8 || number > 2.5) return null;
  return Math.round(number * 100);
}

export async function resolveHeightInput(field, ask = confirmAction) {
  if (!field || field.disabled) return true;
  const suggestion = heightInMetersSuggestion(field.value);
  if (suggestion === null) return true;
  const accepted = await ask({
    title: "Confirmar altura",
    message: `Você quis informar ${suggestion} cm?`,
    confirmLabel: "Usar esta altura"
  });
  if (accepted) {
    field.value = String(suggestion);
    clearFieldError(field);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }
  setFieldError(field, "Informe a altura em centímetros. Exemplo: 176.");
  field.focus();
  return false;
}

export async function validateNumericFields(container, specifications, options = {}) {
  const values = {};
  const unusual = [];
  let firstInvalid = null;

  Object.entries(specifications).forEach(([name, specification]) => {
    const field = container.querySelector(`[name="${name}"]`);
    if (!field || field.disabled) return;
    clearFieldError(field);

    const raw = String(field.value || "").trim();
    const label = specification.label || name;
    if (!raw) {
      values[name] = null;
      if (specification.required) {
        setFieldError(field, `${label} é obrigatório.`);
        firstInvalid ||= field;
      }
      return;
    }

    const value = toNumber(raw);
    const rule = numericRules[specification.rule] || specification;
    values[name] = value;
    if (value === null) {
      setFieldError(field, `Informe um valor numérico válido para ${label.toLowerCase()}.`);
      firstInvalid ||= field;
      return;
    }
    if ((rule.min !== undefined && value < rule.min) || (rule.max !== undefined && value > rule.max)) {
      setFieldError(
        field,
        `${label} deve ficar entre ${String(rule.min).replace(".", ",")} e ${String(rule.max).replace(".", ",")}.`
      );
      firstInvalid ||= field;
      return;
    }
    if ((rule.unusualMin !== undefined && value < rule.unusualMin)
      || (rule.unusualMax !== undefined && value > rule.unusualMax)) {
      unusual.push(`${label}: ${raw}`);
    }
  });

  if (firstInvalid) {
    firstInvalid.focus();
    return { valid: false, values };
  }

  if (unusual.length && options.confirmUnusual !== false) {
    const ask = options.ask || confirmAction;
    const accepted = await ask({
      title: "Conferir valores",
      message: `Estes valores parecem pouco usuais:\n\n${unusual.join("\n")}`,
      confirmLabel: "Continuar",
      tone: "warning"
    });
    if (!accepted) return { valid: false, values, unusual: true };
  }

  return { valid: true, values };
}
