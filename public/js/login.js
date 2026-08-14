import {
  createAccountWithEmail,
  observeAuth,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser
} from "./services/auth-service.js";
import {
  requestPersonalAlphaAccess,
  requestProfessionalAlphaAccess
} from "./services/professional-access-service.js";

const statusEl = document.getElementById("login-status");
const signInForm = document.getElementById("sign-in-form");
const createForm = document.getElementById("create-account-form");
const forgotButton = document.getElementById("forgot-password");
let handlingAuth = false;

const initialStatus = new URLSearchParams(location.search).get("status");
const invitationId = new URLSearchParams(location.search).get("invite");
if (invitationId) {
  localStorage.setItem("fitbodystat-pending-invitation", invitationId);
  document.body.classList.add("invitation-login");
  document.getElementById("invitation-login-notice").hidden = false;
  document.querySelector(".login-access-column h1").textContent = "Já possuo uma conta";
  document.querySelector(".login-access-column .muted").textContent =
    "Entre para consultar o convite com segurança.";
  document.querySelector(".login-registration-column h2").textContent = "Aceitar convite e criar conta";
  document.querySelector(".login-registration-column .muted").textContent =
    "Seu vínculo só será criado depois da confirmação dentro do aplicativo.";
  document.querySelector(".invitation-google-button").hidden = false;
  document.querySelector(".invitation-google-button").style.removeProperty("display");
  document.querySelector(".invitation-google-separator").hidden = false;
  window.setTimeout(() => document.getElementById("create-name")?.focus(), 0);
}

function setStatus(message, type = "info") {
  statusEl.textContent = message;
  statusEl.dataset.type = type;
}

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

function usesGoogle(user) {
  return user.providerData.some((provider) => provider.providerId === "google.com");
}

function goToApp() {
  location.replace("index.html");
}

function friendlyError(error) {
  const rawMessage = String(error?.message || "");
  if (error?.code === "auth/error-code:-47"
    || /error-code:-47|fase alfa|convite|libera[cç][aã]o administrativa/i.test(rawMessage)) {
    return "A fase alfa está disponível somente por convite ou liberação administrativa.";
  }
  const messages = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Entre ou recupere sua senha.",
    "auth/account-exists-with-different-credential": "Este e-mail já usa outro método de entrada. Entre pelo método original e vincule o Google na área Conta.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes da conclusão.",
    "auth/unauthorized-domain": "Este endereço ainda não está autorizado para acesso.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  };
  return messages[error.code] || error.message;
}

const personalRequestDialog = document.getElementById("personal-request-dialog");
const closePersonalRequest = () => personalRequestDialog?.close();
document.getElementById("open-personal-request")?.addEventListener("click", () => personalRequestDialog?.showModal());
document.getElementById("close-personal-request")?.addEventListener("click", closePersonalRequest);
document.getElementById("cancel-personal-request")?.addEventListener("click", closePersonalRequest);
personalRequestDialog?.addEventListener("click", (event) => {
  if (event.target === personalRequestDialog) closePersonalRequest();
});
document.getElementById("personal-request-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  try {
    await requestPersonalAlphaAccess({
      name: data.get("name"),
      email: data.get("email")
    });
    closePersonalRequest();
    form.reset();
    setStatus("Solicitação recebida. Você receberá um e-mail após a análise. Se aprovada, volte a esta página e crie a conta com o mesmo endereço.", "success");
  } catch (error) {
    setStatus(`Não foi possível enviar a solicitação: ${friendlyError(error)}`, "error");
  } finally {
    button.disabled = false;
  }
});

const professionalRequestDialog = document.getElementById("professional-request-dialog");
const closeProfessionalRequest = () => professionalRequestDialog?.close();
document.getElementById("open-professional-request")?.addEventListener("click", () => professionalRequestDialog?.showModal());
document.getElementById("close-professional-request")?.addEventListener("click", closeProfessionalRequest);
document.getElementById("cancel-professional-request")?.addEventListener("click", closeProfessionalRequest);
professionalRequestDialog?.addEventListener("click", (event) => {
  if (event.target === professionalRequestDialog) closeProfessionalRequest();
});
document.getElementById("professional-request-form")?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);
  button.disabled = true;
  try {
    await requestProfessionalAlphaAccess({
      name: data.get("name"),
      email: data.get("email"),
      professionType: data.get("professionType")
    });
    closeProfessionalRequest();
    form.reset();
    setStatus("Solicitação recebida. Você receberá um e-mail após a análise. Se aprovada, volte a esta página e crie a conta profissional com o mesmo endereço.", "success");
  } catch (error) {
    setStatus(`Não foi possível enviar a solicitação: ${friendlyError(error)}`, "error");
  } finally {
    button.disabled = false;
  }
});

observeAuth((user) => {
  if (!handlingAuth && user && (user.emailVerified || usesGoogle(user))) goToApp();
});

if (initialStatus === "suspended") {
  setStatus("Esta conta está suspensa. Entre em contato com a administração.", "error");
} else if (initialStatus === "verify-email") {
  setStatus("Confirme seu e-mail antes de entrar.", "info");
}

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  handlingAuth = true;
  try {
    setStatus("Entrando...");
    const user = await signInWithEmail(data.get("email"), data.get("password"));
    if (!user.emailVerified) {
      try {
        await resendVerificationEmail(user);
        setStatus("Confirme seu e-mail antes de entrar. Enviamos uma nova mensagem de verificação.", "success");
      } finally {
        await signOutUser();
      }
      return;
    }
    goToApp();
  } catch (error) {
    setStatus(`Não foi possível entrar: ${friendlyError(error)}`, "error");
  } finally {
    handlingAuth = false;
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  const password = data.get("password");
  const confirmPassword = data.get("confirmPassword");

  if (name.length < 2) {
    setStatus("Informe seu nome completo.", "error");
    return;
  }
  if (!passwordIsStrong(password)) {
    setStatus("A senha precisa ter no mínimo 8 caracteres, uma letra e um número.", "error");
    return;
  }
  if (password !== confirmPassword) {
    setStatus("As senhas não conferem.", "error");
    return;
  }

  handlingAuth = true;
  try {
    setStatus("Criando conta...");
    await createAccountWithEmail(name, data.get("email"), password);
    await signOutUser();
    form.reset();
    setStatus("Conta criada. Verifique seu e-mail antes de entrar.", "success");
  } catch (error) {
    await signOutUser().catch(() => {});
    setStatus(`Não foi possível criar a conta: ${friendlyError(error)}`, "error");
  } finally {
    handlingAuth = false;
  }
});

document.querySelectorAll(".google-button").forEach((button) => {
  button.addEventListener("click", async () => {
    handlingAuth = true;
    try {
      setStatus("Entrando com Google...");
      await signInWithGoogle();
      goToApp();
    } catch (error) {
      setStatus(`Não foi possível entrar com Google: ${friendlyError(error)}`, "error");
    } finally {
      handlingAuth = false;
    }
  });
});

forgotButton.addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  if (!email) {
    setStatus("Informe seu e-mail para receber o link de recuperação.", "error");
    document.getElementById("login-email").focus();
    return;
  }
  try {
    await sendPasswordReset(email);
    setStatus("Enviamos um link para redefinir sua senha.", "success");
  } catch (error) {
    setStatus(`Não foi possível enviar o link: ${friendlyError(error)}`, "error");
  }
});
