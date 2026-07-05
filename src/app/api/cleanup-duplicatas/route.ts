import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  try {
    const { empresa_id } = await req.json();
    if (!empresa_id) return NextResponse.json({ ok: false, error: "empresa_id obrigatorio" });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL  ?? "",
      process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    );

    // Busca IDs a deletar: para cada grupo duplicado (mesmo empresa_id, total, tipo, minuto),
    // mantém o mais antigo (min created_at) e deleta os demais
    const { data: duplicatas, error: errBusca } = await supabase.rpc("listar_duplicatas_vendas", {
      p_empresa_id: empresa_id,
    });

    if (errBusca) {
      // Fallback: usa query direta se RPC não existir
      return NextResponse.json({ ok: false, error: errBusca.message });
    }

    if (!duplicatas || duplicatas.length === 0) {
      return NextResponse.json({ ok: true, deletados: 0 });
    }

    const ids = (duplicatas as { id: string }[]).map((r) => r.id);

    // Deleta itens das duplicatas
    await supabase.from("itens_venda").delete().in("venda_id", ids);

    // Deleta vendas duplicadas
    const { count } = await supabase
      .from("vendas")
      .delete({ count: "exact" })
      .in("id", ids);

    return NextResponse.json({ ok: true, deletados: count ?? ids.length });
  } catch (err) {
    console.error("[cleanup-duplicatas] erro:", err);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
