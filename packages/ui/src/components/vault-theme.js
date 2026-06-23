export const VaultTheme = {
  init() {
    const saved = localStorage.getItem('vault-theme');
    if (saved === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else if (saved === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  },

  set(theme) {
    if (theme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('vault-theme', 'light');
    } else if (theme === 'dark') {
      document.documentElement.removeAttribute('data-theme');
      localStorage.setItem('vault-theme', 'dark');
    } else {
      document.documentElement.removeAttribute('data-theme');
      localStorage.removeItem('vault-theme');
      if (window.matchMedia('(prefers-color-scheme: light)').matches) {
        document.documentElement.setAttribute('data-theme', 'light');
      }
    }
  },

  get() {
    return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
  },
};
