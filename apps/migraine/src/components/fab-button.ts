/** Material-style floating action button for starting a new log entry. App-local — see CLAUDE.md's "custom component template" for why this isn't a shared vault-ui component. */
export class FabButton {
  el: HTMLElement;
  onClick: (() => void) | null = null;

  constructor() {
    this.el = document.createElement("button");
    this.el.setAttribute("type", "button");
    this.el.className = "fab-button";
    this.el.setAttribute("aria-label", "Log a migraine");
    this.el.innerHTML = `<span aria-hidden="true">+</span>`;
    this.el.addEventListener("click", () => this.onClick?.());
  }
}
