import {
  addPasswordToCurrentUser,
  getProviderIds,
  linkGoogleToCurrentUser,
  sendPasswordReset,
  signOutUser
} from "../services/auth-service.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";

const roleLabels = {
  user: "Usuário",
  professional: "Profissional",
  admin: "Administrador"
};

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

export function renderAccount(state, authState) {
  const user = authState?.user;
  if (!user) return `<section class="card empty-state"><h2>Login necessário</h2></section>`;

  const providers = getProviderIds(user);
  const hasGoogle = providers.has("google.com");
  const hasPassword = providers.has("password");
  const name = user.displayName || state.profile?.name || "Nome não informado";

  return `
    <div class="view-stack">
      <section class="card">
        <h2>Identificação</h2>
        <div class="grid three">
          <article class="mini-stat">
            <span>Nome</span>
            <strong>${escapeHtml(name)}</strong>
            <small>Alterável no Meu perfil</small>
          </article>
          <article class="mini-stat">
            <span>E-mail</span>
            <strong>${escapeHtml(user.email || "-")}</strong>
            <small>${user.emailVerified ? "E-mail verificado" : "Verificação pendente"}</small>
          </article>
          <article class="mini-stat">
            <span>Nível de acesso</span>
            <strong>${roleLabels[authState.role] || "Usuário"}</strong>
            <small>Definido pela administração</small>
          </article>
        </div>
      </section>

      <section class="card">
        <h2>Métodos de entrada</h2>
        <div class="access-method-list">
          <div class="access-method">
            <div>
              <strong>Google</strong>
              <span>${hasGoogle ? "Vinculado" : "Não vinculado"}</span>
            </div>
            ${hasGoogle ? `<span class="badge">Ativo</span>` : `<button class="button" id="link-google" type="button">Vincular Google</button>`}
          </div>
          <div class="access-method">
            <div>
              <strong>E-mail e senha</strong>
              <span>${hasPassword ? "Vinculado" : "Não configurado"}</span>
            </div>
            ${hasPassword
              ? `<button class="button" id="reset-current-password" type="button">Enviar link para alterar senha</button>`
              : `<button class="button" id="show-add-password" type="button">Adicionar acesso por senha</button>`}
          </div>
        </div>

        ${!hasPassword ? `
          <form class="form inline-security-form" id="add-password-form" hidden>
            <input type="hidden" name="email" value="${escapeAttribute(user.email || "")}" />
            <div class="form-grid">
              <div class="field">
                <label for="new-account-password">Nova senha</label>
                <input id="new-account-password" name="password" type="password" autocomplete="new-password" minlength="8" required />
              </div>
              <div class="field">
                <label for="confirm-account-password">Repetir senha</label>
                <input id="confirm-account-password" name="confirmPassword" type="password" autocomplete="new-password" minlength="8" required />
              </div>
            </div>
            <span class="help-text">Mínimo de 8 caracteres, com pelo menos uma letra e um número.</span>
            <div class="button-row"><button class="button primary" type="submit">Vincular senha</button></div>
          </form>
        ` : ""}
      </section>

      <section class="card">
        <h2>Sessão e sincronização</h2>
        <p class="muted">${escapeHtml(authState.syncStatus || "Dados sincronizados.")}</p>
        <div class="button-row"><button class="button danger" id="sign-out" type="button">Sair da conta</button></div>
      </section>
    </div>
  `;
}

export function bindAccount(context) {
  document.getElementById("show-add-password")?.addEventListener("click", () => {
    const form = document.getElementById("add-password-form");
    form.hidden = false;
    document.getElementById("new-account-password")?.focus();
  });

  document.getElementById("add-password-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const password = data.get("password");
    if (!passwordIsStrong(password)) {
      showToast("A senha precisa ter no mínimo 8 caracteres, uma letra e um número.");
      return;
    }
    if (password !== data.get("confirmPassword")) {
      showToast("As senhas não conferem.");
      return;
    }
    try {
      context.authState.user = await addPasswordToCurrentUser(password);
      showToast("Acesso por senha adicionado.");
      context.render();
    } catch (error) {
      showToast(`Não foi possível adicionar a senha: ${error.message}`);
    }
  });

  document.getElementById("link-google")?.addEventListener("click", async () => {
    try {
      context.authState.user = await linkGoogleToCurrentUser();
      showToast("Conta Google vinculada.");
      context.render();
    } catch (error) {
      showToast(`Não foi possível vincular o Google: ${error.message}`);
    }
  });

  document.getElementById("reset-current-password")?.addEventListener("click", async () => {
    try {
      await sendPasswordReset(context.authState.user.email);
      showToast("Enviamos um link para alterar sua senha.");
    } catch (error) {
      showToast(`Não foi possível enviar o link: ${error.message}`);
    }
  });

  document.getElementById("sign-out")?.addEventListener("click", async () => {
    try {
      await signOutUser();
      location.replace("login.html");
    } catch (error) {
      showToast(`Não foi possível sair: ${error.message}`);
    }
  });
}
