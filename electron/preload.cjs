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

window.addEventListener("error", (e) => {
  logRenderer("ERROR", `${e.message} @ ${e.filename}:${e.lineno}:${e.colno}\n${e.error?.stack || ""}`);
});

window.addEventListener("unhandledrejection", (e) => {
  logRenderer("UNHANDLED_REJECTION", String(e.reason?.stack || e.reason || e));
});

// Nada exposto por enquanto — o app usa apenas Supabase (HTTPS) e IndexedDB.
// Para futuras integrações com o SO (impressora, USB, etc.), adicione aqui via
// contextBridge.exposeInMainWorld('hortiAPI', { ... });
