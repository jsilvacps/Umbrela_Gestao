import { createClient } from "@supabase/supabase-js";

// Single Supabase for all clients (multi-tenant via empresa_id)
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
);

// Alias kept for activation-code lookup in login/page.tsx
export const masterSupabase = supabase;

export function getEmpresaId(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem("hg_empresa_id") ?? 0);
}

export function salvarEmpresaId(id: number): void {
  localStorage.setItem("hg_empresa_id", String(id));
}

export function limparEmpresaId(): void {
  localStorage.removeItem("hg_empresa_id");
}

export function isConfigurado(): boolean {
  return getEmpresaId() > 0;
}

// Returns supabase directly (kept for backwards compat in login.tsx)
export function getSupabase() {
  return supabase;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

/**
 * Proxy que auto-injeta empresa_id em todas as queries para tabelas de tenant.
 * Uso: db("produtos").select("*").order("nome") — funciona igual ao supabase.from()
 * mas filtrando automaticamente pelo cliente correto.
 */
export function db(table: string) {
  const eid = getEmpresaId();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const base = () => supabase.from(table) as any;
  return {
    select: (columns = "*") =>
      base().select(columns).eq("empresa_id", eid),
    insert: (values: AnyRecord | AnyRecord[]) => {
      const rows = Array.isArray(values)
        ? values.map((v: AnyRecord) => ({ ...v, empresa_id: eid }))
        : { ...(values as AnyRecord), empresa_id: eid };
      return base().insert(rows);
    },
    upsert: (values: AnyRecord | AnyRecord[], opts?: AnyRecord) => {
      const rows = Array.isArray(values)
        ? values.map((v: AnyRecord) => ({ ...v, empresa_id: eid }))
        : { ...(values as AnyRecord), empresa_id: eid };
      return base().upsert(rows, opts);
    },
    update: (values: AnyRecord) =>
      base().update(values).eq("empresa_id", eid),
    delete: () =>
      base().delete().eq("empresa_id", eid),
  };
}

// Kept for code that still calls salvarCredenciais (login.tsx setup)
export function salvarCredenciais(_url: string, _key: string): void {
  // no-op in multi-tenant mode — credentials are in .env
}
