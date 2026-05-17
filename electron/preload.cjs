/**
 * electron/preload.cjs
 * Rodado num contexto isolado antes de carregar a página.
 * Por segurança: sem nodeIntegration, apenas contextBridge se necessário.
 */

"use strict";

// Nada exposto por enquanto — o app usa apenas Supabase (HTTPS) e IndexedDB.
// Para futuras integrações com o SO (impressora, USB, etc.), adicione aqui via
// contextBridge.exposeInMainWorld('hortiAPI', { ... });
