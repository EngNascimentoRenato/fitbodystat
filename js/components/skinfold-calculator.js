import { calculateBodyFatBySkinfoldThreeSite } from "../services/body-fat-service.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { showToast } from "./toast.js";

function ageAtDate(birthDate, measurementDate) {
  if (!birthDate || !measurementDate) return null;
  const birth = new Date(`${birthDate}T00:00:00`);
  const current = new Date(`${measurementDate}T00:00:00`);
  if (Number.isNaN(birth.getTime()) || Number.isNaN(current.getTime())) return null;
  let age = current.getFullYear() - birth.getFullYear();
  const beforeBirthday = current.getMonth() < birth.getMonth()
    || (current.getMonth() === birth.getMonth() && current.getDate() < birth.getDate());
  if (beforeBirthday) age -= 1;
  return age;
}

export function skinfoldCalculator(prefix, profile = {}, existing = null) {
  const data = existing || {};
  const readings = data.readingsMm || {};
  const male = profile.sex === "male";
  return `
    <button class="button skinfold-open" id="${prefix}-skinfold-open" type="button">
      Calcular pelas dobras
    </button>
    <input type="hidden" name="skinfoldData" id="${prefix}-skinfold-data"
      value="${escapeAttribute(data.protocol ? JSON.stringify(data) : "")}" />
    <dialog class="account-dialog skinfold-dialog" id="${prefix}-skinfold-dialog">
      <div class="skinfold-dialog-content" id="${prefix}-skinfold-form">
        <div class="account-dialog-header">
          <div>
            <p class="eyebrow">Jackson-Pollock de três dobras</p>
            <h2>Calcular gordura corporal</h2>
          </div>
          <button class="icon-button" data-close-skinfold type="button" aria-label="Fechar">×</button>
        </div>
        <p class="muted">Informe a média das leituras de cada dobra em milímetros.</p>
        <div class="form-grid">
          <div class="field">
            <label for="${prefix}-skinfold-age">Idade na avaliação</label>
            <input id="${prefix}-skinfold-age" name="age" type="number" min="18" max="100"
              value="${escapeAttribute(data.age ?? "")}" required />
          </div>
          ${male ? `
            ${skinfoldField(prefix, "chestMm", "Peitoral", readings.chestMm)}
            ${skinfoldField(prefix, "abdomenMm", "Abdômen", readings.abdomenMm)}
          ` : `
            ${skinfoldField(prefix, "tricepsMm", "Tríceps", readings.tricepsMm)}
            ${skinfoldField(prefix, "suprailiacMm", "Supra-ilíaca", readings.suprailiacMm)}
          `}
          ${skinfoldField(prefix, "thighMm", "Coxa", readings.thighMm)}
        </div>
        <p class="form-notice">Estimativa antropométrica. A precisão depende da técnica, do ponto anatômico e da calibração do adipômetro.</p>
        <output class="skinfold-result" id="${prefix}-skinfold-result"
          ${data.bodyFatPercent ? "" : "hidden"}>
          <span>Resultado estimado</span>
          <strong data-skinfold-result-value>${formatPercent(data.bodyFatPercent)}</strong>
          <small data-skinfold-result-detail>${formatDetail(data)}</small>
        </output>
        <div class="account-dialog-actions">
          <button class="button" data-close-skinfold type="button">Cancelar</button>
          <button class="button" data-calculate-skinfold type="button">Calcular</button>
          <button class="button primary" data-use-skinfold type="button"
            ${data.bodyFatPercent ? "" : "disabled"}>Usar valor</button>
        </div>
      </div>
    </dialog>
  `;
}

function formatPercent(value) {
  if (!Number.isFinite(Number(value))) return "";
  return `${Number(value).toFixed(1).replace(".", ",")}%`;
}

function formatDetail(data) {
  if (!Number.isFinite(Number(data?.sumMm))) return "";
  return `Soma das três dobras: ${Number(data.sumMm).toFixed(1).replace(".", ",")} mm`;
}

function skinfoldField(prefix, name, label, value) {
  return `
    <div class="field">
      <label for="${prefix}-skinfold-${name}">${escapeHtml(label)} (mm)</label>
      <input id="${prefix}-skinfold-${name}" name="${name}" inputmode="decimal"
        value="${escapeAttribute(value ?? "")}" required />
    </div>
  `;
}

export function bindSkinfoldCalculator({
  prefix,
  profile,
  measurementDate,
  targetInput,
  onResult
}) {
  const dialog = document.getElementById(`${prefix}-skinfold-dialog`);
  const form = document.getElementById(`${prefix}-skinfold-form`);
  const hidden = document.getElementById(`${prefix}-skinfold-data`);
  const resultBox = document.getElementById(`${prefix}-skinfold-result`);
  const resultValue = resultBox?.querySelector("[data-skinfold-result-value]");
  const resultDetail = resultBox?.querySelector("[data-skinfold-result-detail]");
  const useButton = form?.querySelector("[data-use-skinfold]");
  let pendingResult = parseSkinfoldData(hidden?.value);

  const readCalculation = () => {
    const values = {};
    form?.querySelectorAll("[name]").forEach((input) => {
      values[input.name] = input.value;
    });
    return calculateBodyFatBySkinfoldThreeSite({
      ...values,
      sex: profile.sex
    });
  };

  const showResult = (result) => {
    pendingResult = result;
    if (resultBox) resultBox.hidden = false;
    if (resultValue) resultValue.textContent = formatPercent(result.bodyFatPercent);
    if (resultDetail) resultDetail.textContent = formatDetail(result);
    if (useButton) useButton.disabled = false;
  };

  document.getElementById(`${prefix}-skinfold-open`)?.addEventListener("click", () => {
    if (!["male", "female"].includes(profile.sex)) {
      showToast("Informe o sexo usado como referência antes de calcular pelas dobras.");
      return;
    }
    const date = typeof measurementDate === "function" ? measurementDate() : measurementDate;
    const resolvedAgeInput = form?.querySelector('[name="age"]');
    if (resolvedAgeInput && !resolvedAgeInput.value) {
      resolvedAgeInput.value = ageAtDate(profile.birthDate, date) || "";
    }
    dialog?.showModal();
  });
  form?.querySelectorAll("input[name]").forEach((input) => {
    input.addEventListener("input", () => {
      pendingResult = null;
      if (resultBox) resultBox.hidden = true;
      if (useButton) useButton.disabled = true;
    });
  });
  dialog?.querySelectorAll("[data-close-skinfold]").forEach((button) => {
    button.addEventListener("click", () => dialog.close());
  });
  dialog?.addEventListener("cancel", () => dialog.close());
  form?.querySelector("[data-calculate-skinfold]")?.addEventListener("click", () => {
    const result = readCalculation();
    if (!result) {
      showToast("Revise a idade e as leituras das dobras.");
      return;
    }
    showResult(result);
  });
  useButton?.addEventListener("click", () => {
    if (!pendingResult) {
      showToast("Calcule o resultado antes de usar o valor.");
      return;
    }
    const result = pendingResult;
    if (targetInput) targetInput.value = String(result.bodyFatPercent).replace(".", ",");
    if (hidden) hidden.value = JSON.stringify(result);
    onResult?.(result);
    dialog?.close();
    showToast(`Gordura corporal estimada em ${String(result.bodyFatPercent).replace(".", ",")}%.`);
  });
}

export function parseSkinfoldData(value) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed?.protocol === "jackson-pollock-3" ? parsed : null;
  } catch {
    return null;
  }
}
