/**
 * syncService.ts
 * Camada de sincronização entre IndexedDB local e Supabase.
 * - syncProdutosLocal  → baixa produtos do Supabase para o IndexedDB
 * - getProdutosLocal   → lê produtos do IndexedDB (sem rede)
 * - savePendingVenda   → salva venda na fila local quando offline
 * - syncPendingVendas  → envia vendas pendentes para o Supabase
 * - countPendingVendas → conta vendas ainda não sincronizadas
 */

import { supabase } from "./supabaseClient";
import { localDB, type PendingVenda } from "./localDB";

// ── Produtos ────────────────────────────────────────────────────────────────

/** Baixa todos os produtos do Supabase para o IndexedDB. Retorna true se ok. */
export async function syncProdutosLocal(): Promise<boolean> {
  if (!localDB) return false;
  try {
    const { data, error } = await supabase
      .from("produtos")
      .select("id, nome, codigo, ean, preco, preco_cartao, unidade, estoque");
    if (error || !data) return false;
    await localDB.produtos.clear();
    await localDB.produtos.bulkPut(data as Parameters<typeof localDB.produtos.bulkPut>[0]);
    return true;
  } catch {
    return false;
  }
}

/** Retorna produtos do IndexedDB (funciona offline). */
export async function getProdutosLocal() {
  if (!localDB) return [];
  return localDB.produtos.orderBy("nome").toArray();
}

/** Atualiza estoque de um produto localmente após uma venda offline. */
export async function debitarEstoqueLocal(produtoId: string, delta: number) {
  if (!localDB) return;
  const prod = await localDB.produtos.get(produtoId);
  if (prod) {
    await localDB.produtos.update(produtoId, {
      estoque: Math.max(0, (prod.estoque ?? 0) - delta),
    });
  }
}

// ── Vendas pendentes ─────────────────────────────────────────────────────────

/** Salva uma venda na fila local para sincronização posterior. */
export async function savePendingVenda(v: Omit<PendingVenda, "synced">) {
  if (!localDB) return;
  await localDB.pendingVendas.put({ ...v, synced: 0 });
}

/** Conta vendas ainda não sincronizadas. */
export async function countPendingVendas(): Promise<number> {
  if (!localDB) return 0;
  return localDB.pendingVendas.where("synced").equals(0).count();
}

/** Retorna detalhes das vendas pendentes para diagnóstico. */
export async function getPendingVendas() {
  if (!localDB) return [];
  return localDB.pendingVendas.where("synced").equals(0).toArray();
}

/** Remove forçadamente uma venda da fila local pelo localId. */
export async function descartarPendingVenda(localId: string) {
  if (!localDB) return;
  await localDB.pendingVendas.delete(localId);
}

/**
 * Envia todas as vendas pendentes para o Supabase.
 * Retorna quantas foram sincronizadas com sucesso.
 */
export async function syncPendingVendas(): Promise<number> {
  if (!localDB) return 0;
  const pending = await localDB.pendingVendas.where("synced").equals(0).toArray();
  let count = 0;

  for (const v of pending) {
    try {
      // 1. Grava venda principal
      const { data: vendaData, error } = await supabase
        .from("vendas")
        .insert([v.vendaPayload])
        .select()
        .single();
      if (error || !vendaData?.id) {
        console.error("[sync] erro ao gravar venda:", error, v.vendaPayload);
        continue;
      }

      // 2. Grava itens da venda
      if (v.itens.length > 0) {
        await supabase.from("itens_venda").insert(
          v.itens.map((i) => ({ ...i, venda_id: vendaData.id }))
        );
      }

      // 3. Debita estoque no Supabase
      for (const upd of v.estoqueDeltas) {
        const { data: prod } = await supabase
          .from("produtos")
          .select("estoque")
          .eq("id", upd.id)
          .maybeSingle();
        const atual = Number((prod as { estoque?: number } | null)?.estoque ?? 0);
        await supabase
          .from("produtos")
          .update({ estoque: Math.max(0, atual - upd.delta) })
          .eq("id", upd.id);
      }

      // 4. Atualiza fiado
      if (v.fiadoUpdate) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("saldo_fiado")
          .eq("id", v.fiadoUpdate.clienteId)
          .maybeSingle();
        const saldo = Number((cli as { saldo_fiado?: number } | null)?.saldo_fiado ?? 0);
        await supabase
          .from("clientes")
          .update({ saldo_fiado: saldo + v.fiadoUpdate.delta })
          .eq("id", v.fiadoUpdate.clienteId);
      }

      // 5. Marca como sincronizado no IndexedDB
      await localDB.pendingVendas.update(v.localId, { synced: 1 });
      count++;
    } catch {
      // Deixa para a próxima tentativa de sync
    }
  }

  // Resync produtos para refletir estoques atuais
  if (count > 0) await syncProdutosLocal();
  return count;
}
