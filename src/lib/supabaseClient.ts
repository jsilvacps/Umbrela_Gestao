/**
 * supabaseClient.ts  —  cliente Supabase configurável em runtime
 *
 * Prioridade das credenciais:
 *   1. localStorage (hg_sb_url / hg_sb_key)  ← configurado no setup wizard
 *   2. Variáveis de ambiente NEXT_PUBLIC_*    ← desenvolvimento / Vercel
 *
 * Isso permite distribuir UM ÚNICO .exe para todos os clientes.
 * Cada cliente configura o próprio Supabase na primeira abertura.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** Cliente fixo do Supabase master (Jean) — usado para lookup de códigos de ativação */
export const masterSupabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);

let _client: SupabaseClient | null = null;
let _clientUrl = "";

function getCredenciais(): { url: string; key: string } {
  const lsUrl =
    typeof window !== "undefined" ? (localStorage.getItem("hg_sb_url") ?? "") : "";
  const lsKey =
    typeof window !== "undefined" ? (localStorage.getItem("hg_sb_key") ?? "") : "";

  return {
    url: lsUrl || (process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""),
    key: lsKey || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""),
  };
}

/** Retorna o cliente Supabase ou null se ainda não configurado. */
export function getSupabase(): SupabaseClient | null {
  const { url, key } = getCredenciais();
  if (!url || !key) return null;
  if (!_client || _clientUrl !== url) {
    _client = createClient(url, key);
    _clientUrl = url;
  }
  return _client;
}

/** True se as credenciais do Supabase estão disponíveis. */
export function isConfigurado(): boolean {
  const { url, key } = getCredenciais();
  return !!(url && key);
}

/**
 * Salva as credenciais no localStorage e recria o cliente.
 * Chamado pelo setup wizard após o usuário inserir as credenciais.
 */
export function salvarCredenciais(url: string, key: string): void {
  localStorage.setItem("hg_sb_url", url.trim());
  localStorage.setItem("hg_sb_key", key.trim());
  _client = null;
  _clientUrl = "";
}

/**
 * Proxy que expõe o SupabaseClient normalmente.
 * Se não configurado, chamadas de query retornam { data: null, error: ... }
 * em vez de lançar exceção (evita crash antes do setup).
 */
/** Stub retornado quando Supabase não está configurado. */
function _notConfiguredStub() {
  const result = Promise.resolve({ data: null, error: { message: "not_configured", code: "not_configured" } });
  // Builder encadeável: .select().eq().limit()... sempre retorna o mesmo promise/builder
  const builder: Record<string, unknown> = {};
  const chain = () => new Proxy(builder, {
    get(_, p: string) {
      if (p === "then" || p === "catch" || p === "finally") return (result as Promise<unknown>)[p as "then"].bind(result);
      return chain;
    }
  });
  return chain();
}

export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_, prop: string | symbol) {
    const client = getSupabase();
    if (!client) {
      if (prop === "from")          return () => _notConfiguredStub();
      if (prop === "channel")       return () => ({ on: () => ({ subscribe: () => ({}) }) });
      if (prop === "removeChannel") return () => {};
      if (prop === "storage")       return { from: () => _notConfiguredStub() };
      return undefined;
    }
    const val = (client as unknown as Record<string | symbol, unknown>)[prop];
    return typeof val === "function" ? (val as (...a: unknown[]) => unknown).bind(client) : val;
  },
});
