/**
 * syncService.ts
 * Camada de sincronização entre IndexedDB local e Supabase.
 * - syncProdutosLocal  → baixa produtos do Supabase para o IndexedDB
 * - getProdutosLocal   → lê produtos do IndexedDB (sem rede)
 * - savePendingVenda   → salva venda na fila local quando offline
 * - syncPendingVendas  → envia vendas pendentes para o Supabase
 * - countPendingVendas → conta vendas ainda não sincronizadas
 */

import { supabase, db } from "./supabaseClient";
import { localDB, type PendingVenda } from "./localDB";

// Lock global para evitar sincronizações concorrentes (auto-sync + F11 simultâneos)
let syncEmAndamento = false;

// ── Produtos ────────────────────────────────────────────────────────────────

/** Baixa produtos do Supabase filtrados por empresa_id e salva no IndexedDB. */
export async function syncProdutosLocal(): Promise<boolean> {
  if (!localDB) return false;
  try {
    const { data, error } = await db("produtos")
      .select("id, nome, codigo, ean, preco, preco_cartao, preco_fiado, unidade, estoque");
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
  if (syncEmAndamento) return 0; // impede sincronizações concorrentes
  syncEmAndamento = true;
  try {
  const pending = await localDB.pendingVendas.where("synced").equals(0).toArray();
  let count = 0;

  for (const v of pending) {
    try {
      // 1. Grava venda principal (upsert com ignoreDuplicates evita re-inserção se local_id já existe)
      const { data: vendaData, error } = await db("vendas")
        .upsert(v.vendaPayload, { onConflict: "local_id", ignoreDuplicates: true })
        .select()
        .single();

      // Se ignoreDuplicates silenciou um conflito, select() retorna null — busca pelo local_id
      let vendaId = vendaData?.id;
      if (!vendaId && v.vendaPayload.local_id) {
        const { data: existente } = await db("vendas")
          .select("id")
          .eq("local_id", v.vendaPayload.local_id as string)
          .maybeSingle();
        vendaId = (existente as { id?: string } | null)?.id;
      }

      if (error || !vendaId) {
        console.error("[sync] erro ao gravar venda:", error, v.vendaPayload);
        continue;
      }

      // Marca como sincronizado IMEDIATAMENTE para evitar re-inserção duplicada
      await localDB.pendingVendas.update(v.localId, { synced: 1 });
      count++;

      // 2. Grava itens da venda (não-crítico: venda já está no banco)
      if (v.itens.length > 0) {
        await db("itens_venda").insert(
          v.itens.map((i) => ({ ...i, venda_id: vendaId }))
        ).catch((e: unknown) => console.error("[sync] erro ao gravar itens:", e));
      }

      // 3. Debita estoque no Supabase
      for (const upd of v.estoqueDeltas) {
        const { data: prod } = await db("produtos")
          .select("estoque")
          .eq("id", upd.id)
          .maybeSingle();
        const atual = Number((prod as { estoque?: number } | null)?.estoque ?? 0);
        await db("produtos")
          .update({ estoque: Math.max(0, atual - upd.delta) })
          .eq("id", upd.id)
          .catch((e: unknown) => console.error("[sync] erro ao debitar estoque:", e));
      }

      // 4. Atualiza fiado
      if (v.fiadoUpdate) {
        const { data: cli } = await db("clientes")
          .select("saldo_fiado")
          .eq("id", v.fiadoUpdate.clienteId)
          .maybeSingle();
        const saldo = Number((cli as { saldo_fiado?: number } | null)?.saldo_fiado ?? 0);
        await db("clientes")
          .update({ saldo_fiado: saldo + v.fiadoUpdate.delta })
          .eq("id", v.fiadoUpdate.clienteId)
          .catch((e: unknown) => console.error("[sync] erro ao atualizar fiado:", e));
      }
    } catch {
      // Deixa para a próxima tentativa de sync
    }
  }

  // Resync produtos para refletir estoques atuais
  if (count > 0) await syncProdutosLocal();
  return count;
  } finally {
    syncEmAndamento = false;
  }
}
