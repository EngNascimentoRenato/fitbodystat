import { escapeAttribute } from "../utils/html-utils.js";

export function measurementFields(profile, entry = {}) {
  return `
    <div class="field">
      <label for="waistCm">Cintura (cm)</label>
      <input id="waistCm" name="waistCm" inputmode="decimal" required value="${escapeAttribute(entry.waistCm ?? "")}" />
    </div>
    <div class="field">
      <label for="neckCm">Pescoço (cm)</label>
      <input id="neckCm" name="neckCm" inputmode="decimal" value="${escapeAttribute(entry.neckCm ?? profile.startNeckCm ?? "")}" />
      <span class="help-text">Necessário para estimar gordura por medidas.</span>
    </div>
    <div class="field">
      <label for="hipCm">Quadril (cm)</label>
      <input id="hipCm" name="hipCm" inputmode="decimal" value="${escapeAttribute(entry.hipCm ?? profile.startHipCm ?? "")}" />
      <span class="help-text">Necessário para cálculo feminino pelo método da Marinha e opcional para acompanhamento geral.</span>
    </div>
  `;
}
