import { exportCsv, downloadText } from "../services/export-service.js";
import { resetState } from "../data/local-store.js";
import { showToast } from "../components/toast.js";
import { confirmAction } from "../components/modal.js";
import { escapeHtml } from "../utils/html-utils.js";

export function renderSettings(state, authState = {}) {
  return `
    <div class="view-stack">
      <section class="card">
        <h2>Conta e nuvem</h2>
        <p class="muted">${authState.user ? `Conectado como ${escapeHtml(authState.user.email)}. ${escapeHtml(authState.syncStatus)}` : "Entre com Google na tela Conta para sincronizar seus dados com Firestore."}</p>
        <div class="button-row">
          <a class="button primary" href="#/conta">Abrir conta</a>
        </div>
      </section>
      <section class="card">
        <h2>Aparência</h2>
        <p class="muted">O tema fica salvo neste navegador.</p>
        <div class="button-row">
          <button class="button" id="theme-toggle" type="button">Alternar tema</button>
        </div>
      </section>
      <section class="card">
        <h2>Apresentação e privacidade</h2>
        <p class="muted">Use temporariamente ao mostrar o Dashboard para outra pessoa. O modo é encerrado ao sair da conta.</p>
        <form class="form" id="presentation-mode-form">
          <div class="radio-row">
            <label class="radio-card">
              <input type="radio" name="presentationMode" value="identity" ${authState.presentationMode === "identity" ? "checked" : ""} />
              <span><strong>Ocultar identificação</strong><small>Esconde nome, e-mail e telefone.</small></span>
            </label>
            <label class="radio-card">
              <input type="radio" name="presentationMode" value="evolution" ${authState.presentationMode === "evolution" ? "checked" : ""} />
              <span><strong>Somente evolução</strong><small>Também remove os cards de medidas atuais e metas detalhadas.</small></span>
            </label>
          </div>
          <div class="button-row">
            <button class="button primary" type="submit">${authState.presentationMode === "off" ? "Ativar modo de apresentação" : "Atualizar modo"}</button>
            ${authState.presentationMode !== "off" ? `<button class="button" id="disable-presentation-mode" type="button">Encerrar apresentação</button>` : ""}
          </div>
        </form>
      </section>
      <section class="card">
        <h2>Dados e backup</h2>
        <p class="muted">Os dados ficam salvos neste navegador e, com login, também no Firestore.</p>
        <div class="button-row">
          <button class="button primary" id="export-csv" type="button">Exportar CSV</button>
          <button class="button" id="export-json" type="button">Exportar JSON</button>
          <button class="button danger" id="reset-data" type="button">Apagar meus dados</button>
        </div>
      </section>
      <section class="card">
        <h2>Perfis de acesso</h2>
        <p class="muted">Papéis previstos: usuário, profissional e admin. Nesta fase, novos cadastros entram como usuário padrão.</p>
      </section>
    </div>
  `;
}

export function bindSettings(state, persist, render, replaceState, authState, setPresentationMode) {
  document.getElementById("theme-toggle").addEventListener("click", () => {
    state.settings = state.settings || {};
    state.settings.theme = state.settings.theme === "dark" ? "light" : "dark";
    persist({ type: "settings" });
    showToast("Tema atualizado.");
    render();
  });

  document.getElementById("presentation-mode-form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    const mode = new FormData(event.currentTarget).get("presentationMode");
    if (!mode) {
      showToast("Escolha como deseja apresentar o Dashboard.");
      return;
    }
    setPresentationMode(mode);
    showToast("Modo de apresentação ativado.");
    location.hash = authState.role === "user" ? "#/dashboard" : "#/me/dashboard";
  });

  document.getElementById("disable-presentation-mode")?.addEventListener("click", () => {
    setPresentationMode("off");
    showToast("Modo de apresentação encerrado.");
  });

  document.getElementById("export-csv").addEventListener("click", () => {
    downloadText("fitbodystat.csv", exportCsv(state.profile, state.entries), "text/csv;charset=utf-8");
  });

  document.getElementById("export-json").addEventListener("click", () => {
    downloadText("fitbodystat.json", JSON.stringify(state, null, 2), "application/json");
  });

  document.getElementById("reset-data").addEventListener("click", () => {
    if (!confirmAction("Apagar perfil, metas e registros desta conta?")) return;
    replaceState(resetState(authState?.user?.uid));
    persist();
    showToast("Dados apagados.");
    render();
  });
}
