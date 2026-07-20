import "@smugrobot/ui/tokens/fonts.css";
import "@smugrobot/ui/tokens/tokens.css";
import "@smugrobot/ui/tokens/base.css";
import "@smugrobot/ui/components/vault.js";
import "./styles/app.css";
import { VaultTheme } from "@smugrobot/ui/components/vault-theme.js";
import { mountBenchScreen } from "./screens/bench-screen.js";

VaultTheme.init();

const root = document.getElementById("app")!;
mountBenchScreen(root);
