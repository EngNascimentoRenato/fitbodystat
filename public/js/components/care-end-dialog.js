const reasons = [
  ["not-specified", "Não desejo detalhar"],
  ["accompaniment-completed", "Acompanhamento concluído"],
  ["agreement-ended", "Fim do contrato ou período combinado"],
  ["no-longer-continuing", "Não desejo continuar"],
  ["other", "Outro motivo"]
];

export function requestCareEndDetails(counterpartName = "a outra parte") {
  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    dialog.className = "confirm-dialog tone-danger";
    dialog.innerHTML = `
      <form class="form" method="dialog">
        <div class="confirm-dialog-header"><h2>Encerrar acompanhamento?</h2></div>
        <p class="confirm-dialog-message">
          ${escapeHtml(counterpartName)} perderá o acesso aos dados atuais e futuros deste acompanhamento.
          O histórico do período será preservado e o encerramento ficará disponível para notificação.
        </p>
        <div class="field">
          <label for="care-end-reason">Motivo</label>
          <select id="care-end-reason" name="reasonCode">
            ${reasons.map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}
          </select>
        </div>
        <div class="field" id="care-end-details-field" hidden>
          <label for="care-end-details">Detalhes opcionais</label>
          <textarea id="care-end-details" name="reasonDetails" maxlength="500" rows="3"></textarea>
          <small>Este texto integrará o registro do encerramento.</small>
        </div>
        <div class="confirm-dialog-actions">
          <button class="button" type="submit" value="cancel">Cancelar</button>
          <button class="button danger" type="submit" value="confirm"
            aria-label="Encerrar acompanhamento">Encerrar</button>
        </div>
      </form>`;
    document.body.append(dialog);
    const reason = dialog.querySelector("[name='reasonCode']");
    const detailsField = dialog.querySelector("#care-end-details-field");
    reason.addEventListener("change", () => {
      detailsField.hidden = reason.value !== "other";
      if (!detailsField.hidden) dialog.querySelector("[name='reasonDetails']").focus();
    });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
    dialog.addEventListener("close", () => {
      const result = dialog.returnValue === "confirm"
        ? {
            reasonCode: reason.value,
            reasonDetails: reason.value === "other"
              ? dialog.querySelector("[name='reasonDetails']").value.trim()
              : ""
          }
        : null;
      dialog.remove();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(result);
    }, { once: true });
    dialog.showModal();
    reason.focus();
  });
}
import { escapeHtml } from "../utils/html-utils.js";
