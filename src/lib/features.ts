/**
 * Sistema de feature flags por empresa.
 * Cada empresa pode ter funcionalidades ativadas/desativadas individualmente,
 * independente do plano (pro/trial/free).
 *
 * Armazenado em: empresa.features (JSONB)
 * Carregado em: localStorage (hg_features) para acesso rápido
 */

import { supabase } from "./supabaseClient";

// ── Todas as features disponíveis ────────────────────────────────────────────
export const TODAS_FEATURES = {
  // PDV
  fiado:              { label: "Venda Fiado",            grupo: "PDV" },
  receber_fiado:      { label: "Receber Fiado (F5)",     grupo: "PDV" },
  sangria:            { label: "Sangria (F7)",           grupo: "PDV" },
  fechamento_caixa:   { label: "Fechamento de Caixa",   grupo: "PDV" },
  relatorios_pdv:     { label: "Relatórios PDV (F8)",   grupo: "PDV" },
  cancelar_item:      { label: "Cancelar Item",          grupo: "PDV" },
  cancelar_cupom:     { label: "Cancelar Cupom (F6)",   grupo: "PDV" },
  desconto:           { label: "Desconto na Venda",      grupo: "PDV" },
  buscar_cupons:      { label: "Buscar Cupons (F4)",     grupo: "PDV" },
  identificar_cpf:    { label: "Identificar CPF (F10)", grupo: "PDV" },
  limite_caixa:       { label: "Alerta Limite Caixa",   grupo: "PDV" },
  // ADM
  adm_acesso:         { label: "Acesso ao Painel ADM",  grupo: "ADM" },
  adm_produtos:       { label: "Cadastro de Produtos",  grupo: "ADM" },
  adm_clientes:       { label: "Cadastro de Clientes",  grupo: "ADM" },
  adm_operadores:     { label: "Gestão de Operadores",  grupo: "ADM" },
  adm_relatorios:     { label: "Relatórios ADM",        grupo: "ADM" },
  adm_etiquetas:      { label: "Etiquetas de Produtos", grupo: "ADM" },
  adm_config:         { label: "Configurações",         grupo: "ADM" },
} as const;

export type FeatureKey = keyof typeof TODAS_FEATURES;

const STORAGE_KEY = "hg_features";

// ── Salva features no localStorage ──────────────────────────────────────────
export function salvarFeaturesLocal(features: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(features));
}

// ── Lê features do localStorage ─────────────────────────────────────────────
export function lerFeaturesLocal(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

// ── Carrega features do banco e salva localmente ─────────────────────────────
export async function carregarFeatures(): Promise<Record<string, boolean>> {
  try {
    const { data } = await supabase
      .from("empresa")
      .select("features")
      .limit(1)
      .maybeSingle();
    const features = (data as any)?.features || {};
    salvarFeaturesLocal(features);
    return features;
  } catch {
    return lerFeaturesLocal();
  }
}

// ── Verifica se uma feature está ativa ───────────────────────────────────────
// Se a feature não está explicitamente definida, retorna o padrão (true = ativado)
export function temFeature(key: FeatureKey, features?: Record<string, boolean>): boolean {
  const f = features ?? lerFeaturesLocal();
  if (key in f) return f[key] === true;
  return true; // padrão: tudo ativo (para não quebrar clientes existentes)
}

// ── Salva features de uma empresa específica (uso no master) ─────────────────
export async function salvarFeaturesEmpresa(
  empresaId: number,
  features: Record<string, boolean>
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("empresa")
    .update({ features })
    .eq("empresa_id", empresaId);
  return { error: error?.message ?? null };
}

// ── Lista todas as empresas com suas features (uso no master) ────────────────
export async function listarEmpresasComFeatures() {
  const { data, error } = await supabase
    .from("empresa")
    .select("empresa_id, nome_fantasia, features")
    .order("empresa_id");
  return { data: data || [], error };
}
