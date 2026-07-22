import { signInWithGoogle, signOutUser } from "../services/auth-service.js";
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
        <p class="muted">${user ? "Seus dados são sincronizados com o Firestore desta conta." : "Entre com Google para salvar e recuperar seus dados na nuvem."}</p>
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
        <div class="button-row">
          ${user ? `<button class="button danger" id="sign-out" type="button">Sair</button>` : `<button class="button primary" id="sign-in-google" type="button">Entrar com Google</button>`}
        </div>
      </section>
      <section class="card">
        <h2>Sincronização</h2>
        <p class="muted">${authState?.syncStatus || "Dados locais salvos neste navegador."}</p>
      </section>
    </div>
  `;
}

export function bindAccount(context) {
  const signInButton = document.getElementById("sign-in-google");
  const signOutButton = document.getElementById("sign-out");

  signInButton?.addEventListener("click", async () => {
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
