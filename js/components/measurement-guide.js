import { escapeHtml } from "../utils/html-utils.js";

const guides = {
  waist: {
    title: "Como medir a cintura",
    steps: [
      "Use uma fita flexível, paralela ao chão e sem comprimir a pele.",
      "Fique em pé, com o abdômen relaxado, os pés juntos e os braços ao lado do corpo.",
      "Para homens no método da Marinha, meça o abdômen na altura do umbigo.",
      "Para mulheres no método da Marinha, meça a cintura natural, geralmente no ponto mais estreito.",
      "Faça a leitura após uma expiração normal, sem prender ou forçar a respiração."
    ]
  },
  neck: {
    title: "Como medir o pescoço",
    steps: [
      "Olhe para a frente e mantenha os ombros relaxados.",
      "Passe a fita logo abaixo da laringe, com uma leve inclinação descendente para a frente.",
      "A fita deve tocar a pele sem apertar.",
      "Não encolha o pescoço e não eleve o queixo durante a leitura."
    ]
  },
  hip: {
    title: "Como medir o quadril",
    steps: [
      "Fique em pé, com os pés juntos e o peso distribuído igualmente.",
      "Passe a fita ao redor da maior projeção dos glúteos.",
      "Confira de lado se a fita está paralela ao chão.",
      "Mantenha roupas finas e não comprima a pele.",
      "No método da Marinha, essa medida integra o cálculo feminino."
    ]
  }
};

function ensureDialog() {
  let dialog = document.getElementById("measurement-guide-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "measurement-guide-dialog";
  dialog.className = "guide-dialog";
  dialog.innerHTML = `
    <div class="guide-dialog-header">
      <h2 id="measurement-guide-title"></h2>
      <button class="icon-button" data-close-guide type="button" aria-label="Fechar">×</button>
    </div>
    <div id="measurement-guide-content"></div>
    <p class="form-notice">Repita as medições nas mesmas condições e no mesmo ponto anatômico para comparar tendências.</p>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-close-guide]").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

export function bindMeasurementHelp() {
  document.querySelectorAll("[data-measurement-help]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      const guide = guides[button.dataset.measurementHelp];
      if (!guide) return;
      const dialog = ensureDialog();
      dialog.querySelector("#measurement-guide-title").textContent = guide.title;
      dialog.querySelector("#measurement-guide-content").innerHTML = `
        <ol class="guide-steps">
          ${guide.steps.map((step) => `<li>${escapeHtml(step)}</li>`).join("")}
        </ol>
      `;
      dialog.showModal();
    });
  });
}

export function measurementHelpButton(measurement) {
  return `<button class="measurement-help-button" data-measurement-help="${measurement}" type="button" aria-label="Como medir">?</button>`;
}
