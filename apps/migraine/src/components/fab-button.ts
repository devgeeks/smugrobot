/** Material-style floating action button for starting a new log entry. App-local — see CLAUDE.md's "custom component template" for why this isn't a shared vault-ui component. */
export class FabButton {
  el: HTMLElement;
  onClick: (() => void) | null = null;

  constructor() {
    this.el = document.createElement("button");
    this.el.setAttribute("type", "button");
    this.el.className = "fab-button";
    // Matches the visible desktop label exactly so the accessible name
    // doesn't diverge from on-screen text (WCAG 2.5.3, Label in Name).
    this.el.setAttribute("aria-label", "Log episode");
    this.el.innerHTML = `<span class="fab-icon" aria-hidden="true">+</span><span class="fab-label">Log episode</span>`;
    this.el.addEventListener("click", () => this.onClick?.());
  }
}
