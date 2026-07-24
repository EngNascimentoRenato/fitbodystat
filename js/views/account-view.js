import {
  addPasswordToCurrentUser,
  getProviderIds,
  linkGoogleToCurrentUser,
  sendPasswordReset,
  signOutUser
} from "../services/auth-service.js";
import { showToast } from "../components/toast.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { saveProfessionalProfile } from "../data/firestore-store.js";
import { formatPhone, normalizePhone, phoneIsValid } from "../utils/phone-utils.js";

const roleLabels = {
  user: "Usuário",
  professional: "Profissional",
  admin: "Administrador"
};

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

function professionalProfileEditor(state, authState) {
  if (authState.role !== "professional") return "";
  const profile = authState.professionalProfile || {};
  const professionOptions = [
    ["nutritionist", "Nutricionista"],
    ["personal-trainer", "Personal trainer"],
    ["physician", "Médico"],
    ["physical-therapist", "Fisioterapeuta"],
    ["physical-educator", "Profissional de educação física"],
    ["other", "Outra"]
  ];
  return `
    <section class="card">
      <h2>Perfil profissional</h2>
      <form class="form" id="professional-profile-form">
        <div class="form-grid">
          <div class="field">
            <label for="account-professional-name">Nome de exibição</label>
            <input id="account-professional-name" name="name" autocomplete="name" minlength="2" required
              value="${escapeAttribute(profile.name || state.profile?.name || "")}" />
          </div>
          <div class="field">
            <label for="account-profession-type">Área profissional</label>
            <select id="account-profession-type" name="professionType" required>
              ${professionOptions.map(([value, label]) =>
                `<option value="${value}" ${profile.professionType === value ? "selected" : ""}>${label}</option>`
              ).join("")}
            </select>
          </div>
          <div class="field">
            <label for="account-registration-number">Registro profissional</label>
            <input id="account-registration-number" name="registrationNumber" maxlength="40"
              value="${escapeAttribute(profile.registrationNumber || "")}" />
          </div>
          <div class="field">
            <label for="account-professional-phone">Telefone</label>
            <input id="account-professional-phone" name="phone" type="tel" autocomplete="tel"
              value="${escapeAttribute(formatPhone(state.contact?.phone || profile.phone || ""))}" />
          </div>
          <div class="field">
            <label for="account-specialties">Especialidades</label>
            <input id="account-specialties" name="specialties" maxlength="160"
              value="${escapeAttribute((profile.specialties || []).join(", "))}" />
          </div>
        </div>
        <div class="button-row">
          <button class="button primary" type="submit">Salvar perfil profissional</button>
        </div>
      </form>
    </section>
  `;
}

export function renderAccount(state, authState) {
  const user = authState?.user;
  if (!user) return `<section class="card empty-state"><h2>Login necessário</h2></section>`;

  const providers = getProviderIds(user);
  const hasGoogle = providers.has("google.com");
  const hasPassword = providers.has("password");
  const protectIdentity = authState.presentationMode !== "off";
  const name = protectIdentity
    ? "Oculto durante a apresentação"
    : user.displayName || state.profile?.name || "Nome não informado";
  const email = protectIdentity ? "Oculto durante a apresentação" : user.email || "-";

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
            <strong>${escapeHtml(email)}</strong>
            <small>${user.emailVerified ? "E-mail verificado" : "Verificação pendente"}</small>
          </article>
          <article class="mini-stat">
            <span>Nível de acesso</span>
            <strong>${roleLabels[authState.role] || "Usuário"}</strong>
            <small>Definido pela administração</small>
          </article>
        </div>
      </section>

      ${professionalProfileEditor(state, authState)}

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
  document.getElementById("professional-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }
    const professionalProfile = {
      name: String(data.get("name") || "").trim(),
      professionType: data.get("professionType"),
      registrationNumber: String(data.get("registrationNumber") || "").trim(),
      specialties: String(data.get("specialties") || "").split(",").map((item) => item.trim()).filter(Boolean),
      phone: normalizePhone(data.get("phone"))
    };
    const button = event.currentTarget.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await saveProfessionalProfile(
        context.authState.user.uid,
        professionalProfile,
        { uid: context.authState.user.uid, role: context.authState.role }
      );
      context.authState.professionalProfile = professionalProfile;
      context.personalState.profile.name = professionalProfile.name;
      context.personalState.contact = {
        ...context.personalState.contact,
        phone: professionalProfile.phone
      };
      context.persistPersonal({ type: "profile-plan" });
      showToast("Perfil profissional atualizado.");
      context.render();
    } catch (error) {
      showToast(`Não foi possível salvar o perfil profissional: ${error.message}`);
      button.disabled = false;
    }
  });

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
      context.setPresentationMode?.("off", false);
      await signOutUser();
      location.replace("login.html");
    } catch (error) {
      showToast(`Não foi possível sair: ${error.message}`);
    }
  });
}
