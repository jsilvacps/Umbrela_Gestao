'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import HeaderUmbrela from "@/components/HeaderUmbrela";
import BarcodeScannerModal from "@/components/BarcodeScannerModal";
import { supabase, db } from "@/lib/supabaseClient";
import { useIsMobile } from "@/hooks/useIsMobile";
import { temFeature } from "@/lib/features";

type Produto = {
  id: string;
  nome: string;
  codigo: string | null;
  preco: number | null;
  preco_cartao: number | null;
  preco_fiado: number | null;
  estoque: number | null;
  categoria?: string | null;
  custo?: number | null;
  unidade?: string | null;
  ean?: string | null;
};

type CategoriaProduto = {
  id: string;
  nome: string;
};

function moeda(v: number | null | undefined) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

function formatarDinheiroInput(valor: string) {
  const digits = String(valor || "").replace(/\D/g, "");
  const numero = Number(digits || "0") / 100;
  return numero.toFixed(2).replace(".", ",");
}

function parseBRL(value: string) {
  return Number((value || "0").replace(/\./g, "").replace(",", "."));
}


function parseNumeroFlex(value: string | null | undefined) {
  const bruto = String(value || "").trim();
  if (!bruto) return 0;

  const limpo = bruto.replace(/\s/g, "");

  if (limpo.includes(",") && limpo.includes(".")) {
    const ultimoPonto = limpo.lastIndexOf(".");
    const ultimaVirgula = limpo.lastIndexOf(",");

    if (ultimaVirgula > ultimoPonto) {
      return Number(limpo.replace(/\./g, "").replace(",", ".")) || 0;
    }

    return Number(limpo.replace(/,/g, "")) || 0;
  }

  if (limpo.includes(",")) {
    return Number(limpo.replace(/\./g, "").replace(",", ".")) || 0;
  }

  return Number(limpo) || 0;
}

function formatPercentInput(valor: string) {
  const limpo = String(valor || "").replace(/[^\d,]/g, "").replace(",", ".");
  const n = Number(limpo || "0");
  return Number.isFinite(n) ? String(n).replace(".", ",") : "0";
}

function calcularMargem(custo: number, venda: number) {
  if (!custo || custo <= 0) return 0;
  return ((venda - custo) / custo) * 100;
}

function formatPercent(n: number) {
  return Number.isFinite(n) ? n.toFixed(2).replace(".", ",") : "0,00";
}

function limparTexto(v: string | null | undefined) {
  return String(v || "").trim();
}

export default function ProdutosPage() {
  const isMobile = useIsMobile();
  const [temPrecoFiado, setTemPrecoFiado] = useState(false);
  useEffect(() => { setTemPrecoFiado(temFeature("preco_fiado_auto")); }, []);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [categorias, setCategorias] = useState<CategoriaProduto[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [importResult, setImportResult] = useState<{ ok: number; erros: string[]; resumo?: string } | null>(null);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [scannerAberto, setScannerAberto] = useState(false);
  const [buscandoEAN, setBuscandoEAN] = useState(false);
  const [msgEAN, setMsgEAN] = useState<{tipo: "ok"|"aviso"|"erro"; texto: string} | null>(null);
  const [modalEanDuplicado, setModalEanDuplicado] = useState<{id: string; nome: string} | null>(null);

  // NF-e import
  type NFeItem = { codigo: string; nome: string; qtd: number; custo: number; ean: string };
  const [modalNFe, setModalNFe] = useState(false);
  const [nfeItens, setNfeItens] = useState<NFeItem[]>([]);
  const [nfeFornecedor, setNfeFornecedor] = useState("");
  const [importandoNFe, setImportandoNFe] = useState(false);
  const [resultadoNFe, setResultadoNFe] = useState<{ ok: number; erros: string[] } | null>(null);

  const [codigoInterno, setCodigoInterno] = useState("");
  const [codigoEAN, setCodigoEAN] = useState("");
  const [nomeProduto, setNomeProduto] = useState("");
  const [categoria, setCategoria] = useState("");
  const [unidade, setUnidade] = useState("Unidade");
  const [precoCusto, setPrecoCusto] = useState("0,00");
  const [margemDinheiro, setMargemDinheiro] = useState("0,00");
  const [precoDinheiro, setPrecoDinheiro] = useState("0,00");
  const [margemCartao, setMargemCartao] = useState("0,00");
  const [precoCartao, setPrecoCartao] = useState("0,00");
  const [precoFiado, setPrecoFiado] = useState("0,00");
  const [estoqueForm, setEstoqueForm] = useState("0");

  /* ── Importar NF-e (XML) ── */
  function lerXmlNFe(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;
    e.target.value = "";
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const texto = ev.target?.result as string;
        const parser = new DOMParser();
        const doc = parser.parseFromString(texto, "text/xml");
        const ns = "http://www.portalfiscal.inf.br/nfe";

        // Fornecedor
        const emitNome = doc.getElementsByTagNameNS(ns, "xNome")[0]?.textContent ?? "";
        setNfeFornecedor(emitNome);

        // Itens
        const dets = doc.getElementsByTagNameNS(ns, "det");
        const itens: NFeItem[] = [];
        for (let i = 0; i < dets.length; i++) {
          const det = dets[i];
          const nome = det.getElementsByTagNameNS(ns, "xProd")[0]?.textContent ?? "";
          const codigo = det.getElementsByTagNameNS(ns, "cProd")[0]?.textContent ?? "";
          const ean = det.getElementsByTagNameNS(ns, "cEAN")[0]?.textContent ?? "";
          const qtdStr = det.getElementsByTagNameNS(ns, "qCom")[0]?.textContent ?? "0";
          const vUnStr = det.getElementsByTagNameNS(ns, "vUnCom")[0]?.textContent ?? "0";
          const qtd = parseFloat(qtdStr) || 0;
          const custo = parseFloat(vUnStr) || 0;
          if (nome) itens.push({ codigo, nome, qtd, custo, ean: ean === "SEM GTIN" ? "" : ean });
        }

        if (itens.length === 0) {
          setMensagem("❌ Nenhum item encontrado no XML. Verifique se é uma NF-e válida.");
          return;
        }

        setNfeItens(itens);
        setResultadoNFe(null);
        setModalNFe(true);
      } catch {
        setMensagem("❌ Erro ao ler XML. Verifique se o arquivo é uma NF-e válida.");
      }
    };
    reader.readAsText(arquivo, "UTF-8");
  }

  // confirmarImportacaoNFe é definido abaixo (após carregarDados) via useCallback

  /* ── Barcode scanner ── */
  async function aoEscanear(codigo: string) {
    setScannerAberto(false);
    setBuscandoEAN(true);
    setMsgEAN(null);

    // 1. Verifica se produto já existe no cadastro local
    const { data: existente } = await db("produtos").select("id, nome").eq("ean", codigo).maybeSingle();
    if (existente) {
      setModalEanDuplicado(existente as {id: string; nome: string});
      setBuscandoEAN(false);
      return;
    }

    // 2. Preenche EAN no campo
    setCodigoEAN(codigo);

    let nomeEncontrado = "";

    // 3. Tenta Open Food Facts (PT primeiro, depois geral)
    try {
      const res = await fetch(`https://world.openfoodfacts.org/api/v0/product/${codigo}.json`);
      const json = await res.json();
      if (json.status === 1 && json.product) {
        const p = json.product;
        nomeEncontrado = p.product_name_pt || p.product_name_br || p.product_name || p.abbreviated_product_name || "";
      }
    } catch { /* ignora */ }

    // 4. Se não achou, tenta UPC Item DB (boa cobertura de produtos BR)
    if (!nomeEncontrado) {
      try {
        const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${codigo}`);
        const json = await res.json();
        if (json.code === "OK" && json.items?.length > 0) {
          nomeEncontrado = json.items[0].title || "";
        }
      } catch { /* ignora */ }
    }

    if (nomeEncontrado) {
      setNomeProduto(nomeEncontrado);
      setMsgEAN({ tipo: "ok", texto: `✅ Produto encontrado: "${nomeEncontrado}"` });
    } else {
      setMsgEAN({ tipo: "aviso", texto: "⚠️ Código não encontrado nas bases de dados. Preencha o nome manualmente." });
    }

    setBuscandoEAN(false);
  }

  function abrirEdicaoPorEan(id: string) {
    const p = produtos.find(x => x.id === id);
    if (p) {
      setEditandoId(p.id);
      setCodigoInterno(p.codigo || "");
      setCodigoEAN(p.ean || "");
      setNomeProduto(p.nome);
      setCategoria(p.categoria || "");
      setUnidade(p.unidade || "Unidade");
      setPrecoCusto(formatarDinheiroInput(String(Math.round(Number(p.custo || 0) * 100))));
      setPrecoDinheiro(formatarDinheiroInput(String(Math.round(Number(p.preco || 0) * 100))));
      setPrecoCartao(formatarDinheiroInput(String(Math.round(Number(p.preco_cartao || 0) * 100))));
      setPrecoFiado(formatarDinheiroInput(String(Math.round(Number(p.preco_fiado || 0) * 100))));
      setMargemDinheiro("0,00");
      setMargemCartao("0,00");
    }
    setModalEanDuplicado(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const carregarDados = useCallback(async () => {
    const [{ data: produtosData }, { data: categoriasData }] = await Promise.all([
      db("produtos")
        .select("id, nome, codigo, preco, preco_cartao, preco_fiado, estoque, categoria, custo, unidade, ean")
        .order("nome", { ascending: true }),
      db("categorias_produto")
        .select("id, nome")
        .order("nome", { ascending: true }),
    ]);

    const lista = (produtosData || []).map((item: Record<string, unknown>) => ({
      ...item,
      custo: (item.custo as number) ?? 0,
      categoria: (item.categoria as string) ?? "",
      unidade: (item.unidade as string) ?? "Unidade",
      ean: (item.ean as string) ?? null,
    }));

    setProdutos(lista as Produto[]);
    setCategorias((categoriasData || []) as CategoriaProduto[]);
  }, []);

  const confirmarImportacaoNFe = useCallback(async () => {
    setImportandoNFe(true);
    const erros: string[] = [];
    let ok = 0;

    for (const item of nfeItens) {
      try {
        const { data: existente } = await db("produtos")
          .select("id, estoque")
          .eq("codigo", item.codigo)
          .maybeSingle();

        if (existente) {
          const novoEstoque = Number((existente as {estoque: number}).estoque || 0) + item.qtd;
          await db("produtos").update({ estoque: novoEstoque, custo: item.custo }).eq("id", (existente as {id: string}).id);
        } else {
          await db("produtos").insert([{
            nome: item.nome,
            codigo: item.codigo || null,
            ean: item.ean || null,
            custo: item.custo,
            preco: 0,
            preco_cartao: 0,
            estoque: item.qtd,
          }]);
        }
        ok++;
      } catch {
        erros.push(`${item.nome}: erro ao salvar`);
      }
    }

    setResultadoNFe({ ok, erros });
    setImportandoNFe(false);
    if (ok > 0) carregarDados();
  }, [nfeItens, carregarDados]);

  useEffect(() => {
    carregarDados();

    const channel = supabase
      .channel("produtos-layout-final")
      .on("postgres_changes", { event: "*", schema: "public", table: "produtos" }, () => {
        carregarDados();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarDados]);

  function recalcularPrecoPorMargemDinheiro(valor: string) {
    const margem = formatPercentInput(valor);
    setMargemDinheiro(margem);
    const custo = parseBRL(precoCusto);
    const percentual = Number(margem.replace(",", ".")) || 0;
    const venda = custo + (custo * percentual / 100);
    setPrecoDinheiro(formatarDinheiroInput(String(Math.round(venda * 100))));
  }

  function recalcularPrecoPorMargemCartao(valor: string) {
    const margem = formatPercentInput(valor);
    setMargemCartao(margem);
    const custo = parseBRL(precoCusto);
    const percentual = Number(margem.replace(",", ".")) || 0;
    const venda = custo + (custo * percentual / 100);
    setPrecoCartao(formatarDinheiroInput(String(Math.round(venda * 100))));
  }

  function recalcularMargemPorPrecoDinheiro(valor: string) {
    const masked = formatarDinheiroInput(valor);
    setPrecoDinheiro(masked);
    const custo = parseBRL(precoCusto);
    const venda = parseBRL(masked);
    setMargemDinheiro(formatPercent(calcularMargem(custo, venda)));
  }

  function recalcularMargemPorPrecoCartao(valor: string) {
    const masked = formatarDinheiroInput(valor);
    setPrecoCartao(masked);
    const custo = parseBRL(precoCusto);
    const venda = parseBRL(masked);
    setMargemCartao(formatPercent(calcularMargem(custo, venda)));
  }

  function aoAlterarCusto(valor: string) {
    const masked = formatarDinheiroInput(valor);
    setPrecoCusto(masked);

    const custo = parseBRL(masked);
    const percentualDinheiro = Number(String(margemDinheiro || "0").replace(",", ".")) || 0;
    const percentualCartao = Number(String(margemCartao || "0").replace(",", ".")) || 0;

    const vendaDinheiro = custo + (custo * percentualDinheiro / 100);
    const vendaCartao = custo + (custo * percentualCartao / 100);

    setPrecoDinheiro(formatarDinheiroInput(String(Math.round(vendaDinheiro * 100))));
    setPrecoCartao(formatarDinheiroInput(String(Math.round(vendaCartao * 100))));
  }

  function limparFormulario() {
    setEditandoId(null);
    setCodigoInterno("");
    setCodigoEAN("");
    setNomeProduto("");
    setCategoria("");
    setUnidade("Unidade");
    setPrecoCusto("0,00");
    setMargemDinheiro("0,00");
    setPrecoDinheiro("0,00");
    setMargemCartao("0,00");
    setPrecoCartao("0,00");
    setPrecoFiado("0,00");
    setEstoqueForm("0");
  }

  async function salvarProduto(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setSalvando(true);

    const payload: any = {
      nome: nomeProduto.trim(),
      codigo: codigoInterno.trim() || null,
      preco: parseBRL(precoDinheiro),
      preco_cartao: parseBRL(precoCartao),
      preco_fiado: parseBRL(precoFiado) || null,
      estoque: Math.max(0, parseInt(estoqueForm) || 0),
      categoria: categoria.trim() || null,
      custo: parseBRL(precoCusto),
      unidade: unidade,
      ean: codigoEAN.trim() || null,
    };

    let error: any = null;

    if (editandoId) {
      const result = await db("produtos").update(payload).eq("id", editandoId);
      error = result.error;
    } else {
      const result = await db("produtos").insert([payload]);
      error = result.error;
    }

    if (error) {
      setMensagem(`Erro ao salvar produto: ${error.message}`);
    } else {
      setMensagem(editandoId ? "Produto atualizado com sucesso." : "Produto salvo com sucesso.");
      limparFormulario();
      carregarDados();
    }

    setSalvando(false);
  }

  async function excluirProduto(id: string) {
    const { error } = await db("produtos").delete().eq("id", id);
    if (error) {
      setMensagem("Erro ao excluir produto: " + error.message);
      return;
    }
    setMensagem("Produto excluído com sucesso.");
    if (editandoId === id) limparFormulario();
    carregarDados();
  }

  function abrirEdicao(produto: Produto) {
    setEditandoId(produto.id);
    setCodigoInterno(produto.codigo || "");
    setCodigoEAN(produto.ean || "");
    setNomeProduto(produto.nome || "");
    setCategoria(produto.categoria || "");
    setUnidade(produto.unidade || "Unidade");
    setPrecoCusto(formatarDinheiroInput(String(Math.round(Number(produto.custo || 0) * 100))));
    setPrecoDinheiro(formatarDinheiroInput(String(Math.round(Number(produto.preco || 0) * 100))));
    setPrecoCartao(formatarDinheiroInput(String(Math.round(Number(produto.preco_cartao || 0) * 100))));
    setPrecoFiado(formatarDinheiroInput(String(Math.round(Number(produto.preco_fiado || 0) * 100))));
    setMargemDinheiro(formatPercent(calcularMargem(Number(produto.custo || 0), Number(produto.preco || 0))));
    setMargemCartao(formatPercent(calcularMargem(Number(produto.custo || 0), Number(produto.preco_cartao || 0))));
    setEstoqueForm(String(produto.estoque ?? 0));
    setMensagem(`Editando produto: ${produto.nome}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Lê o arquivo respeitando a codificação (UTF-8 ou Windows-1252 do Excel BR) ── */
  function lerArquivoComEncoding(arquivo: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      // Primeiro tenta Windows-1252 — padrão do Excel no Brasil
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));

      // Detecta BOM UTF-8 (EF BB BF) — se existir, usa UTF-8
      const sniffer = new FileReader();
      sniffer.onload = () => {
        const buf = new Uint8Array(sniffer.result as ArrayBuffer).slice(0, 3);
        const isUtf8Bom = buf[0] === 0xEF && buf[1] === 0xBB && buf[2] === 0xBF;
        reader.readAsText(arquivo, isUtf8Bom ? "utf-8" : "windows-1252");
      };
      sniffer.onerror = () => reader.readAsText(arquivo, "utf-8");
      sniffer.readAsArrayBuffer(arquivo.slice(0, 3));
    });
  }

  /* ── Parser de linha CSV que respeita campos entre aspas ── */
  function parseLinha(linha: string, sep: string): string[] {
    const cols: string[] = [];
    let cur = "";
    let inQ = false;

    for (let i = 0; i < linha.length; i++) {
      const ch = linha[i];
      if (ch === '"') {
        if (inQ && linha[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (ch === sep && !inQ) {
        cols.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cols.push(cur.trim());
    return cols;
  }

  async function importarArquivo(e: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = e.target.files?.[0];
    if (!arquivo) return;

    setMensagem("");
    setImportResult(null);
    setImportando(true);

    try {
      const conteudo = await lerArquivoComEncoding(arquivo);

      // Remove BOM se existir
      const texto = conteudo.replace(/^﻿/, "");
      const linhas = texto.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      if (linhas.length < 2) {
        setMensagem("❌ Arquivo sem dados. Verifique se o arquivo não está vazio.");
        return;
      }

      // Detecta separador contando ocorrências na primeira linha (mais confiável)
      const primeiraLinha = linhas[0];
      const contTab    = (primeiraLinha.match(/\t/g)    || []).length;
      const contPV     = (primeiraLinha.match(/;/g)     || []).length;
      const contVirgula= (primeiraLinha.match(/,/g)     || []).length;
      const separador  = contTab >= contPV && contTab >= contVirgula ? "\t"
                       : contPV  >= contVirgula                      ? ";"
                       : ",";
      const cabecalho = parseLinha(linhas[0], separador).map((c) => c.toLowerCase().trim());

      // Mapa de aliases — aceita nomes comuns de colunas
      const alias: Record<string, string[]> = {
        nome:        ["nome", "produto", "descricao", "descrição", "description", "item"],
        codigo:      ["codigo", "código", "cod", "cod_interno", "codigo interno", "cód. interno", "ref"],
        ean:         ["ean", "codigo_barras", "código de barras", "codigo de barras", "barra", "codbarras", "barcode"],
        categoria:   ["categoria", "grupo", "secao", "seção", "tipo"],
        unidade:     ["unidade", "un", "unidade de venda", "und", "unit"],
        custo:       ["custo", "preco_custo", "preço de custo", "valor custo", "preco custo", "cost"],
        preco:       ["preco", "preço", "preco_dinheiro", "preço dinheiro", "valor_venda", "venda", "price"],
        preco_cartao:["preco_cartao", "preço cartão", "preco cartao", "cartao", "cartão", "card"],
        estoque:     ["estoque", "saldo", "quantidade", "qtd", "qty", "stock"],
      };

      const idx: Record<string, number> = {};
      for (const [chave, nomes] of Object.entries(alias)) {
        idx[chave] = -1;
        for (const n of nomes) {
          const i = cabecalho.indexOf(n);
          if (i >= 0) { idx[chave] = i; break; }
        }
      }

      if (idx.nome === -1) {
        setMensagem(
          `❌ Coluna de nome não encontrada.\n` +
          `Colunas detectadas: ${cabecalho.join(" | ")}\n` +
          `A coluna de nome deve chamar: nome, produto, descrição ou item.`
        );
        return;
      }

      const registros: Record<string, unknown>[] = [];
      const errosLinha: string[] = [];

      linhas.slice(1).forEach((linha, i) => {
        const cols = parseLinha(linha, separador);
        const nome = limparTexto(cols[idx.nome]);
        if (!nome) return; // linha vazia

        const preco = idx.preco >= 0 ? parseNumeroFlex(cols[idx.preco]) : 0;

        registros.push({
          nome,
          codigo:      idx.codigo      >= 0 ? limparTexto(cols[idx.codigo])       || null : null,
          ean:         idx.ean         >= 0 ? limparTexto(cols[idx.ean])           || null : null,
          categoria:   idx.categoria   >= 0 ? limparTexto(cols[idx.categoria])     || null : null,
          unidade:     idx.unidade     >= 0 ? limparTexto(cols[idx.unidade])       || "Unidade" : "Unidade",
          custo:       idx.custo       >= 0 ? parseNumeroFlex(cols[idx.custo])              : 0,
          preco,
          preco_cartao:idx.preco_cartao >= 0 ? parseNumeroFlex(cols[idx.preco_cartao])       : preco,
          estoque:     idx.estoque     >= 0 ? parseNumeroFlex(cols[idx.estoque])            : 0,
        });

        if (!nome) errosLinha.push(`Linha ${i + 2}: nome vazio, ignorada.`);
      });

      if (registros.length === 0) {
        setMensagem("❌ Nenhum produto válido encontrado.\nVerifique se o arquivo possui dados abaixo do cabeçalho.");
        return;
      }

      // Normaliza texto para comparação: minúsculo + sem acentos + espaços simples
      function normNome(s: string) {
        return String(s || "")
          .trim()
          .toLowerCase()
          .normalize("NFD").replace(/[̀-ͯ]/g, "") // remove acentos
          .replace(/\s+/g, " ");                            // espaços múltiplos → 1
      }

      // Mapas de busca: por nome normalizado, EAN e código interno
      const mapaNome: Record<string, string> = {};
      const mapaEan:  Record<string, string> = {};
      const mapaCod:  Record<string, string> = {};
      for (const p of produtos) {
        mapaNome[normNome(p.nome)] = p.id;
        if (p.ean)    mapaEan[p.ean.trim()]    = p.id;
        if (p.codigo) mapaCod[p.codigo.trim()] = p.id;
      }

      let totalInseridos  = 0;
      let totalAtualizados = 0;
      const naoEncontrados: string[] = [];

      for (let i = 0; i < registros.length; i++) {
        const reg     = registros[i];
        const nomeReg = String(reg.nome ?? `linha ${i + 2}`).trim();

        // Tenta encontrar o produto: 1º por EAN, 2º por código interno, 3º por nome normalizado
        const eanCSV  = idx.ean    >= 0 ? String(reg.ean    || "").trim() : "";
        const codCSV  = idx.codigo >= 0 ? String(reg.codigo || "").trim() : "";
        const idExistente =
          (eanCSV  && mapaEan[eanCSV])    ||
          (codCSV  && mapaCod[codCSV])    ||
          mapaNome[normNome(nomeReg)]     ||
          null;

        if (idExistente) {
          // Produto já existe — atualiza APENAS os campos que vieram preenchidos no CSV
          const update: Record<string, unknown> = {};
          if (idx.codigo       >= 0 && reg.codigo      !== null)     update.codigo       = reg.codigo;
          if (idx.ean          >= 0 && reg.ean          !== null)     update.ean          = reg.ean;
          if (idx.categoria    >= 0 && reg.categoria    !== null)     update.categoria    = reg.categoria;
          if (idx.unidade      >= 0 && reg.unidade      !== null)     update.unidade      = reg.unidade;
          if (idx.custo        >= 0 && Number(reg.custo)        > 0)  update.custo        = reg.custo;
          if (idx.preco        >= 0 && Number(reg.preco)        > 0)  update.preco        = reg.preco;
          if (idx.preco_cartao >= 0 && Number(reg.preco_cartao) > 0)  update.preco_cartao = reg.preco_cartao;
          if (idx.estoque      >= 0 && Number(reg.estoque)      > 0)  update.estoque      = reg.estoque;

          if (Object.keys(update).length === 0) continue; // nada a atualizar

          const { error } = await (db("produtos").update(update) as any).eq("id", idExistente);
          if (error) {
            errosLinha.push(`"${nomeReg}": ${error.message}`);
          } else {
            totalAtualizados++;
          }
        } else {
          // Produto não encontrado — registra mas NÃO insere (para não criar duplicatas)
          naoEncontrados.push(nomeReg);
        }
      }

      const totalOk = totalInseridos + totalAtualizados;
      const resumo = [
        totalAtualizados > 0 ? `${totalAtualizados} atualizado(s)` : "",
        totalInseridos   > 0 ? `${totalInseridos} inserido(s)` : "",
      ].filter(Boolean).join(", ");

      // Adiciona lista dos não encontrados como avisos
      if (naoEncontrados.length > 0) {
        errosLinha.push(
          `⚠️ ${naoEncontrados.length} produto(s) não encontrado(s) no cadastro (nome diferente?): ` +
          naoEncontrados.slice(0, 10).map(n => `"${n}"`).join(", ") +
          (naoEncontrados.length > 10 ? ` e mais ${naoEncontrados.length - 10}...` : "")
        );
      }

      setImportResult({ ok: totalOk, erros: errosLinha, resumo });
      if (totalOk > 0) carregarDados();

    } catch (err) {
      setMensagem(`❌ Erro inesperado: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setImportando(false);
      e.target.value = "";
    }
  }

  function baixarModelo() {
    // Separador ponto-e-vírgula: padrão Excel BR — decimais com vírgula
    const linhas = [
      "nome;codigo;ean;categoria;unidade;custo;preco;preco_cartao;estoque",
      "Tomate Italiano;001;7891234560001;Hortaliça;Kg;3,50;6,99;7,50;50",
      "Alface Crespa;002;;Folhosa;Unidade;0,80;2,50;2,80;30",
    ];
    // BOM UTF-8 garante que o Excel exibe acentos corretamente
    const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = "modelo_produtos.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const [buscaLista, setBuscaLista] = useState("");
  const [editandoInline, setEditandoInline] = useState<{
    id: string; nome: string; custo: string; preco: string; preco_cartao: string; preco_fiado: string; estoque: string;
  } | null>(null);
  const [salvandoInline, setSalvandoInline] = useState(false);

  const produtosFiltrados = useMemo(() => {
    const termo = buscaLista.trim().toLowerCase();
    if (!termo) return produtos;
    return produtos.filter((p) =>
      p.nome.toLowerCase().includes(termo) ||
      (p.codigo || "").toLowerCase().includes(termo) ||
      (p.ean || "").toLowerCase().includes(termo) ||
      (p.categoria || "").toLowerCase().includes(termo)
    );
  }, [produtos, buscaLista]);

  function abrirInline(produto: Produto) {
    setEditandoInline({
      id: produto.id,
      nome: produto.nome,
      custo: formatarDinheiroInput(String(Math.round(Number(produto.custo || 0) * 100))),
      preco: formatarDinheiroInput(String(Math.round(Number(produto.preco || 0) * 100))),
      preco_cartao: formatarDinheiroInput(String(Math.round(Number(produto.preco_cartao || 0) * 100))),
      preco_fiado: formatarDinheiroInput(String(Math.round(Number(produto.preco_fiado || 0) * 100))),
      estoque: String(produto.estoque ?? 0),
    });
  }

  async function salvarInline() {
    if (!editandoInline) return;
    setSalvandoInline(true);
    const { error } = await (db("produtos").update({
      nome: editandoInline.nome.trim(),
      custo: parseBRL(editandoInline.custo),
      preco: parseBRL(editandoInline.preco),
      preco_cartao: parseBRL(editandoInline.preco_cartao),
      preco_fiado: parseBRL(editandoInline.preco_fiado) || null,
      estoque: Math.max(0, parseInt(editandoInline.estoque) || 0),
    }) as any).eq("id", editandoInline.id);
    setSalvandoInline(false);
    if (!error) { setEditandoInline(null); carregarDados(); }
    else setMensagem("Erro ao salvar: " + error.message);
  }

  const totalProdutos = useMemo(() => produtos.length, [produtos]);

  if (isMobile === null) return null;

  return (
    <main style={{ minHeight: "100vh", background: "#f3f5f7", padding: 12 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>
        <HeaderUmbrela />

        {mensagem ? (
          <div style={msgBox}>{mensagem}</div>
        ) : null}

        <div style={{ ...contentGrid, gridTemplateColumns: isMobile ? "1fr" : "490px 1fr" }}>
          <section style={cardLeft}>
            <div style={title}>{editandoId ? "Editar produto" : "Novo produto"}</div>

            <div style={miniBox}>
              <div style={boxTitle}>Importação de cadastro</div>
              <div style={boxDesc}>
                Detecta automaticamente separador <strong>,</strong> <strong>;</strong> ou Tab.
                Baixe o modelo, preencha no Excel e importe.
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label style={importando ? { ...importBtn, opacity: 0.6, cursor: "not-allowed" } : importBtn}>
                  {importando ? "⏳ Importando..." : "📂 Selecionar CSV"}
                  <input
                    type="file"
                    accept=".csv,.txt,.tsv,.tab"
                    onChange={importarArquivo}
                    disabled={importando}
                    style={{ display: "none" }}
                  />
                </label>
                <button type="button" onClick={baixarModelo} style={modeloBtn}>
                  ⬇️ Baixar modelo
                </button>
                {temFeature("importar_nfe") && (
                  <label style={{ ...importBtn, background: "#1a5276", cursor: "pointer" }}>
                    📄 Importar NF-e (XML)
                    <input
                      type="file"
                      accept=".xml"
                      onChange={lerXmlNFe}
                      style={{ display: "none" }}
                    />
                  </label>
                )}
              </div>
              {importResult && (
                <div style={{ marginTop: 12 }}>
                  <div style={{ color: "#1a7b39", fontWeight: 700, fontSize: 14 }}>
                    ✅ {importResult.ok} produto(s) processado(s){importResult.resumo ? ` — ${importResult.resumo}` : ""}.
                  </div>
                  {importResult.erros.length > 0 && (
                    <div style={{ color: "#c65d07", marginTop: 6, fontSize: 13, lineHeight: 1.6 }}>
                      {importResult.erros.map((err, i) => (
                        <div key={i}>⚠️ {err}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <form onSubmit={salvarProduto}>
              <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
                <Field label="Código interno">
                  <input style={input} value={codigoInterno} onChange={(e) => setCodigoInterno(e.target.value)} placeholder="Código interno" />
                </Field>

                <Field label="Código EAN">
                  <div style={{ display: "flex", gap: 6 }}>
                    <input style={{ ...input, flex: 1 }} value={codigoEAN} onChange={(e) => { setCodigoEAN(e.target.value); setMsgEAN(null); }} placeholder="Somente números" />
                    <button
                      type="button"
                      onClick={() => { setScannerAberto(true); setMsgEAN(null); }}
                      title="Ler código pela câmera"
                      style={{ height: 46, width: 46, border: "1px solid #d5dde7", borderRadius: 14, background: "#f0fdf4", color: "#16a34a", fontSize: 20, cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {buscandoEAN ? "⏳" : "📷"}
                    </button>
                  </div>
                  {msgEAN && (
                    <div style={{
                      marginTop: 6, padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                      background: msgEAN.tipo === "ok" ? "#f0fdf4" : "#fffbeb",
                      color: msgEAN.tipo === "ok" ? "#166534" : "#92400e",
                      border: `1px solid ${msgEAN.tipo === "ok" ? "#86efac" : "#fcd34d"}`,
                    }}>
                      {msgEAN.texto}
                    </div>
                  )}
                </Field>

                <Field label="Nome do produto">
                  <input style={input} value={nomeProduto} onChange={(e) => setNomeProduto(e.target.value)} placeholder="Nome do produto" required />
                </Field>

                <Field label="Categoria">
                  <select style={input} value={categoria} onChange={(e) => setCategoria(e.target.value)}>
                    <option value="">Selecione</option>
                    {categorias.map((cat) => (
                      <option key={cat.id} value={cat.nome}>{cat.nome}</option>
                    ))}
                  </select>
                </Field>

                <Field label="Unidade de venda">
                  <select style={input} value={unidade} onChange={(e) => setUnidade(e.target.value)}>
                    <option value="Unidade">Unidade</option>
                    <option value="Kg">Kg</option>
                    <option value="g">g</option>
                    <option value="Caixa">Caixa</option>
                    <option value="Bandeja">Bandeja</option>
                  </select>
                </Field>

                <Field label="Preço de custo">
                  <input style={input} value={precoCusto} onChange={(e) => aoAlterarCusto(e.target.value)} placeholder="0,00" inputMode="numeric" />
                </Field>

                <Field label="Margem de lucro - pagamento em dinheiro (%)">
                  <input style={input} value={margemDinheiro} onChange={(e) => recalcularPrecoPorMargemDinheiro(e.target.value)} placeholder="0,00" inputMode="decimal" />
                </Field>

                <Field label="Preço final - pagamento em dinheiro">
                  <input style={input} value={precoDinheiro} onChange={(e) => recalcularMargemPorPrecoDinheiro(e.target.value)} placeholder="0,00" inputMode="numeric" />
                </Field>

                <Field label="Margem de lucro - pagamento em cartão (%)">
                  <input style={input} value={margemCartao} onChange={(e) => recalcularPrecoPorMargemCartao(e.target.value)} placeholder="0,00" inputMode="decimal" />
                </Field>

                <Field label="Preço final - pagamento em cartão">
                  <input style={input} value={precoCartao} onChange={(e) => recalcularMargemPorPrecoCartao(e.target.value)} placeholder="0,00" inputMode="numeric" />
                </Field>

                {temPrecoFiado && (
                  <Field label="Preço fiado (não aparece na etiqueta)">
                    <input style={input} value={precoFiado} onChange={(e) => setPrecoFiado(formatarDinheiroInput(e.target.value))} placeholder="0,00" inputMode="numeric" />
                  </Field>
                )}

                <Field label="Estoque atual (unidades)">
                  <input style={input} type="number" min={0} value={estoqueForm} onChange={(e) => setEstoqueForm(e.target.value)} inputMode="numeric" />
                </Field>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="submit" disabled={salvando} style={saveButton}>
                  {salvando ? "Salvando..." : editandoId ? "Salvar edição" : "Salvar produto"}
                </button>

                {editandoId ? (
                  <button type="button" onClick={limparFormulario} style={cancelButton}>
                    Cancelar edição
                  </button>
                ) : null}
              </div>
            </form>
          </section>

          <section style={cardRight}>
            <div style={headerList}>
              <div>
                <div style={title}>Produtos cadastrados</div>
                <div style={subtitle}>Gerencie preços, margens e dados dos produtos.</div>
              </div>

              <div style={greenCounter}>{totalProdutos} produtos</div>
            </div>

            {/* Campo de busca */}
            <div style={{ marginBottom: 14 }}>
              <input
                style={{ ...input, width: "100%", background: "#f8fafc" }}
                value={buscaLista}
                onChange={(e) => setBuscaLista(e.target.value)}
                placeholder="🔍 Buscar por nome, código, EAN ou categoria..."
              />
            </div>

            {buscaLista && (
              <div style={{ marginBottom: 10, fontSize: 13, color: "#66758a" }}>
                {produtosFiltrados.length} produto(s) encontrado(s)
                {" · "}
                <button onClick={() => setBuscaLista("")} style={{ background: "none", border: "none", color: "#2563eb", cursor: "pointer", fontWeight: 700, padding: 0, fontSize: 13 }}>
                  Limpar busca
                </button>
              </div>
            )}

            {isMobile ? <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {produtosFiltrados.length === 0 ? (
                  <div style={{ padding: 16, color: "#66758a" }}>
                    {buscaLista ? `Nenhum produto encontrado para "${buscaLista}".` : "Nenhum produto cadastrado."}
                  </div>
                ) : (
                  produtosFiltrados.map((produto) => {
                    const inline = editandoInline?.id === produto.id;
                    const estoqueNum = Number(produto.estoque ?? 0);
                    const estoqueColor = estoqueNum <= 0 ? "#dc2626" : estoqueNum <= 5 ? "#d97706" : "#15803d";
                    return (
                      <div key={produto.id} style={{
                        border: inline ? "2px solid #86efac" : "1px solid #e5eaf0",
                        borderRadius: 16,
                        padding: 14,
                        background: inline ? "#f0fdf4" : "#fff",
                      }}>
                        {/* Nome */}
                        {inline ? (
                          <input
                            style={{ ...inputInline, fontWeight: 800, fontSize: 15, marginBottom: 10, width: "100%" }}
                            value={editandoInline!.nome}
                            onChange={(e) => setEditandoInline({ ...editandoInline!, nome: e.target.value })}
                            autoFocus
                          />
                        ) : (
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontWeight: 900, fontSize: 16, color: "#10243d" }}>{produto.nome}</div>
                            <div style={{ color: "#66758a", fontSize: 13 }}>{produto.categoria || "-"}</div>
                          </div>
                        )}

                        {/* Infos em grid 2 colunas */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 12px", fontSize: 13, marginBottom: 10 }}>
                          <div>
                            <span style={cardLabel}>Cód. interno</span>
                            <div style={cardVal}>{produto.codigo || "-"}</div>
                          </div>
                          <div>
                            <span style={cardLabel}>EAN</span>
                            <div style={cardVal}>{produto.ean || "-"}</div>
                          </div>
                          <div>
                            <span style={cardLabel}>Custo</span>
                            {inline ? (
                              <input style={inputInline} value={editandoInline!.custo} inputMode="numeric"
                                onChange={(e) => setEditandoInline({ ...editandoInline!, custo: formatarDinheiroInput(e.target.value) })} />
                            ) : <div style={cardVal}>{moeda(produto.custo)}</div>}
                          </div>
                          <div>
                            <span style={cardLabel}>Estoque</span>
                            {inline ? (
                              <input style={inputInline} value={editandoInline!.estoque} type="number" min={0} inputMode="numeric"
                                onChange={(e) => setEditandoInline({ ...editandoInline!, estoque: e.target.value })} />
                            ) : (
                              <div style={{ ...cardVal, color: estoqueColor, fontWeight: 700 }}>
                                {estoqueNum}{produto.unidade ? ` ${produto.unidade}` : ""}
                              </div>
                            )}
                          </div>
                          <div>
                            <span style={cardLabel}>Dinheiro</span>
                            {inline ? (
                              <input style={inputInline} value={editandoInline!.preco} inputMode="numeric"
                                onChange={(e) => setEditandoInline({ ...editandoInline!, preco: formatarDinheiroInput(e.target.value) })} />
                            ) : <div style={cardVal}>{moeda(produto.preco)}</div>}
                          </div>
                          <div>
                            <span style={cardLabel}>Cartão</span>
                            {inline ? (
                              <input style={inputInline} value={editandoInline!.preco_cartao} inputMode="numeric"
                                onChange={(e) => setEditandoInline({ ...editandoInline!, preco_cartao: formatarDinheiroInput(e.target.value) })} />
                            ) : <div style={cardVal}>{moeda(produto.preco_cartao)}</div>}
                          </div>
                          {temPrecoFiado && (
                            <div>
                              <span style={cardLabel}>Fiado</span>
                              {inline ? (
                                <input style={inputInline} value={editandoInline!.preco_fiado} inputMode="numeric"
                                  onChange={(e) => setEditandoInline({ ...editandoInline!, preco_fiado: formatarDinheiroInput(e.target.value) })} />
                              ) : <div style={cardVal}>{moeda(produto.preco_fiado)}</div>}
                            </div>
                          )}
                        </div>

                        {/* Botões */}
                        <div style={{ display: "flex", gap: 8 }}>
                          {inline ? (
                            <>
                              <button onClick={salvarInline} disabled={salvandoInline}
                                style={{ ...editButton, flex: 1, background: "#1faa4a", color: "#fff", border: "none" }}>
                                {salvandoInline ? "..." : "✔ Salvar"}
                              </button>
                              <button onClick={() => setEditandoInline(null)}
                                style={{ ...editButton, flex: 1, color: "#64748b" }}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => abrirInline(produto)} style={{ ...editButton, flex: 1 }}>✏️ Editar</button>
                              <button onClick={() => excluirProduto(produto.id)} style={{ ...deleteButton, flex: 1 }}>Excluir</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
            </div> : <div style={{ overflowX: "auto" }}>
              <div style={{ ...tableWrap, minWidth: 680 }}>
                <div style={thead}>
                  <div>Produto</div>
                  <div>Cód. interno</div>
                  <div>EAN</div>
                  <div>Custo</div>
                  <div>Dinheiro</div>
                  <div>Cartão</div>
                  <div>Estoque</div>
                  <div>Ações</div>
                </div>

                {produtosFiltrados.length === 0 ? (
                  <div style={{ padding: 16, color: "#66758a" }}>
                    {buscaLista ? `Nenhum produto encontrado para "${buscaLista}".` : "Nenhum produto cadastrado."}
                  </div>
                ) : (
                  produtosFiltrados.map((produto) => {
                    const inline = editandoInline?.id === produto.id;
                    return (
                      <div key={produto.id} style={{ ...trow, background: inline ? "#f0fdf4" : undefined, border: inline ? "2px solid #86efac" : undefined }}>
                        <div>
                          {inline ? (
                            <input
                              style={{ ...inputInline, fontWeight: 800, fontSize: 15 }}
                              value={editandoInline!.nome}
                              onChange={(e) => setEditandoInline({ ...editandoInline!, nome: e.target.value })}
                              autoFocus
                            />
                          ) : (
                            <>
                              <div style={{ fontWeight: 900, fontSize: 18, color: "#10243d", lineHeight: 1.05 }}>{produto.nome}</div>
                              <div style={{ color: "#66758a", marginTop: 2 }}>{produto.categoria || "-"}</div>
                            </>
                          )}
                        </div>
                        <div>{produto.codigo || "-"}</div>
                        <div>{produto.ean || "-"}</div>
                        <div>
                          {inline ? (
                            <input style={inputInline} value={editandoInline!.custo} inputMode="numeric"
                              onChange={(e) => setEditandoInline({ ...editandoInline!, custo: formatarDinheiroInput(e.target.value) })} />
                          ) : moeda(produto.custo)}
                        </div>
                        <div>
                          {inline ? (
                            <input style={inputInline} value={editandoInline!.preco} inputMode="numeric"
                              onChange={(e) => setEditandoInline({ ...editandoInline!, preco: formatarDinheiroInput(e.target.value) })} />
                          ) : moeda(produto.preco)}
                        </div>
                        <div>
                          {inline ? (
                            <input style={inputInline} value={editandoInline!.preco_cartao} inputMode="numeric"
                              onChange={(e) => setEditandoInline({ ...editandoInline!, preco_cartao: formatarDinheiroInput(e.target.value) })} />
                          ) : moeda(produto.preco_cartao)}
                        </div>
                        {temPrecoFiado && (
                          <div>
                            {inline ? (
                              <input style={inputInline} value={editandoInline!.preco_fiado} inputMode="numeric"
                                onChange={(e) => setEditandoInline({ ...editandoInline!, preco_fiado: formatarDinheiroInput(e.target.value) })} />
                            ) : moeda(produto.preco_fiado)}
                          </div>
                        )}
                        <div>
                          {inline ? (
                            <input style={{ ...inputInline, width: 64 }} value={editandoInline!.estoque} type="number" min={0} inputMode="numeric"
                              onChange={(e) => setEditandoInline({ ...editandoInline!, estoque: e.target.value })} />
                          ) : (
                            <span style={{ fontWeight: 700, whiteSpace: "nowrap", color: Number(produto.estoque ?? 0) <= 0 ? "#dc2626" : Number(produto.estoque) <= 5 ? "#d97706" : "#15803d" }}>
                              {produto.estoque ?? 0}{produto.unidade ? ` ${produto.unidade}` : ""}
                            </span>
                          )}
                        </div>
                        <div style={{ display: "grid", gap: 6 }}>
                          {inline ? (
                            <>
                              <button onClick={salvarInline} disabled={salvandoInline}
                                style={{ ...editButton, background: "#1faa4a", color: "#fff", border: "none" }}>
                                {salvandoInline ? "..." : "✔ Salvar"}
                              </button>
                              <button onClick={() => setEditandoInline(null)}
                                style={{ ...editButton, color: "#64748b" }}>
                                Cancelar
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => abrirInline(produto)} style={editButton}>✏️ Editar</button>
                              <button onClick={() => excluirProduto(produto.id)} style={deleteButton}>Excluir</button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>}
          </section>
        </div>
      </div>

      {/* Modal scanner de câmera */}
      {scannerAberto && (
        <BarcodeScannerModal
          onScanned={aoEscanear}
          onClose={() => setScannerAberto(false)}
        />
      )}

      {/* Modal: produto EAN já existe */}
      {modalEanDuplicado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 9998 }}>
          <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 18px 45px rgba(0,0,0,.4)" }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>Produto já cadastrado</div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 20 }}>
              Este código de barras já está vinculado ao produto:<br />
              <b style={{ color: "#16a34a", fontSize: 16 }}>{modalEanDuplicado.nome}</b><br /><br />
              Deseja abri-lo para edição?
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button onClick={() => setModalEanDuplicado(null)}
                style={{ height: 42, border: "1px solid #d5dde7", borderRadius: 10, background: "#f8fafc", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                Não, fechar
              </button>
              <button onClick={() => abrirEdicaoPorEan(modalEanDuplicado.id)}
                style={{ height: 42, border: "none", borderRadius: 10, background: "#16a34a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                Sim, editar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Importar NF-e */}
      {modalNFe && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, width: "100%", maxWidth: 600, maxHeight: "80vh", display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 18, color: "#0f172a" }}>📄 Importar NF-e</div>
            {nfeFornecedor && (
              <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 14px", fontSize: 14, color: "#0369a1" }}>
                <strong>Fornecedor:</strong> {nfeFornecedor}
              </div>
            )}
            <div style={{ fontSize: 13, color: "#475569" }}>
              <strong>{nfeItens.length} iten(s) encontrado(s).</strong> Produtos novos serão cadastrados; produtos existentes (mesmo código interno) terão o estoque somado.
            </div>
            <div style={{ overflowY: "auto", flex: 1, border: "1px solid #e2e8f0", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", color: "#64748b", fontWeight: 600 }}>Produto</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>Qtd</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", color: "#64748b", fontWeight: 600 }}>Custo</th>
                  </tr>
                </thead>
                <tbody>
                  {nfeItens.map((item, i) => (
                    <tr key={i} style={{ borderTop: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{item.nome}</div>
                        {item.codigo && <div style={{ fontSize: 11, color: "#94a3b8" }}>Cód: {item.codigo}{item.ean ? ` | EAN: ${item.ean}` : ""}</div>}
                      </td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#374151" }}>{item.qtd.toFixed(item.qtd % 1 === 0 ? 0 : 3)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", color: "#374151" }}>R$ {item.custo.toFixed(2).replace(".", ",")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {resultadoNFe && (
              <div style={{ background: resultadoNFe.erros.length > 0 ? "#fffbeb" : "#f0fdf4", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
                <div style={{ color: "#16a34a", fontWeight: 700 }}>✅ {resultadoNFe.ok} produto(s) importado(s) com sucesso!</div>
                {resultadoNFe.erros.map((e, i) => <div key={i} style={{ color: "#b45309", marginTop: 4 }}>⚠️ {e}</div>)}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => { setModalNFe(false); setNfeItens([]); setResultadoNFe(null); }}
                style={{ padding: "10px 20px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 600 }}
              >
                {resultadoNFe ? "Fechar" : "Cancelar"}
              </button>
              {!resultadoNFe && (
                <button
                  onClick={confirmarImportacaoNFe}
                  disabled={importandoNFe}
                  style={{ padding: "10px 20px", borderRadius: 8, border: "none", background: importandoNFe ? "#94a3b8" : "#16a34a", color: "#fff", cursor: importandoNFe ? "not-allowed" : "pointer", fontWeight: 700 }}
                >
                  {importandoNFe ? "⏳ Importando..." : "✅ Confirmar Importação"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

const msgBox: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe4ec",
  borderRadius: 18,
  padding: "12px 16px",
  color: "#1d4f2f",
  marginBottom: 14,
};

const contentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "490px 1fr",
  gap: 18,
  alignItems: "start",
};

const cardLeft: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15,23,42,.04)",
};

const cardRight: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15,23,42,.04)",
};

const title: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#11243d",
  marginBottom: 4,
};

const subtitle: React.CSSProperties = {
  color: "#66758a",
  marginTop: 4,
};

const headerList: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  marginBottom: 18,
};

const boxTitle: React.CSSProperties = {
  fontWeight: 800,
  color: "#1d3049",
  fontSize: 15,
  marginBottom: 8,
};

const boxDesc: React.CSSProperties = {
  color: "#66758a",
  fontSize: 13,
  marginBottom: 10,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  color: "#1d3049",
  fontSize: 16,
  marginBottom: 10,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 18,
};

const input: React.CSSProperties = {
  width: "100%",
  height: 48,
  borderRadius: 14,
  border: "1px solid #d5dde7",
  padding: "0 16px",
  fontSize: 16,
  color: "#243447",
  background: "#fff",
  outline: "none",
};

const miniBox: React.CSSProperties = {
  border: "1px solid #dfe7f0",
  background: "#f8fbff",
  borderRadius: 18,
  padding: 14,
  marginBottom: 18,
};

const importBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 38,
  padding: "0 16px",
  borderRadius: 10,
  background: "#2f66e4",
  color: "#fff",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};

const modeloBtn: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 38,
  padding: "0 16px",
  borderRadius: 10,
  border: "1px solid #b8c7da",
  background: "#f0f4fa",
  color: "#243447",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: 14,
};

const saveButton: React.CSSProperties = {
  marginTop: 22,
  border: "none",
  background: "#1fb14e",
  color: "#fff",
  height: 42,
  minWidth: 150,
  padding: "0 22px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const cancelButton: React.CSSProperties = {
  marginTop: 22,
  border: "1px solid #d5dde7",
  background: "#fff",
  color: "#243447",
  height: 42,
  minWidth: 150,
  padding: "0 22px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const greenCounter: React.CSSProperties = {
  border: "1px solid #b7edc5",
  background: "#edfdf0",
  color: "#1a7b39",
  borderRadius: 999,
  padding: "10px 16px",
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const tableWrap: React.CSSProperties = {
  borderTop: "1px solid #edf1f5",
};

const thead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.7fr .9fr 1.2fr .9fr .9fr .9fr .6fr 1fr",
  gap: 14,
  padding: "14px 12px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 15,
};

const trow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.7fr .9fr 1.2fr .9fr .9fr .9fr .6fr 1fr",
  gap: 14,
  padding: "14px 12px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 16,
};

const editButton: React.CSSProperties = {
  border: "1px solid #bfd8ff",
  background: "#eef5ff",
  color: "#2563eb",
  borderRadius: 999,
  height: 40,
  fontWeight: 800,
  cursor: "pointer",
  width: "100%",
};

const deleteButton: React.CSSProperties = {
  border: "none",
  background: "#ef2b2b",
  color: "#fff",
  borderRadius: 12,
  height: 40,
  fontWeight: 900,
  cursor: "pointer",
  width: "100%",
};

const inputInline: React.CSSProperties = {
  width: "100%",
  height: 38,
  borderRadius: 8,
  border: "1px solid #86efac",
  padding: "0 10px",
  fontSize: 14,
  color: "#0f172a",
  background: "#fff",
  outline: "none",
};

const cardLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "#8fa3b8",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  marginBottom: 2,
};

const cardVal: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: "#1f2937",
};
