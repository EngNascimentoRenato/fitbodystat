let activeDialog = null;

function normalizeOptions(options) {
  if (typeof options === "string") {
    return {
      title: "Confirmar ação",
      message: options,
      confirmLabel: "Confirmar",
      cancelLabel: "Cancelar",
      tone: "default"
    };
  }
  return {
    title: "Confirmar ação",
    message: "",
    confirmLabel: "Confirmar",
    cancelLabel: "Cancelar",
    tone: "default",
    ...options
  };
}

export function confirmAction(options) {
  const settings = normalizeOptions(options);
  activeDialog?.close("cancel");

  return new Promise((resolve) => {
    const previousFocus = document.activeElement;
    const dialog = document.createElement("dialog");
    const form = document.createElement("form");
    const header = document.createElement("div");
    const title = document.createElement("h2");
    const message = document.createElement("p");
    const actions = document.createElement("div");
    const cancel = document.createElement("button");
    const confirm = document.createElement("button");

    dialog.className = `confirm-dialog tone-${settings.tone}`;
    dialog.setAttribute("aria-labelledby", "confirm-dialog-title");
    dialog.setAttribute("aria-describedby", "confirm-dialog-message");
    form.method = "dialog";
    header.className = "confirm-dialog-header";
    title.id = "confirm-dialog-title";
    title.textContent = settings.title;
    message.id = "confirm-dialog-message";
    message.className = "confirm-dialog-message";
    message.textContent = settings.message;
    actions.className = "confirm-dialog-actions";

    cancel.className = "button";
    cancel.type = "submit";
    cancel.value = "cancel";
    cancel.textContent = settings.cancelLabel;
    confirm.className = `button ${settings.tone === "danger" ? "danger" : "primary"}`;
    confirm.type = "submit";
    confirm.value = "confirm";
    confirm.textContent = settings.confirmLabel;

    header.append(title);
    if (settings.cancelLabel) actions.append(cancel);
    actions.append(confirm);
    form.append(header, message, actions);
    dialog.append(form);
    document.body.append(dialog);
    activeDialog = dialog;

    const finish = () => {
      const accepted = dialog.returnValue === "confirm";
      dialog.remove();
      if (activeDialog === dialog) activeDialog = null;
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
      resolve(accepted);
    };

    dialog.addEventListener("close", finish, { once: true });
    dialog.addEventListener("click", (event) => {
      if (event.target === dialog) dialog.close("cancel");
    });
    dialog.showModal();
    (settings.cancelLabel ? cancel : confirm).focus();
  });
}

export function showAlert(options) {
  const settings = typeof options === "string"
    ? { message: options }
    : options;
  return confirmAction({
    title: "Aviso",
    confirmLabel: "Entendi",
    cancelLabel: "",
    ...settings
  });
}
