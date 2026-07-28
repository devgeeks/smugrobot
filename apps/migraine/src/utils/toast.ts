export function showToast(message: string, variant: "info" | "success" | "warn" | "danger"): void {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  const alert = document.createElement("vault-alert");
  alert.setAttribute("variant", variant);
  alert.setAttribute("dismissible", "");
  alert.textContent = message;
  container.appendChild(alert);

  const remove = () => alert.remove();
  alert.addEventListener("vault-dismiss", remove);
  const timer = setTimeout(remove, 4000);
  alert.addEventListener("vault-dismiss", () => clearTimeout(timer), { once: true });
}
