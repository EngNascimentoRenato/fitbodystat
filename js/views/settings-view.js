import { exportCsv, downloadText } from "../services/export-service.js";
import { resetState } from "../data/local-store.js";
import { showToast } from "../components/toast.js";
import { confirmAction } from "../components/modal.js";

export function renderSettings() {
  return `
    <div class="view-stack">
      <section class="card">
        <h2>Aparência</h2>
        <p class="muted">O tema fica salvo neste navegador.</p>
        <div class="button-row">
          <button class="button" id="theme-toggle" type="button">Alternar tema</button>
        </div>
      </section>
      <section class="card">
        <h2>Dados e backup</h2>
        <p class="muted">Os dados ficam salvos neste navegador. A integração com Firestore está preparada para uma próxima etapa.</p>
        <div class="button-row">
          <button class="button primary" id="export-csv" type="button">Exportar CSV</button>
          <button class="button" id="export-json" type="button">Exportar JSON</button>
          <button class="button danger" id="reset-data" type="button">Restaurar exemplo</button>
        </div>
      </section>
      <section class="card">
        <h2>Firestore</h2>
        <p class="muted">Quando você quiser conectar ao Firebase, basta preencher a configuração e trocar a camada de armazenamento local pela camada Firestore.</p>
      </section>
    </div>
  `;
}

export function bindSettings(state, persist, render, replaceState) {
  document.getElementById("theme-toggle").addEventListener("click", () => {
    state.settings = state.settings || {};
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    persist();
    showToast("Tema atualizado.");
    render();
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    downloadText("minha-evolucao.csv", exportCsv(state.profile, state.entries), "text/csv;charset=utf-8");
  });

  document.getElementById("export-json").addEventListener("click", () => {
    downloadText("minha-evolucao.json", JSON.stringify(state, null, 2), "application/json");
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    if (!confirmAction("Restaurar os dados de exemplo?")) return;
    replaceState(resetState());
    persist();
    showToast("Dados restaurados.");
    render();
  });
}
