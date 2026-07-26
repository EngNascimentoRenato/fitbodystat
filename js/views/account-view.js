import {
  addPasswordToCurrentUser,
  getProviderIds,
  linkGoogleToCurrentUser,
  sendPasswordReset,
  signOutUser
} from "../services/auth-service.js";
import { showToast } from "../components/toast.js";
import { confirmAction } from "../components/modal.js";
import { escapeAttribute, escapeHtml } from "../utils/html-utils.js";
import { saveProfessionalProfile } from "../data/firestore-store.js";
import { normalizeProfessionalLocations } from "../models/professional-profile-model.js";
import { personalWorkspaceEnabled } from "../services/workspace-service.js";
import { formatPhone, normalizePhone, phoneIsValid } from "../utils/phone-utils.js";

const roleLabels = {
  user: "Usuário",
  professional: "Profissional",
  admin: "Administrador"
};

let locationEditorOpen = false;
let editingLocationId = null;

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

function professionalLocationItem(location) {
  return `
    <article class="professional-location-item">
      <div>
        <strong>${escapeHtml(location.name)}</strong>
        ${location.address ? `<span>${escapeHtml(location.address)}</span>` : ""}
        ${location.contact ? `<small>${escapeHtml(location.contact)}</small>` : ""}
      </div>
      <div class="button-row">
        <button class="button" type="button" data-edit-professional-location="${escapeAttribute(location.id)}">Editar</button>
        <button class="button danger" type="button" data-delete-professional-location="${escapeAttribute(location.id)}">
          Excluir
        </button>
      </div>
    </article>
  `;
}

function professionalLocationDialog(profile) {
  if (!locationEditorOpen) return "";
  const location = (profile.locations || []).find((item) => item.id === editingLocationId) || {};
  const editing = Boolean(location.id);
  return `
    <dialog class="account-dialog" id="professional-location-dialog">
      <form class="form" id="professional-location-form">
        <input type="hidden" name="id" value="${escapeAttribute(location.id || "")}" />
        <header class="account-dialog-header">
          <div>
            <p class="eyebrow">Perfil profissional</p>
            <h2>${editing ? "Editar local" : "Novo local de atendimento"}</h2>
          </div>
          <button class="icon-button" id="close-professional-location" type="button" aria-label="Fechar">×</button>
        </header>
        <div class="field">
          <label for="professional-location-name">Nome do local</label>
          <input id="professional-location-name" name="name" maxlength="80" minlength="2" required
            placeholder="Ex.: Consultório Centro" value="${escapeAttribute(location.name || "")}" />
        </div>
        <div class="field">
          <label for="professional-location-address">Endereço <span class="muted">(opcional)</span></label>
          <input id="professional-location-address" name="address" maxlength="220"
            value="${escapeAttribute(location.address || "")}" />
        </div>
        <div class="field">
          <label for="professional-location-contact">Contato <span class="muted">(opcional)</span></label>
          <input id="professional-location-contact" name="contact" maxlength="120"
            value="${escapeAttribute(location.contact || "")}" />
        </div>
        <footer class="account-dialog-actions">
          <button class="button" id="cancel-professional-location" type="button">Cancelar</button>
          <button class="button primary" type="submit">${editing ? "Salvar alterações" : "Salvar local"}</button>
        </footer>
      </form>
    </dialog>
  `;
}

function professionalProfileEditor(state, authState) {
  if (authState.role !== "professional" || authState.activeWorkspace === "personal") return "";
  const profile = authState.professionalProfile || {};
  const professionOptions = [
    ["nutritionist", "Nutricionista"],
    ["personal-trainer", "Personal trainer"],
    ["physician", "Médico"],
    ["physical-therapist", "Fisioterapeuta"],
    ["physical-educator", "Profissional de educação física"],
    ["other", "Outra"]
  ];
  const locations = profile.locations || [];
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
      <div class="professional-locations">
        <div class="professional-locations-heading">
          <div>
            <h3>Locais de atendimento</h3>
            <p class="muted">Locais usados com frequência na agenda.</p>
          </div>
          <button class="button" id="add-professional-location" type="button">+ Adicionar local</button>
        </div>
        <div class="professional-location-list">
          ${locations.map(professionalLocationItem).join("")
            || `<p class="professional-location-empty muted">Nenhum local cadastrado.</p>`}
        </div>
      </div>
      ${professionalLocationDialog(profile)}
    </section>
  `;
}

function professionalWorkspaceSettings(authState) {
  if (authState.role !== "professional") return "";
  const enabled = personalWorkspaceEnabled(authState);
  const personal = authState.activeWorkspace === "personal";
  return `
    <section class="card">
      <h2>Ambientes da conta</h2>
      <label class="consent-option workspace-account-option">
        <input id="personal-workspace-enabled" type="checkbox" ${enabled ? "checked" : ""} />
        <span>
          <strong>Usar o FitBodyStat também para meu acompanhamento pessoal</strong>
          <small>Libera um ambiente separado para suas próprias métricas, atividades e metas. Desativar não exclui dados.</small>
        </span>
      </label>
      ${enabled ? `
        <div class="workspace-account-status">
          <span>
            <small>Ambiente atual neste dispositivo</small>
            <strong>${personal ? "Pessoal" : "Profissional"}</strong>
          </span>
          <button class="button" id="account-switch-workspace" type="button">
            Trocar para ${personal ? "profissional" : "pessoal"}
          </button>
        </div>
      ` : ""}
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
            <small>${authState.role === "professional" && authState.activeWorkspace !== "personal"
              ? "Alterável no perfil profissional"
              : "Alterável no Perfil"}</small>
          </article>
          <article class="mini-stat">
            <span>E-mail</span>
            <strong class="account-email">${escapeHtml(email)}</strong>
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
      ${professionalWorkspaceSettings(authState)}

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
  const closeLocationEditor = () => {
    locationEditorOpen = false;
    editingLocationId = null;
    context.render();
  };
  document.getElementById("add-professional-location")?.addEventListener("click", () => {
    if ((context.authState.professionalProfile?.locations || []).length >= 20) {
      showToast("O limite é de 20 locais de atendimento.");
      return;
    }
    editingLocationId = null;
    locationEditorOpen = true;
    context.render();
  });
  document.querySelectorAll("[data-edit-professional-location]").forEach((button) => {
    button.addEventListener("click", () => {
      editingLocationId = button.dataset.editProfessionalLocation;
      locationEditorOpen = true;
      context.render();
    });
  });
  document.querySelectorAll("[data-delete-professional-location]").forEach((button) => {
    button.addEventListener("click", async () => {
      const profile = context.authState.professionalProfile || {};
      const location = (profile.locations || [])
        .find((item) => item.id === button.dataset.deleteProfessionalLocation);
      if (!location || !await confirmAction({
        title: "Excluir local?",
        message: `"${location.name}" será removido. Compromissos já registrados continuarão exibindo este local.`,
        confirmLabel: "Excluir",
        tone: "danger"
      })) return;
      button.disabled = true;
      try {
        const locations = (profile.locations || []).filter((item) => item.id !== location.id);
        await saveProfessionalProfile(
          context.authState.user.uid,
          { ...profile, locations },
          { uid: context.authState.user.uid, role: context.authState.role }
        );
        context.authState.professionalProfile = { ...profile, locations };
        showToast("Local de atendimento excluído.");
        context.render();
      } catch (error) {
        button.disabled = false;
        showToast(`Não foi possível excluir o local: ${error.message}`);
      }
    });
  });

  const locationDialog = document.getElementById("professional-location-dialog");
  if (locationDialog) {
    if (!locationDialog.open) locationDialog.showModal();
    locationDialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      closeLocationEditor();
    });
  }
  document.getElementById("close-professional-location")?.addEventListener("click", closeLocationEditor);
  document.getElementById("cancel-professional-location")?.addEventListener("click", closeLocationEditor);
  document.getElementById("professional-location-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const profile = context.authState.professionalProfile || {};
    const id = data.get("id")
      || globalThis.crypto?.randomUUID?.()
      || `location-${Date.now()}`;
    let locations;
    try {
      const location = {
        id,
        name: data.get("name"),
        address: data.get("address"),
        contact: data.get("contact")
      };
      const current = profile.locations || [];
      locations = normalizeProfessionalLocations(
        current.some((item) => item.id === id)
          ? current.map((item) => item.id === id ? location : item)
          : [...current, location]
      );
    } catch (error) {
      showToast(error.message);
      return;
    }
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      await saveProfessionalProfile(
        context.authState.user.uid,
        { ...profile, locations },
        { uid: context.authState.user.uid, role: context.authState.role }
      );
      context.authState.professionalProfile = { ...profile, locations };
      locationEditorOpen = false;
      editingLocationId = null;
      showToast(data.get("id")
        ? "Local de atendimento atualizado."
        : "Local de atendimento adicionado.");
      context.render();
    } catch (error) {
      button.disabled = false;
      showToast(`Não foi possível salvar o local: ${error.message}`);
    }
  });

  document.getElementById("professional-profile-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    if (!phoneIsValid(data.get("phone"))) {
      showToast("Informe um telefone válido, com DDD.");
      return;
    }
    const professionalProfile = {
      ...(context.authState.professionalProfile || {}),
      name: String(data.get("name") || "").trim(),
      professionType: data.get("professionType"),
      registrationNumber: String(data.get("registrationNumber") || "").trim(),
      specialties: String(data.get("specialties") || "").split(",").map((item) => item.trim()).filter(Boolean),
      phone: normalizePhone(data.get("phone")),
      locations: context.authState.professionalProfile?.locations || []
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

  document.getElementById("personal-workspace-enabled")?.addEventListener("change", async (event) => {
    const input = event.currentTarget;
    const enabled = input.checked;
    if (!enabled && !await confirmAction({
      title: "Desativar ambiente pessoal?",
      message: "Seus dados serão preservados e poderão ser acessados ao ativá-lo novamente.",
      confirmLabel: "Desativar",
      tone: "warning"
    })) {
      input.checked = true;
      return;
    }
    input.disabled = true;
    const profile = context.authState.professionalProfile || {};
    try {
      const nextProfile = { ...profile, personalWorkspaceEnabled: enabled };
      await saveProfessionalProfile(
        context.authState.user.uid,
        nextProfile,
        { uid: context.authState.user.uid, role: context.authState.role }
      );
      context.authState.professionalProfile = nextProfile;
      showToast(enabled
        ? "Ambiente pessoal habilitado."
        : "Ambiente pessoal desabilitado. Seus dados foram preservados.");
      if (!enabled && context.authState.activeWorkspace === "personal") {
        context.setActiveWorkspace("professional");
      } else {
        context.render();
      }
    } catch (error) {
      input.checked = !enabled;
      input.disabled = false;
      showToast(`Não foi possível atualizar os ambientes: ${error.message}`);
    }
  });
  document.getElementById("account-switch-workspace")?.addEventListener("click", () => {
    context.setActiveWorkspace(
      context.authState.activeWorkspace === "personal" ? "professional" : "personal"
    );
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
      context.clearWorkspacePreference?.();
      await signOutUser();
      location.replace("login.html");
    } catch (error) {
      showToast(`Não foi possível sair: ${error.message}`);
    }
  });
}
