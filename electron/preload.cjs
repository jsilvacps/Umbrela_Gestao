/**
 * electron/preload.cjs
 * Rodado num contexto isolado antes de carregar a página.
 * Por segurança: sem nodeIntegration, apenas contextBridge se necessário.
 */

"use strict";

const { ipcRenderer } = require("electron");

// ── Captura erros JS do renderer e envia para o main process logar ───────────
function logRenderer(tipo, msg) {
  try {
    ipcRenderer.send("renderer-log", `[${tipo}] ${msg}`);
  } catch {}
}

// Erros JS não capturados
window.addEventListener("error", (e) => {
  logRenderer("ERROR", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ""}`);
});

window.addEventListener("unhandledrejection", (e) => {
  logRenderer("UNHANDLED_REJECTION", String(e.reason?.stack || e.reason || e));
});

// React/Next.js loga erros via console.error — captura aqui
const _origError = console.error.bind(console);
console.error = (...args) => {
  try {
    const msg = args.map((a) => (typeof a === "object" ? JSON.stringify(a, null, 2) : String(a))).join(" ");
    if (msg.length > 0) logRenderer("CONSOLE_ERROR", msg.slice(0, 2000));
  } catch {}
  _origError(...args);
};

// console.warn também (Next.js avisa sobre hydration)
const _origWarn = console.warn.bind(console);
console.warn = (...args) => {
  try {
    const msg = args.map((a) => String(a)).join(" ");
    if (msg.includes("hydrat") || msg.includes("Warning:")) logRenderer("CONSOLE_WARN", msg.slice(0, 1000));
  } catch {}
  _origWarn(...args);
};

// Nada exposto por enquanto — o app usa apenas Supabase (HTTPS) e IndexedDB.
// Para futuras integrações com o SO (impressora, USB, etc.), adicione aqui via
// contextBridge.exposeInMainWorld('hortiAPI', { ... });
