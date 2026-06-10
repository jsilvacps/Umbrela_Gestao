'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import HeaderCebolao from "@/components/HeaderCebolao";
import { db } from "@/lib/supabaseClient";
import { useIsMobile } from "@/hooks/useIsMobile";

type Venda = {
  id: string;
  total: number | null;
  tipo_pagamento: string | null;
  created_at: string;
  cliente_id?: string | null;
  operador_nome?: string | null;
};

type Cliente = {
  id: string;
  nome: string;
};

type Empresa = {
  nome_fantasia?: string | null;
};

type ItemVenda = {
  produto_nome: string | null;
  quantidade: number;
  preco: number;
  produto_id?: string | null;
};

type RankingItem = {
  nome: string;
  totalQtd: number;
  totalReceita: number;
};

function moeda(v: number | null | undefined) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function VendasPage() {
  const isMobile = useIsMobile();

  /* ── Aba ativa ── */
  const [abaAtiva, setAbaAtiva] = useState<"vendas" | "itens">("vendas");

  /* ── Relatório de vendas ── */
  const [vendas, setVendas]       = useState<Venda[]>([]);
  const [clientes, setClientes]   = useState<Cliente[]>([]);
  const [empresa, setEmpresa]     = useState<Empresa>({});
  const [dataFiltro, setDataFiltro]           = useState("");
  const [pagamentoFiltro, setPagamentoFiltro] = useState("Todas");
  const [busca, setBusca]                     = useState("");

  /* ── Relatório de itens mais vendidos ── */
  const [itensDe, setItensDe]         = useState(hojeISO());
  const [itensAte, setItensAte]       = useState(hojeISO());
  const [rankingItens, setRankingItens] = useState<RankingItem[]>([]);
  const [carregandoItens, setCarregandoItens] = useState(false);
  const [jaConsultou, setJaConsultou] = useState(false);

  /* ── Carrega dados de vendas ── */
  const carregar = useCallback(async () => {
    const [{ data: vendasData }, { data: clientesData }, { data: empresaData }] = await Promise.all([
      db("vendas")
        .select("id, total, tipo_pagamento, created_at, cliente_id, operador_nome")
        .order("created_at", { ascending: false }),
      db("clientes").select("id, nome"),
      db("empresa")
        .select("nome_fantasia")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    setVendas((vendasData  || []) as Venda[]);
    setClientes((clientesData || []) as Cliente[]);
    if (empresaData) setEmpresa(empresaData as Empresa);
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  /* ── Atalho de teclado: P → imprimir ── */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      const digitando = ["input", "select", "textarea"].includes(tag);
      if (!digitando && (e.key === "p" || e.key === "P")) {
        e.preventDefault();
        window.print();
      }
      if (!digitando && (e.key === "l" || e.key === "L")) {
        e.preventDefault();
        limparFiltros();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Buscar itens mais vendidos ── */
  async function buscarItensMaisVendidos() {
    if (!itensDe || !itensAte) return;
    setCarregandoItens(true);
    setJaConsultou(true);
    try {
      // 1. Busca vendas do período
      const { data: vendasPeriodo } = await (db("vendas")
        .select("id") as any)
        .gte("created_at", `${itensDe}T00:00:00`)
        .lte("created_at", `${itensAte}T23:59:59`);

      const ids: string[] = (vendasPeriodo || []).map((v: any) => v.id);

      if (ids.length === 0) {
        setRankingItens([]);
        return;
      }

      // 2. Busca todos os itens dessas vendas
      const { data: itensData } = await (db("itens_venda")
        .select("produto_nome, quantidade, preco, produto_id") as any)
        .in("venda_id", ids);

      const itens: ItemVenda[] = (itensData || []) as ItemVenda[];

      // 3. Agrupa por produto_nome
      const mapaRanking: Record<string, RankingItem> = {};
      for (const item of itens) {
        const nome = item.produto_nome || "Produto sem nome";
        if (!mapaRanking[nome]) {
          mapaRanking[nome] = { nome, totalQtd: 0, totalReceita: 0 };
        }
        mapaRanking[nome].totalQtd     += Number(item.quantidade || 0);
        mapaRanking[nome].totalReceita += Number(item.quantidade || 0) * Number(item.preco || 0);
      }

      // 4. Ordena por quantidade desc
      const ranking = Object.values(mapaRanking).sort((a, b) => b.totalQtd - a.totalQtd);
      setRankingItens(ranking);
    } finally {
      setCarregandoItens(false);
    }
  }

  /* ── Filtros ── */
  const vendasFiltradas = useMemo(() => {
    return vendas.filter((venda) => {
      const cliente   = clientes.find((c) => c.id === venda.cliente_id);
      const nomeCliente = cliente?.nome || "Consumidor";
      const dataOk = dataFiltro
        ? new Date(venda.created_at).toLocaleDateString("pt-BR") === dataFiltro.split("-").reverse().join("/")
        : true;
      const pagamentoOk = pagamentoFiltro === "Todas"
        ? true
        : (venda.tipo_pagamento || "").toLowerCase() === pagamentoFiltro.toLowerCase();
      const buscaOk = busca.trim()
        ? `${venda.id} ${nomeCliente} ${venda.tipo_pagamento || ""}`.toLowerCase().includes(busca.toLowerCase())
        : true;
      return dataOk && pagamentoOk && buscaOk;
    });
  }, [vendas, clientes, dataFiltro, pagamentoFiltro, busca]);

  /* ── Totais ── */
  const totalGeral       = useMemo(() => vendasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0), [vendasFiltradas]);
  const totalDinheiro    = useMemo(() => vendasFiltradas.filter(v => (v.tipo_pagamento || "").toLowerCase() === "dinheiro").reduce((s, v) => s + Number(v.total || 0), 0), [vendasFiltradas]);
  const totalPix         = useMemo(() => vendasFiltradas.filter(v => (v.tipo_pagamento || "").toLowerCase() === "pix").reduce((s, v) => s + Number(v.total || 0), 0), [vendasFiltradas]);
  const totalCartaoFiado = useMemo(() => vendasFiltradas.filter(v => ["cartao","fiado"].includes((v.tipo_pagamento || "").toLowerCase())).reduce((s, v) => s + Number(v.total || 0), 0), [vendasFiltradas]);

  /* ── Totais itens ── */
  const totalUnidades  = useMemo(() => rankingItens.reduce((s, i) => s + i.totalQtd, 0), [rankingItens]);
  const totalReceitaIt = useMemo(() => rankingItens.reduce((s, i) => s + i.totalReceita, 0), [rankingItens]);

  function limparFiltros() {
    setDataFiltro("");
    setPagamentoFiltro("Todas");
    setBusca("");
  }

  const nomeEmpresa    = empresa.nome_fantasia || "Horti Gestão";
  const dataImpressao  = new Date().toLocaleString("pt-BR");
  const filtroTexto    = [
    dataFiltro      ? `Data: ${dataFiltro.split("-").reverse().join("/")}` : "Todas as datas",
    pagamentoFiltro !== "Todas" ? `Pagamento: ${pagamentoFiltro}` : "",
    busca           ? `Busca: "${busca}"` : "",
  ].filter(Boolean).join(" · ");

  /* ─────────────────────── RENDER ─────────────────────── */
  return (
    <main style={{ minHeight: "100vh", background: "#f3f5f7", padding: 12 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>

        {/* Header — oculto no print */}
        <div className="no-print">
          <HeaderCebolao />
        </div>

        {/* ── Tabs ── */}
        <div className="no-print" style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <button
            onClick={() => setAbaAtiva("vendas")}
            style={abaAtiva === "vendas" ? tabAtivo : tabInativo}
          >
            📋 Relatório de Vendas
          </button>
          <button
            onClick={() => setAbaAtiva("itens")}
            style={abaAtiva === "itens" ? tabAtivo : tabInativo}
          >
            🏆 Itens mais vendidos
          </button>
        </div>

        {/* ═══════════════════════════════════
            ABA: RELATÓRIO DE VENDAS
            ═══════════════════════════════════ */}
        {abaAtiva === "vendas" && (
          <>
            {/* Barra de ações */}
            <div className="no-print" style={actionBar}>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button autoFocus onClick={() => window.print()} style={btnPrint}>
                  🖨️ Imprimir / Salvar PDF
                  <kbd style={kbd}>P</kbd>
                </button>
                <button onClick={limparFiltros} style={btnLight}>
                  ✕ Limpar filtros
                  <kbd style={kbdGray}>L</kbd>
                </button>
              </div>
              <div style={{ fontSize: 13, color: "#66758a", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ fontWeight: 700 }}>{vendasFiltradas.length}</span> vendas exibidas
              </div>
            </div>

            {/* Filtros */}
            <section style={{ ...card, marginBottom: 14 }} className="no-print">
              <div style={titleStyle}>Relatório de vendas</div>
              <div style={subtitleStyle}>Use Tab para navegar entre campos e <strong>P</strong> para imprimir a qualquer momento.</div>
              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr",
                gap: 16,
              }}>
                <Field label="Filtrar por dia">
                  <input type="date" style={inputStyle} value={dataFiltro}
                    onChange={(e) => setDataFiltro(e.target.value)} />
                </Field>
                <Field label="Forma de pagamento">
                  <select style={inputStyle} value={pagamentoFiltro}
                    onChange={(e) => setPagamentoFiltro(e.target.value)}>
                    <option value="Todas">Todas</option>
                    <option value="dinheiro">Dinheiro</option>
                    <option value="pix">PIX</option>
                    <option value="cartao">Cartão</option>
                    <option value="fiado">Fiado</option>
                  </select>
                </Field>
                <Field label="Pesquisar">
                  <input style={inputStyle} value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    placeholder="Número, cliente, operador..." />
                </Field>
              </div>
            </section>

            {/* Cards de resumo */}
            <div style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
              gap: 14,
              marginBottom: 14,
            }}>
              <SummaryCard label="Total geral"     valor={moeda(totalGeral)}       destaque />
              <SummaryCard label="Dinheiro"        valor={moeda(totalDinheiro)}    />
              <SummaryCard label="PIX"             valor={moeda(totalPix)}         />
              <SummaryCard label="Cartão / Fiado"  valor={moeda(totalCartaoFiado)} />
            </div>

            {/* Tabela na tela */}
            <section style={card} className="no-print">
              <div style={{ overflowX: "auto" }}>
                <div style={{ ...tableWrap, minWidth: 620 }}>
                  <div style={thead}>
                    <div>Nº</div>
                    <div>Data / Hora</div>
                    <div>Cliente</div>
                    <div>Operador</div>
                    <div>Pagamento</div>
                    <div style={{ textAlign: "right" }}>Total</div>
                  </div>
                  {vendasFiltradas.length === 0 ? (
                    <div style={{ padding: 16, color: "#66758a" }}>Nenhuma venda encontrada.</div>
                  ) : vendasFiltradas.map((venda) => {
                    const cliente = clientes.find((c) => c.id === venda.cliente_id);
                    return (
                      <div key={venda.id} style={trow}>
                        <div style={{ fontFamily: "monospace", fontSize: 13 }}>{String(venda.id).slice(0, 8)}</div>
                        <div>{new Date(venda.created_at).toLocaleString("pt-BR")}</div>
                        <div style={{ fontWeight: 700 }}>{cliente?.nome || "Consumidor"}</div>
                        <div>{venda.operador_nome || "-"}</div>
                        <div>
                          <span style={payBadge(venda.tipo_pagamento)}>
                            {venda.tipo_pagamento || "-"}
                          </span>
                        </div>
                        <div style={{ textAlign: "right", fontWeight: 800, color: "#1a7b39" }}>
                          {moeda(venda.total)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* ══ ÁREA DE IMPRESSÃO ══ */}
            <div className="print-only">
              <div className="print-header">
                <div>
                  <div className="print-header-title">{nomeEmpresa}</div>
                  <div style={{ fontSize: "10pt", color: "#333", marginTop: 4 }}>Relatório de Vendas</div>
                </div>
                <div className="print-header-meta">
                  <div>Impresso em: {dataImpressao}</div>
                  <div>Filtros: {filtroTexto}</div>
                  <div>Total de registros: {vendasFiltradas.length}</div>
                </div>
              </div>
              <div className="print-summary">
                <div className="print-summary-item">
                  <div className="print-summary-label">Total geral</div>
                  <div className="print-summary-value">{moeda(totalGeral)}</div>
                </div>
                <div className="print-summary-item">
                  <div className="print-summary-label">Dinheiro</div>
                  <div className="print-summary-value">{moeda(totalDinheiro)}</div>
                </div>
                <div className="print-summary-item">
                  <div className="print-summary-label">PIX</div>
                  <div className="print-summary-value">{moeda(totalPix)}</div>
                </div>
                <div className="print-summary-item">
                  <div className="print-summary-label">Cartão / Fiado</div>
                  <div className="print-summary-value">{moeda(totalCartaoFiado)}</div>
                </div>
              </div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Nº</th>
                    <th>Data / Hora</th>
                    <th>Cliente</th>
                    <th>Operador</th>
                    <th>Pagamento</th>
                    <th style={{ textAlign: "right" }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFiltradas.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "12pt" }}>Nenhuma venda no período.</td></tr>
                  ) : vendasFiltradas.map((venda) => {
                    const cliente = clientes.find((c) => c.id === venda.cliente_id);
                    return (
                      <tr key={venda.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "8pt" }}>{String(venda.id).slice(0, 8)}</td>
                        <td>{new Date(venda.created_at).toLocaleString("pt-BR")}</td>
                        <td><strong>{cliente?.nome || "Consumidor"}</strong></td>
                        <td>{venda.operador_nome || "-"}</td>
                        <td>{venda.tipo_pagamento || "-"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700 }}>{moeda(venda.total)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={5} style={{ fontWeight: 800, paddingTop: "8pt", borderTop: "1.5pt solid #333" }}>
                      Total ({vendasFiltradas.length} vendas)
                    </td>
                    <td style={{ textAlign: "right", fontWeight: 900, fontSize: "11pt", paddingTop: "8pt", borderTop: "1.5pt solid #333" }}>
                      {moeda(totalGeral)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}

        {/* ═══════════════════════════════════
            ABA: ITENS MAIS VENDIDOS
            ═══════════════════════════════════ */}
        {abaAtiva === "itens" && (
          <>
            {/* Filtros de período */}
            <section style={{ ...card, marginBottom: 14 }}>
              <div style={titleStyle}>🏆 Itens mais vendidos</div>
              <div style={subtitleStyle}>Selecione o período e clique em <strong>Buscar</strong> para ver o ranking de produtos.</div>

              <div style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto",
                gap: 16,
                alignItems: "flex-end",
              }}>
                <Field label="De (data início)">
                  <input
                    type="date"
                    style={inputStyle}
                    value={itensDe}
                    onChange={(e) => setItensDe(e.target.value)}
                  />
                </Field>

                <Field label="Até (data fim)">
                  <input
                    type="date"
                    style={inputStyle}
                    value={itensAte}
                    onChange={(e) => setItensAte(e.target.value)}
                  />
                </Field>

                <button
                  onClick={buscarItensMaisVendidos}
                  disabled={carregandoItens || !itensDe || !itensAte}
                  style={{
                    ...btnBuscar,
                    opacity: (carregandoItens || !itensDe || !itensAte) ? 0.6 : 1,
                    cursor: (carregandoItens || !itensDe || !itensAte) ? "not-allowed" : "pointer",
                  }}
                >
                  {carregandoItens ? "⏳ Buscando..." : "🔍 Buscar"}
                </button>
              </div>
            </section>

            {/* Cards de resumo dos itens */}
            {jaConsultou && (
              <>
                <div style={{
                  display: "grid",
                  gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(3, 1fr)",
                  gap: 14,
                  marginBottom: 14,
                }}>
                  <SummaryCard label="Produtos diferentes" valor={String(rankingItens.length)} destaque />
                  <SummaryCard label="Total de unidades"   valor={totalUnidades.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} />
                  <SummaryCard label="Receita total"       valor={moeda(totalReceitaIt)} />
                </div>

                {/* Tabela de ranking */}
                <section style={card}>
                  {rankingItens.length === 0 ? (
                    <div style={{ padding: 24, textAlign: "center", color: "#66758a", fontSize: 16 }}>
                      Nenhuma venda encontrada no período selecionado.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ minWidth: 520 }}>
                        {/* Cabeçalho */}
                        <div style={theadItens}>
                          <div style={{ textAlign: "center" }}>#</div>
                          <div>Produto</div>
                          <div style={{ textAlign: "right" }}>Qtd. total</div>
                          <div style={{ textAlign: "right" }}>Receita total</div>
                          <div style={{ textAlign: "right" }}>Preço médio</div>
                        </div>

                        {rankingItens.map((item, idx) => {
                          const precoMedio = item.totalQtd > 0 ? item.totalReceita / item.totalQtd : 0;
                          const isPodio = idx < 3;
                          const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : "🥉";
                          return (
                            <div key={item.nome} style={{
                              ...trowItens,
                              background: isPodio ? (idx === 0 ? "#fffbeb" : idx === 1 ? "#f8fafc" : "#fdf7f0") : "#fff",
                              borderLeft: isPodio ? `4px solid ${idx === 0 ? "#f59e0b" : idx === 1 ? "#94a3b8" : "#cd7c3c"}` : "4px solid transparent",
                            }}>
                              <div style={{ textAlign: "center", fontWeight: 900, fontSize: 18, color: isPodio ? "#374151" : "#94a3b8" }}>
                                {isPodio ? medalha : idx + 1}
                              </div>
                              <div style={{ fontWeight: isPodio ? 800 : 600, color: "#11243d", fontSize: 15 }}>
                                {item.nome}
                              </div>
                              <div style={{ textAlign: "right", fontWeight: 800, fontSize: 16, color: "#1a7b39" }}>
                                {item.totalQtd % 1 === 0
                                  ? item.totalQtd.toLocaleString("pt-BR")
                                  : item.totalQtd.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                                <span style={{ fontWeight: 500, fontSize: 12, color: "#66758a", marginLeft: 4 }}>un</span>
                              </div>
                              <div style={{ textAlign: "right", fontWeight: 700, color: "#1d3049" }}>
                                {moeda(item.totalReceita)}
                              </div>
                              <div style={{ textAlign: "right", color: "#66758a", fontSize: 14 }}>
                                {moeda(precoMedio)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </section>

                {/* Área de impressão do ranking */}
                <div className="print-only">
                  <div className="print-header">
                    <div>
                      <div className="print-header-title">{nomeEmpresa}</div>
                      <div style={{ fontSize: "10pt", color: "#333", marginTop: 4 }}>
                        Itens Mais Vendidos — {itensDe.split("-").reverse().join("/")} a {itensAte.split("-").reverse().join("/")}
                      </div>
                    </div>
                    <div className="print-header-meta">
                      <div>Impresso em: {dataImpressao}</div>
                      <div>Produtos: {rankingItens.length} | Unidades: {totalUnidades.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</div>
                    </div>
                  </div>
                  <div className="print-summary">
                    <div className="print-summary-item">
                      <div className="print-summary-label">Produtos diferentes</div>
                      <div className="print-summary-value">{rankingItens.length}</div>
                    </div>
                    <div className="print-summary-item">
                      <div className="print-summary-label">Total de unidades</div>
                      <div className="print-summary-value">{totalUnidades.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}</div>
                    </div>
                    <div className="print-summary-item">
                      <div className="print-summary-label">Receita total</div>
                      <div className="print-summary-value">{moeda(totalReceitaIt)}</div>
                    </div>
                  </div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Produto</th>
                        <th style={{ textAlign: "right" }}>Qtd. total</th>
                        <th style={{ textAlign: "right" }}>Receita total</th>
                        <th style={{ textAlign: "right" }}>Preço médio</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rankingItens.map((item, idx) => {
                        const precoMedio = item.totalQtd > 0 ? item.totalReceita / item.totalQtd : 0;
                        return (
                          <tr key={item.nome}>
                            <td style={{ textAlign: "center", fontWeight: 800 }}>{idx + 1}º</td>
                            <td><strong>{item.nome}</strong></td>
                            <td style={{ textAlign: "right" }}>
                              {item.totalQtd % 1 === 0
                                ? item.totalQtd.toLocaleString("pt-BR")
                                : item.totalQtd.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                            </td>
                            <td style={{ textAlign: "right", fontWeight: 700 }}>{moeda(item.totalReceita)}</td>
                            <td style={{ textAlign: "right" }}>{moeda(precoMedio)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={2} style={{ fontWeight: 800, paddingTop: "8pt", borderTop: "1.5pt solid #333" }}>
                          Total ({rankingItens.length} produtos)
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 700, paddingTop: "8pt", borderTop: "1.5pt solid #333" }}>
                          {totalUnidades.toLocaleString("pt-BR", { maximumFractionDigits: 3 })}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 900, paddingTop: "8pt", borderTop: "1.5pt solid #333" }}>
                          {moeda(totalReceitaIt)}
                        </td>
                        <td style={{ paddingTop: "8pt", borderTop: "1.5pt solid #333" }} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </>
            )}
          </>
        )}

      </div>
    </main>
  );
}

/* ── Subcomponentes ── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontWeight: 800, color: "#1d3049", fontSize: 15, marginBottom: 8 }}>
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryCard({ label, valor, destaque }: { label: string; valor: string; destaque?: boolean }) {
  return (
    <div style={{
      border: `1px solid ${destaque ? "#b7edc5" : "#dde3ea"}`,
      background: destaque ? "#edfdf0" : "#fff",
      borderRadius: 18,
      padding: "14px 18px",
      boxShadow: "0 4px 12px rgba(15,23,42,.04)",
    }}>
      <div style={{ fontSize: 13, color: "#66758a", fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 900, color: destaque ? "#1a7b39" : "#11243d" }}>{valor}</div>
    </div>
  );
}

function payBadge(tipo: string | null): React.CSSProperties {
  const t = (tipo || "").toLowerCase();
  if (t === "dinheiro") return { background: "#edfdf0", color: "#1a7b39", border: "1px solid #b7edc5", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 };
  if (t === "pix")      return { background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 };
  if (t === "cartao")   return { background: "#faf5ff", color: "#7c3aed", border: "1px solid #ddd6fe", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 };
  if (t === "fiado")    return { background: "#fff7ed", color: "#c65d07", border: "1px solid #fed7aa", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 };
  return { background: "#f1f5f9", color: "#475569", borderRadius: 999, padding: "2px 10px", fontSize: 13, fontWeight: 700 };
}

/* ── Estilos ── */

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15,23,42,.04)",
  marginBottom: 14,
};

const actionBar: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: 12,
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 20,
  padding: "14px 18px",
  marginBottom: 14,
  boxShadow: "0 4px 14px rgba(15,23,42,.05)",
};

const btnPrint: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  border: "none",
  background: "#2f66e4",
  color: "#fff",
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  fontWeight: 900,
  fontSize: 16,
  cursor: "pointer",
};

const btnLight: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  border: "1px solid #d5dde7",
  background: "#fff",
  color: "#243447",
  height: 44,
  padding: "0 20px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
};

const btnBuscar: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  border: "none",
  background: "#1a7b39",
  color: "#fff",
  height: 46,
  padding: "0 28px",
  borderRadius: 14,
  fontWeight: 900,
  fontSize: 16,
  whiteSpace: "nowrap",
};

const tabAtivo: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 14,
  border: "none",
  background: "#1a7b39",
  color: "#fff",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
  boxShadow: "0 4px 12px rgba(26,123,57,.25)",
};

const tabInativo: React.CSSProperties = {
  padding: "10px 22px",
  borderRadius: 14,
  border: "1px solid #dde3ea",
  background: "#fff",
  color: "#243447",
  fontWeight: 700,
  fontSize: 15,
  cursor: "pointer",
};

const kbd: React.CSSProperties = {
  background: "rgba(255,255,255,.25)",
  border: "1px solid rgba(255,255,255,.4)",
  borderRadius: 6,
  padding: "1px 7px",
  fontSize: 13,
  fontFamily: "monospace",
  fontWeight: 700,
  color: "#fff",
};

const kbdGray: React.CSSProperties = {
  background: "#f1f5f9",
  border: "1px solid #cbd5e1",
  borderRadius: 6,
  padding: "1px 7px",
  fontSize: 13,
  fontFamily: "monospace",
  fontWeight: 700,
  color: "#475569",
};

const titleStyle: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 900,
  color: "#11243d",
  marginBottom: 4,
};

const subtitleStyle: React.CSSProperties = {
  color: "#66758a",
  marginBottom: 18,
  fontSize: 14,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 46,
  borderRadius: 14,
  border: "1px solid #d5dde7",
  padding: "0 16px",
  fontSize: 15,
  color: "#243447",
  background: "#fff",
  outline: "none",
};

const tableWrap: React.CSSProperties = {
  borderTop: "1px solid #edf1f5",
};

const cols = ".7fr 1.6fr 1.2fr 1fr .9fr .9fr";

const thead: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: cols,
  gap: 14,
  padding: "12px 14px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 14,
  background: "#f8fafc",
  borderBottom: "1px solid #e5eaf0",
};

const trow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: cols,
  gap: 14,
  padding: "12px 14px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 14,
};

const colsItens = "52px 1fr .8fr .9fr .75fr";

const theadItens: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: colsItens,
  gap: 14,
  padding: "12px 18px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 14,
  background: "#f8fafc",
  borderBottom: "1px solid #e5eaf0",
  borderRadius: "12px 12px 0 0",
};

const trowItens: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: colsItens,
  gap: 14,
  padding: "14px 18px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 14,
  transition: "background 0.1s",
};
