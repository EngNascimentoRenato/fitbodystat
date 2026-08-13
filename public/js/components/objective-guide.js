import { escapeHtml } from "../utils/html-utils.js";

const objectives = [
  {
    title: "Emagrecimento",
    description: "Planeja a redução do peso e pode criar marcos de percentual perdido, IMC, cintura e peso final."
  },
  {
    title: "Ganho de peso",
    description: "Acompanha o aumento do peso corporal total. Não significa necessariamente ganho de músculo."
  },
  {
    title: "Ganho de massa muscular",
    description: "Indica foco em hipertrofia. Nesta versão, o planejamento ainda usa uma meta crescente de peso; as circunferências complementam a avaliação."
  },
  {
    title: "Manutenção",
    description: "Acompanha a permanência dentro de uma faixa ao redor do peso definido, sem ritmo semanal de perda ou ganho."
  },
  {
    title: "Recuperação de peso",
    description: "Destina-se ao retorno a um peso definido após uma perda anterior. O peso de recuperação deve ser escolhido individualmente."
  },
  {
    title: "Outro",
    description: "Permite descrever outro objetivo. O planejamento seguirá a direção indicada pelo peso inicial e pelo peso final."
  }
];

function ensureDialog() {
  let dialog = document.getElementById("objective-guide-dialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog");
  dialog.id = "objective-guide-dialog";
  dialog.className = "guide-dialog objective-guide-dialog";
  dialog.innerHTML = `
    <div class="guide-dialog-header">
      <div>
        <p class="eyebrow">Planejamento</p>
        <h2>Como escolher o objetivo</h2>
      </div>
      <button class="icon-button" data-close-objective-guide type="button" aria-label="Fechar">×</button>
    </div>
    <p class="muted">A escolha define a direção dos cálculos, os prazos e os marcos apresentados.</p>
    <dl class="objective-guide-list">
      ${objectives.map((objective) => `
        <div>
          <dt>${escapeHtml(objective.title)}</dt>
          <dd>${escapeHtml(objective.description)}</dd>
        </div>
      `).join("")}
    </dl>
    <p class="muted">Recomposição corporal ainda não possui um objetivo próprio nesta versão. Sua implementação depende de metas específicas para gordura e circunferências.</p>
    <p class="form-notice">O objetivo pode ser editado posteriormente. Revise também o peso final antes de confirmar o planejamento.</p>
  `;
  document.body.append(dialog);
  dialog.querySelector("[data-close-objective-guide]")
    ?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  return dialog;
}

export function objectiveHelpButton() {
  return `
    <button class="measurement-help-button" data-objective-help type="button"
      aria-label="Entender os objetivos" title="Entender os objetivos">?</button>
  `;
}

export function bindObjectiveHelp() {
  document.querySelectorAll("[data-objective-help]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      ensureDialog().showModal();
    });
  });
}
