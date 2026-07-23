import {
  createAccountWithEmail,
  observeAuth,
  resendVerificationEmail,
  sendPasswordReset,
  signInWithEmail,
  signInWithGoogle,
  signOutUser
} from "./services/auth-service.js";

const statusEl = document.getElementById("login-status");
const signInForm = document.getElementById("sign-in-form");
const createForm = document.getElementById("create-account-form");
const googleButton = document.getElementById("sign-in-google");
const forgotButton = document.getElementById("forgot-password");
let handlingAuth = false;

const initialStatus = new URLSearchParams(location.search).get("status");

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
  const messages = {
    "auth/invalid-credential": "E-mail ou senha inválidos.",
    "auth/email-already-in-use": "Este e-mail já possui uma conta. Entre ou recupere sua senha.",
    "auth/account-exists-with-different-credential": "Este e-mail já usa outro método de entrada. Entre pelo método original e vincule o Google na área Conta.",
    "auth/popup-closed-by-user": "A janela do Google foi fechada antes da conclusão.",
    "auth/unauthorized-domain": "Este domínio ainda não está autorizado no Firebase.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente."
  };
  return messages[error.code] || error.message;
}

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
  const data = new FormData(event.currentTarget);
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
    event.currentTarget.reset();
    setStatus("Conta criada. Verifique seu e-mail antes de entrar.", "success");
  } catch (error) {
    await signOutUser().catch(() => {});
    setStatus(`Não foi possível criar a conta: ${friendlyError(error)}`, "error");
  } finally {
    handlingAuth = false;
  }
});

googleButton.addEventListener("click", async () => {
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
