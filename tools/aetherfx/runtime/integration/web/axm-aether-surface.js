/**
 * AXM AetherFX reusable surface shell.
 * Dependency-free and safe to use from a local file or normal web project.
 * This is a host surface, not a replacement for the full declarative renderer.
 */
class AXMAetherSurface extends HTMLElement {
  static get observedAttributes() {
    return ['accent', 'accent-2', 'intensity', 'depth', 'motion', 'reduced-motion', 'photosensitive-safe', 'high-contrast', 'large-text'];
  }

  connectedCallback() {
    if (!this.shadowRoot) {
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = `
        <style>
          :host{display:block;--accent:#58e6ff;--accent-2:#a56cff;--intensity:.72;--depth:.64;--motion:.68;color:#f4f7ff}
          .surface{position:relative;overflow:hidden;min-height:180px;padding:24px;border:1px solid color-mix(in srgb,var(--accent) 32%,transparent);border-radius:20px;background:linear-gradient(145deg,rgba(16,24,43,.88),rgba(5,8,17,.94));box-shadow:0 calc(12px + 18px * var(--depth)) calc(36px + 36px * var(--depth)) rgba(0,0,0,.42),inset 0 1px 0 rgba(255,255,255,.08);isolation:isolate}
          .surface::before{content:"";position:absolute;inset:-35%;z-index:-2;background:radial-gradient(circle at 20% 20%,color-mix(in srgb,var(--accent) calc(24% * var(--intensity)),transparent),transparent 28%),radial-gradient(circle at 80% 70%,color-mix(in srgb,var(--accent-2) calc(22% * var(--intensity)),transparent),transparent 32%);filter:blur(18px);animation:breathe calc(8s / max(.2,var(--motion))) ease-in-out infinite alternate}
          .surface::after{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;background:linear-gradient(115deg,transparent 25%,rgba(255,255,255,.08) 45%,transparent 62%);transform:translateX(-80%);animation:sweep calc(10s / max(.2,var(--motion))) ease-in-out infinite}
          :host([reduced-motion]) .surface::before,:host([reduced-motion]) .surface::after{animation:none}
          :host([photosensitive-safe]) .surface::after{animation:none;opacity:.18}
          :host([high-contrast]) .surface{border-width:2px;background:#080d18}
          :host([large-text]) .surface{font-size:1.125em}
          @keyframes breathe{to{transform:scale(1.06) translate3d(1.5%,1%,0)}}
          @keyframes sweep{50%,100%{transform:translateX(100%)}}
        </style>
        <section class="surface" part="surface"><slot></slot></section>`;
    }
    this.sync();
  }

  attributeChangedCallback() { this.sync(); }

  sync() {
    const values = {
      '--accent': this.getAttribute('accent') || '#58e6ff',
      '--accent-2': this.getAttribute('accent-2') || '#a56cff',
      '--intensity': this.getAttribute('intensity') || '.72',
      '--depth': this.getAttribute('depth') || '.64',
      '--motion': this.getAttribute('motion') || '.68'
    };
    Object.entries(values).forEach(([name, value]) => this.style.setProperty(name, value));
  }
}

if (!customElements.get('axm-aether-surface')) customElements.define('axm-aether-surface', AXMAetherSurface);
