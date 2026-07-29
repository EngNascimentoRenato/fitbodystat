import { escapeAttribute } from "../utils/html-utils.js";
import { measurementHelpButton } from "./measurement-guide.js";
import {
  circumferenceCatalog,
  circumferenceValue,
  normalizeCircumferenceKeys
} from "../data/circumference-catalog.js";
import { bodyFatMethodIsEstimated } from "../models/goal-model.js";

export function measurementFields(profile, entry = {}, method = entry.bodyFatMethod) {
  const estimated = bodyFatMethodIsEstimated(method);
  const selected = normalizeCircumferenceKeys(profile.trackedCircumferences);
  const requiredForCalculation = [
    "waist",
    ...(estimated ? ["neck", ...(profile.sex === "female" ? ["hip"] : [])] : [])
  ];
  const calculationKeys = ["waist", "neck", "hip"];
  const keys = [...new Set([...selected, ...calculationKeys])];
  return keys.map((key) => {
    const item = circumferenceCatalog.find((candidate) => candidate.key === key);
    if (!item) return "";
    const required = requiredForCalculation.includes(key);
    const tracked = selected.includes(key);
    if (item.bilateral) {
      const right = circumferenceValue(entry, key, "", "right")
        ?? circumferenceValue(profile, key, "start", "right")
        ?? "";
      const left = circumferenceValue(entry, key, "", "left")
        ?? circumferenceValue(profile, key, "start", "left")
        ?? "";
      return `
        <fieldset class="field bilateral-circumference measurement-compact-item"
          data-circumference-field="${key}"
          data-tracked="${tracked}" ${tracked ? "" : "hidden"}>
          <legend>${item.label} (cm)</legend>
          <div class="bilateral-circumference-grid">
            <div class="field">
              <label for="circumference_${key}_right">Direito</label>
              <input id="circumference_${key}_right" name="circumference_${key}_right"
                inputmode="decimal" value="${escapeAttribute(right)}" />
            </div>
            <div class="field">
              <label for="circumference_${key}_left">Esquerdo</label>
              <input id="circumference_${key}_left" name="circumference_${key}_left"
                inputmode="decimal" value="${escapeAttribute(left)}" />
            </div>
          </div>
        </fieldset>
      `;
    }
    const name = item.legacyField || `circumference_${key}`;
    const value = circumferenceValue(entry, key)
      ?? circumferenceValue(profile, key, "start")
      ?? "";
    return `
      <div class="field measurement-compact-item" data-circumference-field="${key}"
        data-tracked="${tracked}" ${tracked || required ? "" : "hidden"}>
        <label for="${name}">${item.label} (cm) ${item.helpKey ? measurementHelpButton(item.helpKey) : ""}</label>
        <input id="${name}" name="${name}" inputmode="decimal"
          ${required ? "required" : ""} value="${escapeAttribute(value)}" />
        ${required ? `<span class="help-text">Obrigatório para a estimativa por circunferências.</span>` : ""}
      </div>
    `;
  }).join("");
}
