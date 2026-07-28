export function showToast(
  message: string,
  variant: "info" | "success" | "warn" | "danger",
  durationMs = 2000,
): void {
  let container = document.querySelector(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  // Only one toast at a time — a new one replaces whatever's showing, even if it hasn't timed out.
  container.replaceChildren();

  const alert = document.createElement("vault-alert");
  alert.setAttribute("variant", variant);
  alert.setAttribute("dismissible", "");
  alert.textContent = message;
  container.appendChild(alert);

  const remove = () => alert.remove();
  alert.addEventListener("vault-dismiss", remove);
  const timer = setTimeout(remove, durationMs);
  alert.addEventListener("vault-dismiss", () => clearTimeout(timer), { once: true });
}
