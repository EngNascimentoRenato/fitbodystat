export function showToast(message) {
  const region = document.getElementById("toast-region");
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  region.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}
