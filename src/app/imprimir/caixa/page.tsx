'use client';

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/supabaseClient";

type Movimento = {
  id: string;
  tipo: string | null;
  valor: number | null;
  observacao: string | null;
  created_at: string;
};

export default function ImprimirCaixaPage() {
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);

  useEffect(() => {
    carregar();
  }, []);

  async function carregar() {
    const { data } = await db("caixa_movimentos")
      .select("id,tipo,valor,observacao,created_at")
      .order("created_at", { ascending: false })
      .limit(100);

    setMovimentos((data || []) as Movimento[]);
  }

  const totais = useMemo(() => {
    const abertura = movimentos.filter(m => m.tipo === "abertura").reduce((a, m) => a + Number(m.valor || 0), 0);
    const suprimento = movimentos.filter(m => m.tipo === "suprimento").reduce((a, m) => a + Number(m.valor || 0), 0);
    const sangria = movimentos.filter(m => m.tipo === "sangria").reduce((a, m) => a + Number(m.valor || 0), 0);
    const cancelamento = movimentos.filter(m => m.tipo === "cancelamento").reduce((a, m) => a + Number(m.valor || 0), 0);
    return { abertura, suprimento, sangria, cancelamento };
  }, [movimentos]);

  return (
    <main style={{ padding: 20, maxWidth: 380, margin: "0 auto", fontFamily: "monospace" }}>
      <h1 style={{ fontSize: 20 }}>FECHAMENTO DE CAIXA</h1>
      <p>{new Date().toLocaleString("pt-BR")}</p>

      <div style={{ borderTop: "1px dashed #000", borderBottom: "1px dashed #000", padding: "10px 0", margin: "10px 0" }}>
        <div>Abertura: R$ {totais.abertura.toFixed(2)}</div>
        <div>Suprimento: R$ {totais.suprimento.toFixed(2)}</div>
        <div>Sangria: R$ {totais.sangria.toFixed(2)}</div>
        <div>Cancelamentos: R$ {totais.cancelamento.toFixed(2)}</div>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {movimentos.map((m) => (
          <div key={m.id} style={{ borderBottom: "1px dotted #000", paddingBottom: 6 }}>
            <div>{new Date(m.created_at).toLocaleString("pt-BR")}</div>
            <div>{m.tipo || "-"}</div>
            <div>{m.observacao || "-"}</div>
            <strong>R$ {Number(m.valor || 0).toFixed(2)}</strong>
          </div>
        ))}
      </div>

      <button onClick={() => window.print()} style={{ width: "100%", marginTop: 16, padding: 12 }}>
        Imprimir
      </button>
    </main>
  );
}
