/// <reference path="../../../packages/ui/src/components/vault-ui.d.ts" />

declare module "@smugrobot/ui/components/vault-theme.js" {
  export const VaultTheme: {
    init(): void;
    set(theme: "light" | "dark" | null): void;
    get(): "light" | "dark";
  };
}

declare module "@smugrobot/ui/components/vault.js" {
  export * from "@smugrobot/ui/components/vault-theme.js";
}
