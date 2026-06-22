import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL  = process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "";
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Cliente principal — usa sessão auth quando disponível, anon caso contrário
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: true, autoRefreshToken: true },
});

// masterSupabase: alias sem filtro empresa_id (ativação, login global)
export const masterSupabase = supabase;

// ── empresa_id helpers ───────────────────────────────────────────────────────

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

// ── Auth helpers (v1.1.44 — Supabase Auth por empresa) ──────────────────────

/** Email de auth gerado deterministicamente por empresa */
export function empresaAuthEmail(empresaId: number): string {
  return `empresa${empresaId}@umbrela.internal`;
}

/** Faz login no Supabase Auth com as credenciais da empresa */
export async function signInEmpresa(empresaId: number, authPassword: string): Promise<boolean> {
  const { error } = await supabase.auth.signInWithPassword({
    email:    empresaAuthEmail(empresaId),
    password: authPassword,
  });
  return !error;
}

/** Faz logout do Supabase Auth */
export async function signOutEmpresa(): Promise<void> {
  await supabase.auth.signOut();
}

/** Cria conta Supabase Auth para uma nova empresa (chamado na ativação) */
export async function criarAuthEmpresa(empresaId: number, authPassword: string): Promise<boolean> {
  const { error } = await supabase.auth.signUp({
    email:    empresaAuthEmail(empresaId),
    password: authPassword,
    options: {
      data: { empresa_id: empresaId },
    },
  });
  return !error;
}

// Kept for backwards compat
export function getSupabase() { return supabase; }
export function salvarCredenciais(_url: string, _key: string): void { /* no-op */ }

// ── db() proxy: injeta empresa_id em todas as queries ───────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>;

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
