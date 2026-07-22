import {
  createAccountWithEmail,
  signInWithEmail,
  signInWithGoogle,
  signOutUser
} from "../services/auth-service.js";
import { showToast } from "../components/toast.js";

function userLabel(authState) {
  if (!authState?.user) return "Não conectado";
  return authState.user.displayName || authState.user.email || "Usuário conectado";
}

export function renderAccount(state, authState) {
  const user = authState?.user;
  const role = authState?.role || "user";
  return `
    <div class="view-stack">
      <section class="card">
        <h2>Conta</h2>
        <p class="muted">${user ? "Seus dados são sincronizados com o Firestore desta conta." : "Entre para salvar e recuperar seus dados na nuvem."}</p>
        <div class="grid two">
          <article class="mini-stat">
            <span>Usuário</span>
            <strong>${userLabel(authState)}</strong>
            <small>${user?.email || "Login necessário"}</small>
          </article>
          <article class="mini-stat">
            <span>Tipo</span>
            <strong>${role}</strong>
            <small>${user ? "Definido no cadastro do usuário" : "Disponível após login"}</small>
          </article>
        </div>
      </section>

      ${user ? `
        <section class="card">
          <h2>Sessão</h2>
          <div class="button-row">
            <button class="button danger" id="sign-out" type="button">Sair</button>
          </div>
        </section>
      ` : `
        <section class="card">
          <h2>Entrar com e-mail</h2>
          <form class="form" id="email-auth-form">
            <div class="form-grid">
              <div class="field">
                <label for="auth-email">E-mail</label>
                <input id="auth-email" name="email" type="email" autocomplete="email" required />
              </div>
              <div class="field">
                <label for="auth-password">Senha</label>
                <input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="6" />
              </div>
            </div>
            <div class="button-row">
              <button class="button primary" id="sign-in-email" type="submit">Entrar</button>
              <button class="button" id="create-email-account" type="button">Criar conta</button>
              <button class="button" id="sign-in-google" type="button">Entrar com Google</button>
            </div>
          </form>
        </section>
      `}

      <section class="card">
        <h2>Sincronização</h2>
        <p class="muted">${authState?.syncStatus || "Dados locais salvos neste navegador."}</p>
      </section>
    </div>
  `;
}

export function bindAccount(context) {
  const form = document.getElementById("email-auth-form");
  const createButton = document.getElementById("create-email-account");
  const googleButton = document.getElementById("sign-in-google");
  const signOutButton = document.getElementById("sign-out");

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    try {
      await signInWithEmail(data.get("email"), data.get("password"));
      showToast("Login realizado.");
    } catch (error) {
      showToast(`Não foi possível entrar: ${error.message}`);
    }
  });

  createButton?.addEventListener("click", async () => {
    const data = new FormData(form);
    try {
      await createAccountWithEmail(data.get("email"), data.get("password"));
      showToast("Conta criada.");
    } catch (error) {
      showToast(`Não foi possível criar a conta: ${error.message}`);
    }
  });

  googleButton?.addEventListener("click", async () => {
    try {
      await signInWithGoogle();
      showToast("Login realizado.");
    } catch (error) {
      showToast(`Não foi possível entrar: ${error.message}`);
    }
  });

  signOutButton?.addEventListener("click", async () => {
    try {
      await signOutUser();
      showToast("Você saiu da conta.");
      context.render();
    } catch (error) {
      showToast(`Não foi possível sair: ${error.message}`);
    }
  });
}
