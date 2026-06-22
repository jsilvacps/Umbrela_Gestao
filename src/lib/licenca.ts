/**
 * licenca.ts
 * Sistema de licenciamento do Umbrela Gestão PDV
 *
 * Planos:
 *  trial  — 15 dias, funcionalidades Pro completas
 *  free   — após trial expirado, somente venda básica
 *  pro    — tudo desbloqueado, licença ativa
 *
 * Fluxo:
 *  1. Primeira abertura → inicia trial de 15 dias (sem modal)
 *  2. Trial ativo → tudo funciona, badge amarelo no sidebar
 *  3. Trial expirado → plano free + modal de ativação
 *  4. Chave inserida → valida no Supabase, salva cache local
 *  5. A cada 7 dias online → revalida silenciosamente
 *  6. Offline → usa cache (valido por 30 dias)
 */

import { supabase, db } from "./supabaseClient";

export type Plano = "trial" | "free" | "pro";

export interface LicencaStatus {
  plano:          Plano;
  valida:         boolean;
  cliente?:       string;
  chave?:         string;
  diasRestantes?: number;   // só para trial
}

// ── Chaves do localStorage ──────────────────────────────────────────────────
const KEY_CHAVE         = "hg_licenca_chave";
const KEY_STATUS        = "hg_licenca_status";
const KEY_VALIDADA_EM   = "hg_licenca_validada_em";
const KEY_PRIMEIRA_USO  = "hg_primeira_abertura";

const DIAS_TRIAL        = 15;
const DIAS_REVALIDAR    = 7;
const DIAS_CACHE_MAX    = 30;  // offline: aceita cache até 30 dias

// ── Funcionalidades bloqueadas no plano Free ────────────────────────────────
// true = recurso PRO (bloqueado no free)
export const RECURSOS_PRO = {
  fiado:           true,
  fechamento_caixa: true,
  relatorios:      true,
  sangria:         true,
  cancelar_item:   true,
  cancelar_venda:  true,
  buscar_cupons:   true,
  desconto:        true,
  etiquetas:       true,   // ADM
  adm_completo:    true,   // ADM geral
} as const;

export type RecursoPro = keyof typeof RECURSOS_PRO;

/** True se o plano tem acesso ao recurso */
export function temRecurso(plano: Plano, recurso: RecursoPro): boolean {
  if (plano === "pro" || plano === "trial") return true;
  return false; // free: nada do RECURSOS_PRO
}

// ── Primeira abertura / trial ───────────────────────────────────────────────

function getPrimeiraAbertura(): Date {
  if (typeof window === "undefined") return new Date();
  const stored = localStorage.getItem(KEY_PRIMEIRA_USO);
  if (stored) return new Date(stored);
  const agora = new Date().toISOString();
  localStorage.setItem(KEY_PRIMEIRA_USO, agora);
  return new Date(agora);
}

export function getDiasTrialRestantes(): number {
  const primeira = getPrimeiraAbertura();
  const diff = Math.floor((Date.now() - primeira.getTime()) / 86_400_000);
  return Math.max(0, DIAS_TRIAL - diff);
}

// ── Chave salva ─────────────────────────────────────────────────────────────

export function getChaveSalva(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY_CHAVE);
}

export function salvarChave(chave: string) {
  localStorage.setItem(KEY_CHAVE, chave.toUpperCase().trim());
}

export function removerChave() {
  localStorage.removeItem(KEY_CHAVE);
  localStorage.removeItem(KEY_STATUS);
  localStorage.removeItem(KEY_VALIDADA_EM);
}

// ── Cache local ─────────────────────────────────────────────────────────────

export function getLicencaCache(): LicencaStatus {
  if (typeof window === "undefined")
    return { plano: "trial", valida: true, diasRestantes: DIAS_TRIAL };

  const cached = localStorage.getItem(KEY_STATUS);
  if (cached) {
    try {
      const s = JSON.parse(cached) as LicencaStatus;
      // Cache ainda dentro do prazo máximo?
      const validadaEm = localStorage.getItem(KEY_VALIDADA_EM);
      if (validadaEm) {
        const diasCached = (Date.now() - new Date(validadaEm).getTime()) / 86_400_000;
        if (diasCached <= DIAS_CACHE_MAX) return s;
      }
    } catch { /* ignore */ }
  }

  // Sem cache válido: trial ou free
  const dias = getDiasTrialRestantes();
  if (dias > 0) return { plano: "trial", valida: true, diasRestantes: dias };
  return { plano: "free", valida: true, diasRestantes: 0 };
}

export function salvarLicencaCache(status: LicencaStatus) {
  localStorage.setItem(KEY_STATUS, JSON.stringify(status));
  localStorage.setItem(KEY_VALIDADA_EM, new Date().toISOString());
}

export function precisaRevalidar(): boolean {
  if (typeof window === "undefined") return false;
  const data = localStorage.getItem(KEY_VALIDADA_EM);
  if (!data) return true;
  const dias = (Date.now() - new Date(data).getTime()) / 86_400_000;
  return dias >= DIAS_REVALIDAR;
}

// ── Salva/busca chave na tabela empresa (Supabase) ──────────────────────────

async function salvarChaveNoBanco(chave: string) {
  try {
    const { data: emp } = await db("empresa").select("empresa_id").limit(1).maybeSingle();
    if (emp?.empresa_id) {
      await db("empresa").update({ chave_licenca: chave }).eq("empresa_id", emp.empresa_id);
    } else {
      await db("empresa").insert([{ chave_licenca: chave }]);
    }
  } catch { /* silencioso */ }
}

async function buscarChaveDoBanco(): Promise<string | null> {
  try {
    const { data } = await db("empresa").select("chave_licenca").limit(1).maybeSingle();
    return (data as any)?.chave_licenca || null;
  } catch { return null; }
}

// ── Validação online ─────────────────────────────────────────────────────────

export async function validarLicencaOnline(chave: string): Promise<LicencaStatus> {
  const chaveLimpa = chave.toUpperCase().trim();
  try {
    const { data, error } = await supabase
      .from("licencas")
      .select("chave, plano, cliente, validade, ativo, ativado_em")
      .eq("chave", chaveLimpa)
      .maybeSingle();

    if (error || !data) {
      return { plano: "free", valida: false };
    }
    if (!data.ativo) {
      return { plano: "free", valida: false };
    }

    // Primeira ativação: validade começa agora + 5 anos
    if (!data.ativado_em) {
      const agora = new Date();
      const validade5anos = new Date(agora);
      validade5anos.setFullYear(validade5anos.getFullYear() + 5);

      await supabase
        .from("licencas")
        .update({
          ativado_em: agora.toISOString(),
          validade:   validade5anos.toISOString(),
        })
        .eq("chave", chaveLimpa);
    }

    const validade = data.validade ? new Date(data.validade as string) : null;
    if (validade) validade.setHours(23, 59, 59);
    if (validade && validade < new Date()) {
      return { plano: "free", valida: false };
    }

    const status: LicencaStatus = {
      plano:   data.plano as Plano,
      valida:  true,
      cliente: (data.cliente as string) || undefined,
      chave:   chaveLimpa,
    };

    // Salva a chave no banco para outros dispositivos/instalações
    salvarChaveNoBanco(chaveLimpa);

    return status;
  } catch {
    return getLicencaCache();
  }
}

// ── Inicialização completa ──────────────────────────────────────────────────

export async function inicializarLicenca(): Promise<LicencaStatus> {
  let chave = getChaveSalva();

  // Sem chave local → tenta buscar do banco (outro dispositivo já ativou)
  if (!chave) {
    const chaveBanco = await buscarChaveDoBanco();
    if (chaveBanco) {
      salvarChave(chaveBanco);
      chave = chaveBanco;
    }
  }

  // Sem chave em lugar nenhum → trial ou free
  if (!chave) {
    const dias = getDiasTrialRestantes();
    const status: LicencaStatus = dias > 0
      ? { plano: "trial", valida: true, diasRestantes: dias }
      : { plano: "free",  valida: true, diasRestantes: 0 };
    return status;
  }

  // Tem chave mas cache ainda válido
  if (!precisaRevalidar()) {
    return getLicencaCache();
  }

  // Revalida online
  const status = await validarLicencaOnline(chave);
  salvarLicencaCache(status);
  return status;
}

// ── Gerador de chave (utilitário para uso no dashboard) ─────────────────────

/** Gera uma chave no formato UMBRELA-XXXXX-XXXXX-XXXXX */
export function gerarChave(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem I, O, 0, 1
  function bloco(n: number) {
    return Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  }
  return `UMBRELA-${bloco(5)}-${bloco(5)}-${bloco(5)}`;
}
