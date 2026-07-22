import {
  createAccountWithEmail,
  observeAuth,
  signInWithEmail,
  signInWithGoogle
} from "./services/auth-service.js";

const statusEl = document.getElementById("login-status");
const signInForm = document.getElementById("sign-in-form");
const createForm = document.getElementById("create-account-form");
const googleButton = document.getElementById("sign-in-google");

function setStatus(message) {
  statusEl.textContent = message;
}

function passwordIsStrong(password) {
  return password.length >= 8 && /[A-Za-zÀ-ÿ]/.test(password) && /\d/.test(password);
}

function goToApp() {
  location.replace("index.html");
}

observeAuth((user) => {
  if (user) goToApp();
});

signInForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  try {
    setStatus("Entrando...");
    await signInWithEmail(data.get("email"), data.get("password"));
    goToApp();
  } catch (error) {
    setStatus(`Não foi possível entrar: ${error.message}`);
  }
});

createForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const password = data.get("password");
  const confirmPassword = data.get("confirmPassword");

  if (!passwordIsStrong(password)) {
    setStatus("A senha precisa ter no mínimo 8 caracteres, uma letra e um número.");
    return;
  }

  if (password !== confirmPassword) {
    setStatus("As senhas não conferem.");
    return;
  }

  try {
    setStatus("Criando conta...");
    await createAccountWithEmail(data.get("email"), password);
    goToApp();
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      setStatus("Este e-mail já existe. Use a área Entrar ou entre com Google.");
      return;
    }
    setStatus(`Não foi possível criar a conta: ${error.message}`);
  }
});

googleButton.addEventListener("click", async () => {
  try {
    setStatus("Entrando com Google...");
    await signInWithGoogle();
    goToApp();
  } catch (error) {
    setStatus(`Não foi possível entrar com Google: ${error.message}`);
  }
});
