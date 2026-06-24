import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ItemVenda = {
  produto_nome: string;
  quantidade: number;
  preco: number;
  codigo?: string;
};

type EmitirPayload = {
  empresa_id: number;
  venda_id: string;
  total: number;
  tipo_pagamento: string;
  cpf_cliente?: string;
  itens: ItemVenda[];
  nfce_config: {
    provider: "focusnfe" | "nfeio";
    token: string;
    ambiente: "homologacao" | "producao";
    cnpj: string;
    razao_social: string;
    ie: string;
    crt: "1" | "2" | "3";
    municipio: string;
    uf: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    telefone: string;
  };
};

function mapearPagamento(tipo: string): { forma: number; descricao: string } {
  const t = (tipo || "").toLowerCase();
  if (t.includes("dinheiro")) return { forma: 1, descricao: "Dinheiro" };
  if (t.includes("cart")) return { forma: 3, descricao: "Cartão de Crédito" };
  if (t.includes("pix")) return { forma: 17, descricao: "PIX" };
  return { forma: 99, descricao: "Outros" };
}

async function emitirFocusNfe(payload: EmitirPayload) {
  const { nfce_config: cfg, itens, total, tipo_pagamento, cpf_cliente } = payload;
  const base = cfg.ambiente === "producao"
    ? "https://api.focusnfe.com.br"
    : "https://homologacao.focusnfe.com.br";
  const credentials = Buffer.from(`${cfg.token}:`).toString("base64");
  const ref = `venda_${payload.venda_id.replace(/-/g, "").slice(0, 20)}`;
  const pgto = mapearPagamento(tipo_pagamento);

  const body = {
    natureza_operacao: "VENDA AO CONSUMIDOR",
    data_emissao: new Date().toISOString(),
    tipo_documento: 1,
    local_destino: 1,
    presenca_comprador: 1,
    consumidor_final: 1,
    modalidade_frete: 9,
    emitente: {
      cnpj: cfg.cnpj.replace(/\D/g, ""),
      nome: cfg.razao_social,
      inscricao_estadual: cfg.ie,
      codigo_regime_tributario: Number(cfg.crt),
      telefone: cfg.telefone.replace(/\D/g, ""),
      logradouro: cfg.logradouro,
      numero: cfg.numero,
      bairro: cfg.bairro,
      municipio: cfg.municipio,
      uf: cfg.uf,
      cep: cfg.cep.replace(/\D/g, ""),
    },
    ...(cpf_cliente ? { consumidor: { cpf: cpf_cliente.replace(/\D/g, "") } } : {}),
    items: itens.map((item, i) => ({
      numero_item: i + 1,
      codigo_produto: item.codigo || String(i + 1).padStart(4, "0"),
      descricao: item.produto_nome,
      codigo_ncm: "22021000",
      cfop: cfg.uf === "SP" ? "5102" : "6102",
      unidade_comercial: "UN",
      quantidade_comercial: item.quantidade,
      valor_unitario_comercial: item.preco,
      valor_bruto: item.preco * item.quantidade,
      unidade_tributavel: "UN",
      quantidade_tributavel: item.quantidade,
      valor_unitario_tributavel: item.preco,
      codigo_regime_tributario: Number(cfg.crt),
      icms_situacao_tributaria: cfg.crt === "3" ? "00" : "400",
      icms_origem: 0,
      pis_situacao_tributaria: "07",
      cofins_situacao_tributaria: "07",
      valor_total_tributos: 0,
      inclui_no_total: 1,
    })),
    formas_pagamento: [{
      forma_pagamento: pgto.forma,
      valor: total,
    }],
    valor_produtos: total,
    valor_desconto: 0,
    valor_total: total,
  };

  const res = await fetch(`${base}/v2/nfce?ref=${ref}`, {
    method: "POST",
    headers: {
      "Authorization": `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();
  return { status: res.status, json, ref };
}

export async function POST(req: NextRequest) {
  try {
    const payload: EmitirPayload = await req.json();
    const { empresa_id, venda_id } = payload;

    if (payload.nfce_config.provider === "focusnfe") {
      const { status, json, ref } = await emitirFocusNfe(payload);

      if (status === 201 || status === 200) {
        // Salva nota emitida
        await supabaseAdmin.from("nfce_notas").insert({
          empresa_id,
          venda_id,
          ref_externa: ref,
          status: json.status || "processando",
          numero: json.numero_nfe,
          chave_acesso: json.chave_nfe,
          total: payload.total,
          danfe_url: json.caminho_danfe_nfce,
        });
        return NextResponse.json({ ok: true, status: json.status, chave: json.chave_nfe, danfe: json.caminho_danfe_nfce });
      }

      return NextResponse.json({ ok: false, erro: json.mensagem || json.erros?.[0]?.mensagem || "Erro ao emitir NFC-e", detalhes: json });
    }

    return NextResponse.json({ ok: false, erro: "Provedor não suportado ainda." });
  } catch (err) {
    return NextResponse.json({ ok: false, erro: String(err) });
  }
}
