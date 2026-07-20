import { TOKEN_BRIDGE } from "./token-bridge.js";

class VaultAvatar extends HTMLElement {
  static observedAttributes = ["name", "src", "size", "status"];

  connectedCallback() {
    if (!this.shadowRoot) this.#render();
  }

  attributeChangedCallback() {
    if (this.shadowRoot) this.#render();
  }

  #initials(name) {
    return (name || "")
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("");
  }

  #render() {
    const name = this.getAttribute("name") || "";
    const src = this.getAttribute("src") || "";
    const size = this.getAttribute("size") || "md";
    const status = this.getAttribute("status") || "";

    const dims = { sm: "32px", md: "40px", lg: "56px" };
    const fontSizes = { sm: "var(--text-xs)", md: "var(--text-sm)", lg: "var(--text-base)" };
    const statusDims = { sm: "8px", md: "10px", lg: "14px" };
    const dim = dims[size] || dims.md;

    const statusColors = {
      online: "var(--cipher)",
      offline: "var(--text-muted)",
      away: "var(--warn)",
      busy: "var(--danger)",
    };

    // Status is distinguished by shape as well as color, so it doesn't rely on color perception alone:
    // online = filled circle, busy = filled square, away = dashed ring, offline = solid ring.
    const statusShapes = {
      online: { fill: true, radius: "var(--radius-full)", border: "solid" },
      busy: { fill: true, radius: "var(--radius-sm)", border: "solid" },
      away: { fill: false, radius: "var(--radius-full)", border: "dashed" },
      offline: { fill: false, radius: "var(--radius-full)", border: "solid" },
    };
    const shape = statusShapes[status] || statusShapes.online;

    if (!this.shadowRoot) this.attachShadow({ mode: "open" });

    this.shadowRoot.innerHTML =
      TOKEN_BRIDGE +
      `
      <style>
        :host { display: inline-flex; }
        .avatar {
          position: relative;
          width: ${dim};
          height: ${dim};
          border-radius: var(--radius-full);
          flex-shrink: 0;
        }
        .face {
          width: 100%;
          height: 100%;
          border-radius: var(--radius-full);
          overflow: hidden;
          background: var(--surface-overlay);
          border: 1.5px solid var(--surface-border);
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: var(--font-mono);
          font-size: ${fontSizes[size] || fontSizes.md};
          font-weight: 600;
          color: var(--text-secondary);
          user-select: none;
        }
        img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .status {
          position: absolute;
          bottom: 1px;
          right: 1px;
          width: ${statusDims[size] || statusDims.md};
          height: ${statusDims[size] || statusDims.md};
          border-radius: ${shape.radius};
          border: 2px ${shape.border} var(--surface-base);
          background: ${shape.fill ? statusColors[status] || "transparent" : "transparent"};
          ${!shape.fill ? `box-shadow: inset 0 0 0 1.5px ${statusColors[status] || "var(--text-muted)"};` : ""}
        }
      </style>
      <span class="avatar" role="img" aria-label="${name || "Avatar"}${status ? `, ${status}` : ""}">
        <span class="face">
          ${
            src
              ? `<img src="${src}" alt="${name}" />`
              : `<span aria-hidden="true">${this.#initials(name) || "?"}</span>`
          }
        </span>
        ${status ? `<span class="status" aria-hidden="true"></span>` : ""}
      </span>
    `;
  }
}

customElements.define("vault-avatar", VaultAvatar);

export { VaultAvatar };
