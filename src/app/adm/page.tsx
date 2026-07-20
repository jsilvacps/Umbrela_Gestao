'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import HeaderUmbrela from "@/components/HeaderUmbrela";
import { supabase, db, isConfigurado, getEmpresaId } from "@/lib/supabaseClient";
import { useIsMobile } from "@/hooks/useIsMobile";
import { gerarChave } from "@/lib/licenca";
import { carregarFeatures, temFeature, type FeatureKey } from "@/lib/features";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const MASTER_USERNAME = "jeansilva3323@gmail.com";

const SENHA_PADRAO = "1234";
const SENHA_MASTER = "D@na2014";

type Empresa = {
  id?: string;
  empresa_id?: number;
  nome_fantasia?: string | null;
  logo_url?: string | null;
  cnpj?: string | null;
  telefone?: string | null;
  endereco?: string | null;
  cupom_largura?: number | null;
  cupom_cabecalho?: string | null;
  cupom_rodape?: string | null;
};

type Operador = {
  id: string;
  nome?: string | null;
  username: string;
  blocked?: boolean | null;
  perm_finalizar?:      boolean | null;
  perm_cancelar_item?:  boolean | null;
  perm_cancelar_venda?: boolean | null;
  perm_sangria?:        boolean | null;
  perm_relatorios?:     boolean | null;
  perm_desconto?:       boolean | null;
  perm_buscar_cupons?:  boolean | null;
};

type Produto = {
  id: string;
  nome: string;
  preco: number | null;
  preco_cartao: number | null;
  categoria?: string | null;
};

type Venda = {
  id: string;
  total: number | null;
  tipo_pagamento: string | null;
  created_at: string;
};

type Cancelado = {
  id: string;
  motivo?: string | null;
  created_at: string;
  operador?: string | null;
  produto_nome?: string | null;
  total?: number | null;
  quantidade?: number | null;
  preco?: number | null;
  valor?: number | null;
};

type SenhasOperacionais = {
  id?: string;
  adm_password?: string | null;
  senha_cancelar_item?: string | null;
  senha_cancelar_venda?: string | null;
  senha_sangria?: string | null;
  senha_suprimento?: string | null;
  senha_alterar_preco?: string | null;
  senha_reabrir_caixa?: string | null;
};

type CategoriaProduto = {
  id: string;
  nome: string;
};

type Licenca = {
  id: string;
  chave: string;
  plano: string;
  cliente: string | null;
  ativo: boolean;
  ativado_em: string | null;
  validade: string | null;
  criado_em: string;
  notas: string | null;
};

function moeda(v: number | null | undefined) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

// Supabase retorna timestamps sem 'Z' — força leitura como UTC antes de converter para SP
function fmtSP(d: string, opts?: Intl.DateTimeFormatOptions) {
  const utc = d && !d.endsWith("Z") && !d.includes("+") ? d + "Z" : d;
  return new Date(utc).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", ...opts });
}

function Paginacao({ pagina, total, porPagina, onChange }: { pagina: number; total: number; porPagina: number; onChange: (p: number) => void }) {
  const totalPag = Math.ceil(total / porPagina);
  if (totalPag <= 1) return null;
  const btn = (label: string | number, p: number, ativo = false, disabled = false) => (
    <button key={label} onClick={() => !disabled && onChange(p)} disabled={disabled}
      style={{ padding: "5px 11px", borderRadius: 7, border: ativo ? "2px solid #1a7b39" : "1px solid #d1d9e0", background: ativo ? "#1a7b39" : disabled ? "#f5f5f5" : "#fff", color: ativo ? "#fff" : disabled ? "#b0b8c1" : "#25354b", fontWeight: ativo ? 800 : 500, fontSize: 13, cursor: disabled ? "default" : "pointer" }}>
      {label}
    </button>
  );
  const pages: (number | "...")[] = [];
  if (totalPag <= 7) { for (let i = 1; i <= totalPag; i++) pages.push(i); }
  else {
    pages.push(1);
    if (pagina > 3) pages.push("...");
    for (let i = Math.max(2, pagina - 1); i <= Math.min(totalPag - 1, pagina + 1); i++) pages.push(i);
    if (pagina < totalPag - 2) pages.push("...");
    pages.push(totalPag);
  }
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
      {btn("‹", pagina - 1, false, pagina === 1)}
      {pages.map((p, i) => p === "..." ? <span key={`e${i}`} style={{ padding: "5px 4px", color: "#64748b" }}>…</span> : btn(p, p as number, p === pagina))}
      {btn("›", pagina + 1, false, pagina === totalPag)}
      <span style={{ fontSize: 12, color: "#64748b", marginLeft: 6 }}>{total} registros</span>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
type DashVendaExt = { total: number; tipo_pagamento: string; created_at: string };

const PGTO_CORES: Record<string, string> = {
  dinheiro: "#16a34a",
  cartao:   "#2563eb",
  pix:      "#7c3aed",
  fiado:    "#ea580c",
  outros:   "#64748b",
};
const PGTO_LABEL: Record<string, string> = {
  dinheiro: "Dinheiro",
  cartao:   "Cartão",
  pix:      "PIX",
  fiado:    "Fiado",
  outros:   "Outros",
};

function normalizarPgto(tipo: string): string {
  const t = (tipo || "").toLowerCase().trim();
  if (t.includes("dinheiro")) return "dinheiro";
  if (t.includes("cart")) return "cartao";
  if (t.includes("pix")) return "pix";
  if (t.includes("fiado")) return "fiado";
  return "outros";
}

function PizzaChart({ dados, tamanho = 180 }: { dados: { label: string; valor: number; cor: string }[]; tamanho?: number }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>Sem vendas</div>;

  const cx = tamanho / 2, cy = tamanho / 2, r = tamanho / 2 - 8;
  let angulo = -Math.PI / 2;
  const fatias = dados.filter(d => d.valor > 0).map(d => {
    const pct = d.valor / total;
    const inicio = angulo;
    angulo += pct * 2 * Math.PI;
    return { ...d, pct, inicio, fim: angulo };
  });

  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
      {fatias.map((f, i) => {
        const x1 = cx + r * Math.cos(f.inicio), y1 = cy + r * Math.sin(f.inicio);
        const x2 = cx + r * Math.cos(f.fim),   y2 = cy + r * Math.sin(f.fim);
        const grande = f.pct > 0.5 ? 1 : 0;
        return (
          <path
            key={i}
            d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${grande} 1 ${x2} ${y2} Z`}
            fill={f.cor}
            stroke="#fff"
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}

function Legenda({ dados }: { dados: { label: string; valor: number; cor: string }[] }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 140 }}>
      {dados.filter(d => d.valor > 0).map((d, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 12, height: 12, borderRadius: 3, background: d.cor, flexShrink: 0 }} />
          <div style={{ fontSize: 13, color: "#334155" }}>
            <span style={{ fontWeight: 600 }}>{d.label}</span>
            <span style={{ color: "#64748b", marginLeft: 4 }}>R$ {d.valor.toFixed(2).replace(".", ",")} {total > 0 ? `(${((d.valor/total)*100).toFixed(0)}%)` : ""}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function GraficoBarras({ hoje, ontem }: { hoje: number; ontem: number }) {
  const maxVal = Math.max(hoje, ontem, 1);
  const altMax = 120;
  const altHoje  = (hoje  / maxVal) * altMax;
  const altOntem = (ontem / maxVal) * altMax;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 24, justifyContent: "center", padding: "0 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>R$ {ontem.toFixed(2).replace(".", ",")}</div>
        <div style={{ width: 56, height: altOntem, background: "#94a3b8", borderRadius: "6px 6px 0 0", minHeight: 4 }} />
        <div style={{ fontSize: 12, color: "#64748b" }}>Ontem</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#16a34a" }}>R$ {hoje.toFixed(2).replace(".", ",")}</div>
        <div style={{ width: 56, height: altHoje, background: "#16a34a", borderRadius: "6px 6px 0 0", minHeight: 4 }} />
        <div style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>Hoje</div>
      </div>
    </div>
  );
}

function GraficoBarrasClientes({ hoje, ontem }: { hoje: number; ontem: number }) {
  const maxVal = Math.max(hoje, ontem, 1);
  const altMax = 120;
  const altHoje  = (hoje  / maxVal) * altMax;
  const altOntem = (ontem / maxVal) * altMax;
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 24, justifyContent: "center", padding: "0 12px" }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#334155" }}>{ontem} cliente(s)</div>
        <div style={{ width: 56, height: altOntem, background: "#94a3b8", borderRadius: "6px 6px 0 0", minHeight: 4 }} />
        <div style={{ fontSize: 12, color: "#64748b" }}>Ontem</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7c3aed" }}>{hoje} cliente(s)</div>
        <div style={{ width: 56, height: altHoje, background: "#7c3aed", borderRadius: "6px 6px 0 0", minHeight: 4 }} />
        <div style={{ fontSize: 12, color: "#7c3aed", fontWeight: 600 }}>Hoje</div>
      </div>
    </div>
  );
}

function PizzaChartClientes({ dados, tamanho = 180 }: { dados: { label: string; valor: number; cor: string }[]; tamanho?: number }) {
  const total = dados.reduce((s, d) => s + d.valor, 0);
  if (total === 0) return <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: 20 }}>Sem atendimentos</div>;
  const cx = tamanho / 2, cy = tamanho / 2, r = tamanho / 2 - 8;
  let angulo = -Math.PI / 2;
  const fatias = dados.filter(d => d.valor > 0).map(d => {
    const pct = d.valor / total;
    const inicio = angulo;
    angulo += pct * 2 * Math.PI;
    return { ...d, pct, inicio, fim: angulo };
  });
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`}>
      {fatias.map((f, i) => {
        const x1 = cx + r * Math.cos(f.inicio), y1 = cy + r * Math.sin(f.inicio);
        const x2 = cx + r * Math.cos(f.fim),   y2 = cy + r * Math.sin(f.fim);
        const grande = f.pct > 0.5 ? 1 : 0;
        return <path key={i} d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${grande} 1 ${x2} ${y2} Z`} fill={f.cor} stroke="#fff" strokeWidth={2} />;
      })}
    </svg>
  );
}

function DashboardAba({ hoje, ontem, mes, somaHoje, somaOntem, somaMes, clientesHoje, clientesOntem, clientesMes, carregando, onAtualizar }: {
  hoje: { total: number; tipo_pagamento: string }[];
  ontem: { total: number; tipo_pagamento: string }[];
  mes: { total: number; tipo_pagamento: string }[];
  somaHoje: number; somaOntem: number; somaMes: number;
  clientesHoje: number;
  clientesOntem: number;
  clientesMes: number;
  carregando: boolean; onAtualizar: () => void;
}) {
  function totaisPorPgto(lista: { total: number; tipo_pagamento: string }[]) {
    const acc: Record<string, number> = { dinheiro: 0, cartao: 0, pix: 0, fiado: 0, outros: 0 };
    for (const v of lista) {
      const k = normalizarPgto(v.tipo_pagamento);
      acc[k] = (acc[k] || 0) + Number(v.total || 0);
    }
    return acc;
  }

  const totHoje  = totaisPorPgto(hoje);
  const totOntem = totaisPorPgto(ontem);
  const totMes   = totaisPorPgto(mes);
  // somaHoje/somaOntem/somaMes vêm das props (RPC — sem limite de linhas)
  const qtdHoje   = clientesHoje;
  const qtdMes    = clientesMes;

  function dadosPizza(tots: Record<string, number>) {
    return Object.entries(PGTO_LABEL).map(([key, label]) => ({ label, valor: tots[key] || 0, cor: PGTO_CORES[key] }));
  }

  const cardDash: React.CSSProperties = {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 2px 12px rgba(0,0,0,0.07)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  };

  if (carregando) return (
    <section style={{ padding: 24, textAlign: "center", color: "#64748b" }}>⏳ Carregando dados...</section>
  );

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 20, padding: "4px 0" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontWeight: 800, fontSize: 20, color: "#0f172a" }}>📈 Dashboard</div>
        <button onClick={onAtualizar} style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: 13 }}>
          🔄 Atualizar
        </button>
      </div>

      {/* Cards de resumo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14 }}>
        {[
          { label: "Hoje", valor: somaHoje, qtd: clientesHoje, cor: "#16a34a" },
          { label: "Ontem", valor: somaOntem, qtd: clientesOntem, cor: "#64748b" },
          { label: "Mês", valor: somaMes, qtd: clientesMes, cor: "#2563eb" },
        ].map((c) => {
          const ticket = c.qtd > 0 ? c.valor / c.qtd : 0;
          return (
            <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderTop: `4px solid ${c.cor}` }}>
              <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: c.cor }}>R$ {c.valor.toFixed(2).replace(".", ",")}</div>
              {ticket > 0 && (
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 6 }}>
                  Ticket médio: <strong>R$ {ticket.toFixed(2).replace(".", ",")}</strong>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 3 gráficos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>

        {/* Gráfico 1: Pizza vendas de hoje por forma de pagamento */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Vendas de Hoje</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Por forma de pagamento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <PizzaChart dados={dadosPizza(totHoje)} />
            <Legenda dados={dadosPizza(totHoje)} />
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#475569" }}>
            Total: <strong>R$ {somaHoje.toFixed(2).replace(".", ",")}</strong> · {qtdHoje} venda(s)
          </div>
        </div>

        {/* Gráfico 2: Barras hoje vs ontem */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Hoje vs Ontem</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Comparação de total de vendas</div>
          <GraficoBarras hoje={somaHoje} ontem={somaOntem} />
          {somaOntem > 0 && (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: somaHoje >= somaOntem ? "#16a34a" : "#ea580c" }}>
              {somaHoje >= somaOntem
                ? `▲ +R$ ${(somaHoje - somaOntem).toFixed(2).replace(".", ",")} acima de ontem`
                : `▼ -R$ ${(somaOntem - somaHoje).toFixed(2).replace(".", ",")} abaixo de ontem`}
            </div>
          )}
        </div>

        {/* Gráfico 3: Pizza acumulado do mês */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Acumulado do Mês</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Por forma de pagamento</div>
          <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap", justifyContent: "center" }}>
            <PizzaChart dados={dadosPizza(totMes)} />
            <Legenda dados={dadosPizza(totMes)} />
          </div>
          <div style={{ textAlign: "center", fontSize: 13, color: "#475569" }}>
            Total: <strong>R$ {somaMes.toFixed(2).replace(".", ",")}</strong> · {qtdMes} venda(s)
          </div>
        </div>

      </div>

      {/* Cards de resumo — clientes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 14, marginTop: 8 }}>
        {[
          { label: "Clientes Hoje", valor: clientesHoje, cor: "#7c3aed" },
          { label: "Clientes Ontem", valor: clientesOntem, cor: "#64748b" },
          { label: "Clientes no Mês", valor: clientesMes, cor: "#0891b2" },
        ].map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", borderTop: `4px solid ${c.cor}` }}>
            <div style={{ fontSize: 12, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>{c.label}</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: c.cor }}>{c.valor} atend.</div>
          </div>
        ))}
      </div>

      {/* 3 gráficos de clientes */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 20 }}>

        {/* Clientes hoje — pizza por hora do dia */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Clientes Atendidos Hoje</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Atendimentos no dia</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#7c3aed" }}>{clientesHoje}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>atendimentos hoje</div>
          </div>
          <PizzaChartClientes dados={[
            { label: "Hoje", valor: clientesHoje, cor: "#7c3aed" },
            { label: "Restante do mês", valor: Math.max(0, clientesMes - clientesHoje), cor: "#e2e8f0" },
          ]} tamanho={160} />
          <div style={{ textAlign: "center", fontSize: 12, color: "#64748b" }}>
            {clientesMes > 0 ? `${((clientesHoje / clientesMes) * 100).toFixed(1)}% do total do mês` : ""}
          </div>
        </div>

        {/* Hoje vs Ontem — clientes */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Clientes: Hoje vs Ontem</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Comparação de atendimentos</div>
          <GraficoBarrasClientes hoje={clientesHoje} ontem={clientesOntem} />
          {clientesOntem > 0 && (
            <div style={{ textAlign: "center", fontSize: 13, fontWeight: 600, color: clientesHoje >= clientesOntem ? "#7c3aed" : "#ea580c" }}>
              {clientesHoje >= clientesOntem
                ? `▲ +${clientesHoje - clientesOntem} acima de ontem`
                : `▼ -${clientesOntem - clientesHoje} abaixo de ontem`}
            </div>
          )}
        </div>

        {/* Acumulado do mês — clientes */}
        <div style={cardDash}>
          <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a" }}>Clientes Acumulados no Mês</div>
          <div style={{ fontSize: 12, color: "#64748b" }}>Total de atendimentos</div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <div style={{ fontSize: 48, fontWeight: 900, color: "#0891b2" }}>{clientesMes}</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>atendimentos no mês</div>
          </div>
          {clientesMes > 0 && clientesHoje > 0 && (() => {
            const agoraSP = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
            const diaAtual = agoraSP.getDate();
            const diasNoMes = new Date(agoraSP.getFullYear(), agoraSP.getMonth() + 1, 0).getDate();
            const mediaDiaria = Math.round(clientesMes / diaAtual);
            const projecao = mediaDiaria * diasNoMes;
            return (
              <div style={{ textAlign: "center", fontSize: 13, color: "#64748b", marginTop: 4 }}>
                Média: <strong>{mediaDiaria}/dia</strong> · Projeção: <strong>{projecao}</strong>
              </div>
            );
          })()}
        </div>

      </div>
    </section>
  );
}

export default function AdmPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [aba, setAba] = useState("dashboard");
  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const feat = (key: FeatureKey) => temFeature(key, features);
  const operadorLogadoId = (() => {
    if (typeof window === "undefined") return undefined;
    try { return JSON.parse(sessionStorage.getItem("operador_logado") || "{}")?.id as string | undefined; } catch { return undefined; }
  })();
  const [pushErro, setPushErro] = useState("");
  const push = usePushNotifications(operadorLogadoId);
  const isDev = (() => {
    if (typeof window === "undefined") return false;
    try {
      const op = JSON.parse(sessionStorage.getItem("operador_logado") || "{}");
      return (op.username ?? "").toLowerCase() === MASTER_USERNAME.toLowerCase();
    } catch { return false; }
  })();
  const [senha, setSenha] = useState("");
  const [liberado, setLiberado] = useState(false);
  const [erro, setErro] = useState("");
  const [modalSelecionarEmpresa, setModalSelecionarEmpresa] = useState(false);
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<{empresa_id: number, nome_cliente: string, codigo: string}[]>([]);
  const [msg, setMsg] = useState("");
  const [logoNomeArquivo, setLogoNomeArquivo] = useState("");

  const [empresa, setEmpresa] = useState<Empresa>({});
  const [operadores, setOperadores] = useState<Operador[]>([]);
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [itensCancelados, setItensCancelados] = useState<Cancelado[]>([]);
  const [cuponsCancelados, setCuponsCancelados] = useState<Cancelado[]>([]);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [produtoBusca, setProdutoBusca] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");
  const [rankingMaisVendidos, setRankingMaisVendidos] = useState<{ nome: string; totalQtd: number; totalReceita: number }[]>([]);
  const [carregandoRanking, setCarregandoRanking] = useState(false);
  const [subAbaRel, setSubAbaRel] = useState<"geral" | "ranking" | "fiado" | "itens-cancelados" | "cupons-cancelados">("geral");
  const [vendasFiado, setVendasFiado] = useState<any[]>([]);
  const [filtroFiadoAdm, setFiltroFiadoAdm] = useState("");
  const [paginaGeral, setPaginaGeral] = useState(1);
  const [paginaRanking, setPaginaRanking] = useState(1);
  const [paginaItensCanc, setPaginaItensCanc] = useState(1);
  const [paginaCuponsCanc, setPaginaCuponsCanc] = useState(1);
  const POR_PAGINA = 20;

  const permPadrao = {
    perm_finalizar: true, perm_cancelar_item: true, perm_cancelar_venda: true,
    perm_sangria: true, perm_relatorios: true, perm_desconto: true, perm_buscar_cupons: true,
  };
  const [novoOperador, setNovoOperador] = useState({ nome: "", username: "", password: "", confirm: "", ...permPadrao });
  const [editandoOpId, setEditandoOpId] = useState<string | null>(null);
  const [showSenha1, setShowSenha1] = useState(false);
  const [showSenha2, setShowSenha2] = useState(false);
  const [categoriasProduto, setCategoriasProduto] = useState<CategoriaProduto[]>([]);
  const [novaCategoria, setNovaCategoria] = useState("");
  const [qtdEtiquetas, setQtdEtiquetas] = useState(1);
  const [larguraEtiqueta, setLarguraEtiqueta] = useState<58 | 80>(58);

  // ── NFC-e ────────────────────────────────────────────────────────────────────
  type NfceConfig = {
    provider: "focusnfe" | "nfeio";
    token: string;
    ambiente: "homologacao" | "producao";
    ie: string;
    crt: "1" | "2" | "3";
    cnpj: string;
    razao_social: string;
    municipio: string;
    uf: string;
    cep: string;
    logradouro: string;
    numero: string;
    bairro: string;
    telefone: string;
  };
  const nfceDefault: NfceConfig = { provider: "focusnfe", token: "", ambiente: "homologacao", ie: "", crt: "1", cnpj: "", razao_social: "", municipio: "", uf: "SP", cep: "", logradouro: "", numero: "", bairro: "", telefone: "" };
  const [nfceConfig, setNfceConfig] = useState<NfceConfig>(nfceDefault);
  const [nfceSalvando, setNfceSalvando] = useState(false);
  const [nfceMsg, setNfceMsg] = useState("");
  const [nfceNotas, setNfceNotas] = useState<{id: string; numero?: string; status: string; total: number; created_at: string; chave_acesso?: string}[]>([]);

  const carregarNfceConfig = useCallback(async () => {
    const { data } = await db("empresa").select("nfce_config, cnpj, nome_fantasia").limit(1).maybeSingle();
    if (data?.nfce_config) {
      setNfceConfig({ ...nfceDefault, ...(data.nfce_config as object) });
    } else if (data) {
      // Pré-preenche CNPJ e razão social da empresa
      setNfceConfig(prev => ({
        ...prev,
        cnpj: (data as {cnpj?: string}).cnpj || "",
        razao_social: (data as {nome_fantasia?: string}).nome_fantasia || "",
      }));
    }
    const { data: notas } = await db("nfce_notas").select("id, numero, status, total, created_at, chave_acesso").order("created_at", { ascending: false }).limit(50);
    setNfceNotas((notas || []) as typeof nfceNotas);
  }, []);

  async function salvarNfceConfig(e: React.FormEvent) {
    e.preventDefault();
    setNfceSalvando(true);
    setNfceMsg("");
    const { error } = await db("empresa").update({ nfce_config: nfceConfig } as Record<string, unknown>).eq("empresa_id", getEmpresaId());
    setNfceSalvando(false);
    setNfceMsg(error ? `❌ Erro: ${error.message}` : "✅ Configuração salva com sucesso!");
    setTimeout(() => setNfceMsg(""), 4000);
  }

  async function testarConexaoNfce() {
    setNfceMsg("⏳ Testando conexão...");
    try {
      const base = nfceConfig.provider === "focusnfe"
        ? `https://${nfceConfig.ambiente === "producao" ? "api" : "homologacao"}.focusnfe.com.br`
        : `https://api.nfe.io`;
      const res = await fetch(`/api/nfce/testar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: nfceConfig.provider, token: nfceConfig.token, ambiente: nfceConfig.ambiente, base }),
      });
      const json = await res.json();
      setNfceMsg(json.ok ? "✅ Conexão OK! Token válido." : `❌ Falha: ${json.erro}`);
    } catch {
      setNfceMsg("❌ Erro ao testar conexão.");
    }
    setTimeout(() => setNfceMsg(""), 6000);
  }

  useEffect(() => {
    if (aba === "nfce" && liberado) carregarNfceConfig();
  }, [aba, liberado, carregarNfceConfig]);

  // ── Maquininha (multi-provedor) ──────────────────────────────────────────────
  type MaquininhaConfig = {
    provider: "mercadopago" | "stone";
    mp_token: string;
    mp_device_id: string;
    stone_token: string;
    stone_terminal_id: string;
  };
  const maquininhaDefault: MaquininhaConfig = { provider: "mercadopago", mp_token: "", mp_device_id: "", stone_token: "", stone_terminal_id: "" };
  const [maqConfig, setMaqConfig]       = useState<MaquininhaConfig>(maquininhaDefault);
  const [maqDispositivos, setMaqDispositivos] = useState<{ id: string; label?: string }[]>([]);
  const [maqMsg, setMaqMsg]             = useState("");
  const [maqSalvando, setMaqSalvando]   = useState(false);
  const [maqBuscando, setMaqBuscando]   = useState(false);

  const carregarMaqConfig = useCallback(async () => {
    const { data } = await db("empresa").select("maquininha_config, mp_config").limit(1).maybeSingle();
    if (data?.maquininha_config) {
      setMaqConfig({ ...maquininhaDefault, ...(data.maquininha_config as object) });
    } else if (data?.mp_config) {
      // Migração de mp_config legado
      const mp = data.mp_config as { token?: string; device_id?: string };
      setMaqConfig({ ...maquininhaDefault, provider: "mercadopago", mp_token: mp.token || "", mp_device_id: mp.device_id || "" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (aba === "maquininha" && liberado) carregarMaqConfig();
  }, [aba, liberado, carregarMaqConfig]);

  async function buscarDispositivos() {
    const token = maqConfig.provider === "mercadopago" ? maqConfig.mp_token : maqConfig.stone_token;
    if (!token) { setMaqMsg("❌ Informe o token primeiro."); return; }
    setMaqBuscando(true);
    try {
      const action = maqConfig.provider === "mercadopago" ? "mp_dispositivos" : "stone_dispositivos";
      const res  = await fetch("/api/maquininha", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, token }) });
      const json = await res.json();
      if (json.ok) {
        setMaqDispositivos(json.devices || []);
        setMaqMsg(json.devices.length ? `✅ ${json.devices.length} terminal(is) encontrado(s).` : "⚠️ Nenhum terminal vinculado.");
      } else { setMaqMsg(`❌ ${json.erro}`); }
    } catch { setMaqMsg("❌ Erro ao buscar terminais."); }
    setMaqBuscando(false);
    setTimeout(() => setMaqMsg(""), 6000);
  }

  async function salvarMaqConfig(e: React.FormEvent) {
    e.preventDefault();
    setMaqSalvando(true);
    const { error } = await db("empresa").update({ maquininha_config: maqConfig } as Record<string, unknown>).eq("empresa_id", getEmpresaId());
    setMaqSalvando(false);
    setMaqMsg(error ? `❌ Erro: ${error.message}` : "✅ Configuração salva!");
    if (!error) localStorage.setItem("hg_maquininha_config", JSON.stringify(maqConfig));
    setTimeout(() => setMaqMsg(""), 4000);
  }

  // ── Abrir PDV ───────────────────────────────────────────────────────────────
  const [modalDownloadPDV, setModalDownloadPDV] = useState(false);
  const [urlDownloadPDV, setUrlDownloadPDV] = useState("https://github.com/jsilvacps/umbrela-gestao/releases/latest");

  function abrirCaixaPDV() {
    let abriu = false;
    const onBlur = () => { abriu = true; window.removeEventListener("blur", onBlur); };
    window.addEventListener("blur", onBlur);
    window.location.href = "umbrelagestao://open";
    setTimeout(() => {
      window.removeEventListener("blur", onBlur);
      if (!abriu) {
        // Busca URL do instalador mais recente
        fetch("https://umbrela-gestao.vercel.app/version.json")
          .then(r => r.json())
          .then(j => { if (j.download) setUrlDownloadPDV(j.download); })
          .catch(() => {});
        setModalDownloadPDV(true);
      }
    }, 800);
  }

  // ── Licenças ────────────────────────────────────────────────────────────────
  const [senhasCarregadas, setSenhasCarregadas] = useState(false);
  const [licencas, setLicencas] = useState<Licenca[]>([]);
  const [novaLicCliente, setNovaLicCliente] = useState("");
  const [novaLicNotas, setNovaLicNotas] = useState("");
  const [novaLicQtd, setNovaLicQtd] = useState(1);
  const [licencasGeradas, setLicencasGeradas] = useState<string[]>([]);
  const [licCopied, setLicCopied] = useState(false);

  const [senhasOp, setSenhasOp] = useState<SenhasOperacionais>({
    adm_password: SENHA_PADRAO,
    senha_cancelar_item: "",
    senha_cancelar_venda: "",
    senha_sangria: "",
    senha_suprimento: "",
    senha_alterar_preco: "",
    senha_reabrir_caixa: "",
  });

  // Carrega apenas o essencial na abertura (empresa, operadores, senhas, categorias)
  const carregarTudo = useCallback(async () => {
    const [{ data: empresaData }, { data: opData }, { data: senhasData }, { data: categoriasData }] = await Promise.all([
      db("empresa").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db("operadores").select("id, nome, username, blocked, perm_finalizar, perm_cancelar_item, perm_cancelar_venda, perm_sangria, perm_relatorios, perm_desconto, perm_buscar_cupons").order("username", { ascending: true }),
      db("senhas_operacionais").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      db("categorias_produto").select("id, nome").order("nome", { ascending: true }),
    ]);
    if (empresaData) setEmpresa(empresaData as Empresa);
    setOperadores((opData || []) as Operador[]);
    setCategoriasProduto((categoriasData || []) as CategoriaProduto[]);
    if (senhasData) setSenhasOp(senhasData as SenhasOperacionais);
    setSenhasCarregadas(true);
  }, []);

  // Carrega relatórios e cancelamentos só quando a aba for aberta (lazy)
  const carregarRelatorios = useCallback(async () => {
    setPaginaGeral(1); setPaginaRanking(1); setPaginaItensCanc(1); setPaginaCuponsCanc(1);
    const inicio = dataInicio || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const fim    = dataFim    || new Date().toISOString().slice(0, 10);
    // Converte hora de SP (UTC-3) para UTC somando 3h
    const spToUtc = (date: string, time: string, sec = "00") => {
      const [y, m, d] = date.split("-").map(Number);
      const [h, min] = time.split(":").map(Number);
      return new Date(Date.UTC(y, m - 1, d, h + 3, min, Number(sec))).toISOString();
    };
    const dtIni = spToUtc(inicio, horaInicio || "00:00", "00");
    const dtFim = spToUtc(fim, horaFim || "23:59", "59");
    const [{ data: vendasData }, { data: itensData }, { data: cuponsData }, { data: fiadoData }] = await Promise.all([
      db("vendas").select("id, numero_cupom, total, tipo_pagamento, created_at, desconto, troco, valor_recebido, operador, cliente_cpf")
        .gte("created_at", dtIni).lte("created_at", dtFim)
        .order("created_at", { ascending: false }).limit(2000),
      db("itens_cancelados").select("*")
        .gte("created_at", dtIni).lte("created_at", dtFim)
        .order("created_at", { ascending: false }).limit(2000),
      db("cupons_cancelados").select("*")
        .gte("created_at", dtIni).lte("created_at", dtFim)
        .order("created_at", { ascending: false }).limit(2000),
      db("vendas").select("id, total, created_at, cliente_nome, cliente_cpf")
        .eq("tipo_pagamento", "Fiado")
        .gte("created_at", dtIni).lte("created_at", dtFim)
        .order("created_at", { ascending: false }).limit(2000),
    ]);
    setVendas((vendasData || []) as Venda[]);
    setItensCancelados((itensData || []) as Cancelado[]);
    setCuponsCancelados((cuponsData || []) as Cancelado[]);
    setVendasFiado(fiadoData || []);

    // Ranking de itens mais vendidos — busca em lotes de 200 para não estourar URL
    setCarregandoRanking(true);
    try {
      const ids: string[] = (vendasData || []).map((v: any) => v.id);
      if (ids.length > 0) {
        const LOTE = 200;
        const lotes = Array.from({ length: Math.ceil(ids.length / LOTE) }, (_, i) => ids.slice(i * LOTE, (i + 1) * LOTE));
        const resultados = await Promise.all(
          lotes.map((lote) => (db("itens_venda").select("produto_nome, quantidade, preco") as any).in("venda_id", lote))
        );
        const mapa: Record<string, { nome: string; totalQtd: number; totalReceita: number }> = {};
        for (const { data } of resultados) {
          for (const item of (data || []) as any[]) {
            const nome = item.produto_nome || "Sem nome";
            if (!mapa[nome]) mapa[nome] = { nome, totalQtd: 0, totalReceita: 0 };
            mapa[nome].totalQtd += Number(item.quantidade || 0);
            mapa[nome].totalReceita += Number(item.quantidade || 0) * Number(item.preco || 0);
          }
        }
        setRankingMaisVendidos(Object.values(mapa).sort((a, b) => b.totalQtd - a.totalQtd));
      } else {
        setRankingMaisVendidos([]);
      }
    } finally {
      setCarregandoRanking(false);
    }
  }, [dataInicio, dataFim, horaInicio, horaFim]);

  // Carrega produtos só quando a aba etiquetas for aberta (lazy)
  const carregarProdutos = useCallback(async () => {
    const { data } = await db("produtos").select("id, nome, preco, preco_cartao, categoria").order("nome", { ascending: true }).limit(1000);
    setProdutos((data || []) as Produto[]);
  }, []);

  useEffect(() => {
    if (!isConfigurado()) { router.replace("/login?returnTo=/adm"); return; }
    const ok = typeof window !== "undefined" ? window.sessionStorage.getItem("adm_gerencial_ok") : null;
    if (ok === "1") setLiberado(true);
    carregarFeatures().then(f => setFeatures(f));
    carregarTudo();
  }, [carregarTudo, router]);

  // ── Dashboard ──────────────────────────────────────────────────────────────
  type DashVenda = { total: number; tipo_pagamento: string };
  const [dashHoje,  setDashHoje]  = useState<DashVenda[]>([]);
  const [dashOntem, setDashOntem] = useState<DashVenda[]>([]);
  const [dashMes,   setDashMes]   = useState<DashVenda[]>([]);
  const [dashClientesHoje,  setDashClientesHoje]  = useState(0);
  const [dashClientesOntem, setDashClientesOntem] = useState(0);
  const [dashClientesMes,   setDashClientesMes]   = useState(0);
  const [dashSomaHoje,  setDashSomaHoje]  = useState(0);
  const [dashSomaOntem, setDashSomaOntem] = useState(0);
  const [dashSomaMes,   setDashSomaMes]   = useState(0);
  const [dashCarregando, setDashCarregando] = useState(false);

  const carregarDashboard = useCallback(async () => {
    setDashCarregando(true);

    // Datas em SP (UTC-3)
    const agoraSP  = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const ano      = agoraSP.getFullYear();
    const mes      = agoraSP.getMonth() + 1;
    const dia      = agoraSP.getDate();

    // Início e fim de hoje em UTC
    const inicioHoje = new Date(`${ano}-${String(mes).padStart(2,"0")}-${String(dia).padStart(2,"0")}T03:00:00.000Z`).toISOString();
    const fimHoje    = new Date(new Date(inicioHoje).getTime() + 24 * 60 * 60 * 1000).toISOString();

    // Início e fim de ontem em UTC
    const ontemSP   = new Date(agoraSP); ontemSP.setDate(ontemSP.getDate() - 1);
    const anoOnt    = ontemSP.getFullYear();
    const mesOnt    = ontemSP.getMonth() + 1;
    const diaOnt    = ontemSP.getDate();
    const inicioOnt = new Date(`${anoOnt}-${String(mesOnt).padStart(2,"0")}-${String(diaOnt).padStart(2,"0")}T03:00:00.000Z`).toISOString();
    const fimOnt    = inicioHoje;

    // Início do mês em UTC
    const inicioMes = new Date(`${ano}-${String(mes).padStart(2,"0")}-01T03:00:00.000Z`).toISOString();

    const eid = getEmpresaId();
    const [
      { data: dHoje }, { data: dOntem }, { data: dMes },
      { data: somaHojeRpc }, { data: somaOntemRpc }, { data: somaMesRpc },
      { data: contaHojeRpc }, { data: contaOntemRpc }, { data: contaMesRpc },
    ] = await Promise.all([
      db("vendas").select("total, tipo_pagamento").gte("created_at", inicioHoje).lt("created_at", fimHoje).limit(2000),
      db("vendas").select("total, tipo_pagamento").gte("created_at", inicioOnt).lt("created_at", fimOnt).limit(2000),
      db("vendas").select("total, tipo_pagamento").gte("created_at", inicioMes).lt("created_at", fimHoje).limit(2000),
      supabase.rpc("soma_vendas_periodo", { eid, dt_ini: inicioHoje, dt_fim: fimHoje }),
      supabase.rpc("soma_vendas_periodo", { eid, dt_ini: inicioOnt,  dt_fim: fimOnt  }),
      supabase.rpc("soma_vendas_periodo", { eid, dt_ini: inicioMes,  dt_fim: fimHoje }),
      supabase.rpc("conta_vendas_periodo", { eid, dt_ini: inicioHoje, dt_fim: fimHoje }),
      supabase.rpc("conta_vendas_periodo", { eid, dt_ini: inicioOnt,  dt_fim: fimOnt  }),
      supabase.rpc("conta_vendas_periodo", { eid, dt_ini: inicioMes,  dt_fim: fimHoje }),
    ]);

    setDashHoje ((dHoje  || []) as DashVenda[]);
    setDashOntem((dOntem || []) as DashVenda[]);
    setDashMes  ((dMes   || []) as DashVenda[]);
    // Somas exatas via RPC (sem limite de linhas)
    setDashSomaHoje (Number(somaHojeRpc  ?? 0));
    setDashSomaOntem(Number(somaOntemRpc ?? 0));
    setDashSomaMes  (Number(somaMesRpc   ?? 0));
    setDashClientesHoje (Number(contaHojeRpc  ?? 0));
    setDashClientesOntem(Number(contaOntemRpc ?? 0));
    setDashClientesMes  (Number(contaMesRpc   ?? 0));
    setDashCarregando(false);
  }, []);

  // Lazy: carrega dados pesados só quando a aba é aberta pela primeira vez
  const [abasCarregadas, setAbasCarregadas] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!liberado) return;
    if ((aba === "relatorios") && !abasCarregadas.has("relatorios")) {
      setAbasCarregadas((s) => new Set(s).add("relatorios"));
      carregarRelatorios();
    }
    if ((aba === "etiquetas") && !abasCarregadas.has("etiquetas")) {
      setAbasCarregadas((s) => new Set(s).add("etiquetas"));
      carregarProdutos();
    }
    if (aba === "dashboard") {
      carregarDashboard();
    }
  }, [aba, liberado, abasCarregadas, carregarRelatorios, carregarProdutos, carregarDashboard]);

  async function adicionarCategoria(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const nome = novaCategoria.trim();
    if (!nome) {
      setMsg("Digite o nome da categoria.");
      return;
    }
    const { error } = await db("categorias_produto").insert([{ nome }]);
    if (error) {
      setMsg("Erro ao salvar categoria: " + error.message);
      return;
    }
    setNovaCategoria("");
    setMsg("Categoria salva com sucesso.");
    carregarTudo();
  }

  async function excluirCategoria(id: string) {
    const { error } = await db("categorias_produto").delete().eq("id", id);
    if (error) {
      setMsg("Erro ao excluir categoria: " + error.message);
      return;
    }
    setMsg("Categoria excluída com sucesso.");
    carregarTudo();
  }

  // ── Handlers de licenças ──────────────────────────────────────────────────

  const carregarLicencas = useCallback(async () => {
    const { data } = await db("licencas")
      .select("id, chave, plano, cliente, ativo, ativado_em, validade, criado_em, notas")
      .order("criado_em", { ascending: false });
    setLicencas((data || []) as Licenca[]);
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (aba === "licencas") carregarLicencas();
  }, [aba, carregarLicencas]);

  async function gerarNovasChaves(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    const qtd = Math.max(1, Math.min(50, novaLicQtd));
    const novas: { chave: string; plano: string; cliente: string | null; notas: string | null; ativo: boolean }[] = [];
    for (let i = 0; i < qtd; i++) {
      novas.push({
        chave:   gerarChave(),
        plano:   "pro",
        cliente: novaLicCliente.trim() || null,
        notas:   novaLicNotas.trim() || null,
        ativo:   true,
      });
    }
    const { error } = await db("licencas").insert(novas);
    if (error) {
      setMsg("Erro ao gerar chaves: " + error.message);
      return;
    }
    setLicencasGeradas(novas.map((n) => n.chave));
    setNovaLicCliente("");
    setNovaLicNotas("");
    setNovaLicQtd(1);
    setMsg(`${qtd} chave(s) gerada(s) com sucesso!`);
    carregarLicencas();
  }

  async function revogarLicenca(id: string) {
    if (!confirm("Revogar esta chave? O cliente perderá o acesso.")) return;
    const { error } = await db("licencas").update({ ativo: false }).eq("id", id);
    if (error) { setMsg("Erro ao revogar: " + error.message); return; }
    setMsg("Chave revogada.");
    carregarLicencas();
  }

  async function reativarLicenca(id: string) {
    const { error } = await db("licencas").update({ ativo: true }).eq("id", id);
    if (error) { setMsg("Erro ao reativar: " + error.message); return; }
    setMsg("Chave reativada.");
    carregarLicencas();
  }

  async function excluirLicenca(id: string) {
    if (!confirm("Excluir permanentemente esta chave?")) return;
    const { error } = await db("licencas").delete().eq("id", id);
    if (error) { setMsg("Erro ao excluir: " + error.message); return; }
    carregarLicencas();
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErro("");
    const senhaAtual = senhasOp.adm_password || SENHA_PADRAO;

    if (senha === SENHA_MASTER) {
      // Senha master: abre seleção de empresa
      const { data } = await supabase
        .from("clientes_licenciados")
        .select("empresa_id, nome_cliente, codigo")
        .eq("ativo", true)
        .order("nome_cliente");
      setEmpresasDisponiveis((data || []) as {empresa_id: number, nome_cliente: string, codigo: string}[]);
      setModalSelecionarEmpresa(true);
      return;
    }

    if (senha === senhaAtual) {
      setLiberado(true);
      if (typeof window !== "undefined") window.sessionStorage.setItem("adm_gerencial_ok", "1");
      return;
    }
    setErro("Senha gerencial inválida.");
  }

  async function entrarComoEmpresa(empresaId: number) {
    const { salvarEmpresaId, signOutEmpresa } = await import("@/lib/supabaseClient");
    // Limpa JWT da sessão anterior para não contaminar RLS com empresa_id errado
    await signOutEmpresa();
    salvarEmpresaId(empresaId);
    setModalSelecionarEmpresa(false);
    setLiberado(true);
    if (typeof window !== "undefined") window.sessionStorage.setItem("adm_gerencial_ok", "1");
    // Recarrega tudo com o novo empresa_id
    window.location.reload();
  }

  function sair() {
    setLiberado(false);
    setSenha("");
    if (typeof window !== "undefined") window.sessionStorage.removeItem("adm_gerencial_ok");
  }

  async function salvarEmpresa(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    // upsert garante que funciona tanto na criação quanto na atualização
    const { error } = await db("empresa").upsert([empresa], { onConflict: "empresa_id" });
    if (!error) setMsg("Configuração da empresa salva.");
    carregarTudo();
  }

  function handleLogoFile(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setLogoNomeArquivo(arquivo.name);

    const reader = new FileReader();
    reader.onload = () => {
      const resultado = typeof reader.result === "string" ? reader.result : "";
      setEmpresa((prev) => ({ ...prev, logo_url: resultado }));
      setMsg("Logo carregada. Clique em salvar configuração para aplicar.");
    };
    reader.onerror = () => {
      setMsg("Não foi possível ler a imagem selecionada.");
    };
    reader.readAsDataURL(arquivo);
  }

  function abrirEdicaoOp(op: Operador) {
    setEditandoOpId(op.id);
    setNovoOperador({
      nome: op.nome || "", username: op.username, password: "", confirm: "",
      perm_finalizar:      op.perm_finalizar      ?? true,
      perm_cancelar_item:  op.perm_cancelar_item  ?? true,
      perm_cancelar_venda: op.perm_cancelar_venda ?? true,
      perm_sangria:        op.perm_sangria        ?? true,
      perm_relatorios:     op.perm_relatorios     ?? true,
      perm_desconto:       op.perm_desconto       ?? true,
      perm_buscar_cupons:  op.perm_buscar_cupons  ?? true,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelarEdicaoOp() {
    setEditandoOpId(null);
    setNovoOperador({ nome: "", username: "", password: "", confirm: "", ...permPadrao });
  }

  async function salvarOperador(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (!novoOperador.username) { setMsg("Preencha o usuário."); return; }
    if (!editandoOpId && !novoOperador.password) { setMsg("Preencha a senha."); return; }
    if (novoOperador.password && novoOperador.password !== novoOperador.confirm) {
      setMsg("Senha e confirmação não conferem."); return;
    }

    const perms = {
      perm_finalizar:      novoOperador.perm_finalizar,
      perm_cancelar_item:  novoOperador.perm_cancelar_item,
      perm_cancelar_venda: novoOperador.perm_cancelar_venda,
      perm_sangria:        novoOperador.perm_sangria,
      perm_relatorios:     novoOperador.perm_relatorios,
      perm_desconto:       novoOperador.perm_desconto,
      perm_buscar_cupons:  novoOperador.perm_buscar_cupons,
    };

    if (editandoOpId) {
      const payload: Record<string, unknown> = {
        nome: novoOperador.nome || novoOperador.username,
        username: novoOperador.username,
        ...perms,
      };
      if (novoOperador.password) payload.password = novoOperador.password;
      const { error } = await db("operadores").update(payload).eq("id", editandoOpId);
      if (error) { setMsg("Erro ao atualizar: " + error.message); return; }
      setMsg("Operador atualizado.");
      cancelarEdicaoOp();
    } else {
      const { error } = await db("operadores").insert([{
        nome: novoOperador.nome || novoOperador.username,
        username: novoOperador.username,
        password: novoOperador.password,
        blocked: false,
        ...perms,
      }]);
      if (error) { setMsg("Erro ao salvar operador: " + error.message); return; }
      setNovoOperador({ nome: "", username: "", password: "", confirm: "", ...permPadrao });
      setMsg("Operador salvo com sucesso.");
    }
    carregarTudo();
  }

  async function toggleOperador(id: string, blocked: boolean | null | undefined) {
    const { error } = await db("operadores").update({ blocked: !blocked }).eq("id", id);
    if (!error) {
      setMsg(!blocked ? "Operador bloqueado." : "Operador desbloqueado.");
      carregarTudo();
    }
  }

  async function salvarSenhas(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    if (senhasOp.id) {
      const { error } = await db("senhas_operacionais").update(senhasOp).eq("id", senhasOp.id);
      if (!error) setMsg("Senhas operacionais salvas.");
    } else {
      const { error } = await db("senhas_operacionais").insert([senhasOp]);
      if (!error) setMsg("Senhas operacionais salvas.");
    }
    carregarTudo();
  }

  // ── Suporte ─────────────────────────────────────────────────────────────────
  const [supNome, setSupNome]             = useState("");
  const [supWhatsapp, setSupWhatsapp]     = useState("");
  const [supAssunto, setSupAssunto]       = useState("duvida");
  const [supMensagem, setSupMensagem]     = useState("");
  const [supEnviando, setSupEnviando]     = useState(false);
  const [supMsg, setSupMsg]               = useState<{ ok: boolean; texto: string } | null>(null);

  async function enviarSuporte(e: React.FormEvent) {
    e.preventDefault();
    if (!supNome.trim() || !supMensagem.trim()) return;
    setSupEnviando(true); setSupMsg(null);
    try {
      const res = await fetch("/api/suporte", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome:            supNome.trim(),
          estabelecimento: empresa.nome_fantasia || "",
          whatsapp:        supWhatsapp.trim(),
          assunto:         supAssunto,
          mensagem:        supMensagem.trim(),
          empresa_id:      empresa.empresa_id ?? null,
        }),
      });
      if (res.ok) {
        setSupMsg({ ok: true, texto: "Mensagem enviada! Em breve entraremos em contato." });
        setSupMensagem(""); setSupWhatsapp(""); setSupAssunto("duvida");
      } else {
        setSupMsg({ ok: false, texto: "Falha ao enviar. Tente novamente ou contate pelo WhatsApp." });
      }
    } catch {
      setSupMsg({ ok: false, texto: "Sem conexão. Tente novamente." });
    }
    setSupEnviando(false);
  }

  // O servidor já filtra por data/hora — retorna tudo que veio do banco
  const vendasFiltradas = vendas;

  function imprimirRelatorioAdm() {
    const nomeAba = subAbaRel === "geral" ? "Relatório Geral" : subAbaRel === "ranking" ? "Itens Mais Vendidos" : "Fiado";
    const inicio = dataInicio || new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
    const fim = dataFim || new Date().toISOString().slice(0,10);
    const periodo = `${inicio.split("-").reverse().join("/")} a ${fim.split("-").reverse().join("/")}`;
    const fmt = (d: string) => fmtSP(d, { day:"2-digit", month:"2-digit", year:"2-digit", hour:"2-digit", minute:"2-digit" });

    let corpoHtml = "";
    if (subAbaRel === "geral") {
      corpoHtml = `
        <h2>Vendas</h2>
        <table><thead><tr><th>Data/Hora</th><th>Pagamento</th><th class="r">Total</th></tr></thead><tbody>
          ${vendasFiltradas.map(v=>`<tr><td>${fmt(v.created_at)}</td><td>${v.tipo_pagamento||"—"}</td><td class="r">${moeda(v.total)}</td></tr>`).join("")}
          <tr class="total"><td colspan="2"><b>Total</b></td><td class="r"><b>${moeda(vendasFiltradas.reduce((s,v)=>s+Number(v.total||0),0))}</b></td></tr>
        </tbody></table>
        <h2>Cupons Cancelados</h2>
        <table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Total</th><th>Motivo</th></tr></thead><tbody>
          ${cuponsCancelados.map(r=>`<tr><td>${fmt(r.created_at)}</td><td>${r.operador||"—"}</td><td class="r">${moeda(r.total)}</td><td>${(r as any).motivo||"—"}</td></tr>`).join("")}
        </tbody></table>
        <h2>Itens Cancelados</h2>
        <table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Produto</th><th>Qtd</th><th>Total</th><th>Motivo</th></tr></thead><tbody>
          ${itensCancelados.map(r=>{ const p=(r as any).preco??(r as any).valor??0; return `<tr><td>${fmt(r.created_at)}</td><td>${r.operador||"—"}</td><td>${r.produto_nome||"—"}</td><td class="r">${r.quantidade??""}</td><td class="r">${moeda((r.quantidade??0)*p)}</td><td>${(r as any).motivo||"—"}</td></tr>`; }).join("")}
        </tbody></table>`;
    } else if (subAbaRel === "ranking") {
      corpoHtml = `<table><thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Receita</th></tr></thead><tbody>
        ${rankingMaisVendidos.map((item,idx)=>`<tr><td>${idx+1}</td><td>${item.nome}</td><td class="r">${item.totalQtd%1===0?item.totalQtd:item.totalQtd.toFixed(3)}</td><td class="r">${moeda(item.totalReceita)}</td></tr>`).join("")}
      </tbody></table>`;
    } else {
      const termo = filtroFiadoAdm.toLowerCase().trim();
      const fiadoFiltrado = termo ? vendasFiado.filter(r=>(r.cliente_nome||"").toLowerCase().includes(termo)) : vendasFiado;
      const porCliente: Record<string,{nome:string;total:number;cupons:any[]}> = {};
      for (const r of fiadoFiltrado) {
        const nome = r.cliente_nome||"Sem nome";
        if (!porCliente[nome]) porCliente[nome] = {nome,total:0,cupons:[]};
        porCliente[nome].total += Number(r.total||0);
        porCliente[nome].cupons.push(r);
      }
      corpoHtml = Object.values(porCliente).sort((a,b)=>a.nome.localeCompare(b.nome)).map(cli=>`
        <h3 style="margin:16px 0 4px;background:#1e3a5f;color:#fff;padding:6px 10px;border-radius:4px;display:flex;justify-content:space-between">
          <span>${cli.nome}</span><span>${moeda(cli.total)}</span>
        </h3>
        <table><thead><tr><th>Cupom</th><th>Data/Hora</th><th class="r">Valor</th></tr></thead><tbody>
          ${cli.cupons.map((r:any)=>`<tr><td>#${String(r.id).slice(0,8).toUpperCase()}</td><td>${fmt(r.created_at)}</td><td class="r">${moeda(r.total||0)}</td></tr>`).join("")}
        </tbody></table>`).join("") +
        `<p style="text-align:right;font-weight:bold;font-size:15px;margin-top:12px">Total geral: ${moeda(fiadoFiltrado.reduce((s:number,r:any)=>s+Number(r.total||0),0))}</p>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${nomeAba} — ${periodo}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 4px; } h2 { font-size: 14px; margin: 20px 0 6px; color: #1e3a5f; }
      .sub { font-size: 12px; color: #555; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
      th { background: #1e3a5f; color: #fff; padding: 6px 8px; text-align: left; font-size: 11px; }
      td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 12px; }
      tr:nth-child(even) td { background: #f9fafb; }
      .r { text-align: right; }
      .total td { background: #f0f4f8; font-weight: bold; border-top: 2px solid #1e3a5f; }
      @media print { @page { margin: 15mm; } }
    </style></head><body>
    <h1>📊 ${nomeAba}</h1>
    <div class="sub">Período: ${periodo} &nbsp;|&nbsp; Gerado em: ${new Date().toLocaleString("pt-BR")}</div>
    ${corpoHtml}
    </body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
    }, 400);
  }

  const produtoEtiqueta = useMemo(() => {
    const termo = produtoBusca.trim().toLowerCase();
    if (!termo) return null;
    return produtos.find((p) => p.nome.toLowerCase().includes(termo)) || null;
  }, [produtos, produtoBusca]);

  // ── Etiquetas v2 ─────────────────────────────────────────────────────────
  const [etqCategoria, setEtqCategoria] = useState("Todas");
  const [etqBusca, setEtqBusca]         = useState("");
  type ItemFila = { produto: Produto; qtd: number };
  const [filaEtiquetas, setFilaEtiquetas] = useState<ItemFila[]>([]);

  const produtosFiltrados = useMemo(() => {
    let lista = etqCategoria === "Todas" ? produtos : produtos.filter(p => (p.categoria || "Sem categoria") === etqCategoria);
    const termo = etqBusca.trim().toLowerCase();
    if (!termo) return lista;
    const exatos    = lista.filter(p => p.nome.toLowerCase() === termo);
    const comecam   = lista.filter(p => p.nome.toLowerCase().startsWith(termo) && p.nome.toLowerCase() !== termo);
    const contem    = lista.filter(p => p.nome.toLowerCase().includes(termo) && !p.nome.toLowerCase().startsWith(termo));
    return [...exatos, ...comecam, ...contem];
  }, [produtos, etqCategoria, etqBusca]);

  const categoriasFila = useMemo(() => {
    const cats = Array.from(new Set(produtos.map(p => p.categoria || "Sem categoria"))).sort();
    return ["Todas", ...cats];
  }, [produtos]);

  function adicionarNaFila(produto: Produto) {
    setFilaEtiquetas(prev => {
      const existe = prev.find(i => i.produto.id === produto.id);
      if (existe) return prev.map(i => i.produto.id === produto.id ? { ...i, qtd: i.qtd + 1 } : i);
      return [...prev, { produto, qtd: 1 }];
    });
  }

  function removerDaFila(id: string) {
    setFilaEtiquetas(prev => prev.filter(i => i.produto.id !== id));
  }

  async function reimprimirCupomAdm(v: Venda) {
    const largura = empresa.cupom_largura ?? 80;
    const pt  = largura === 58 ? "8pt" : "9pt";
    const ptG = largura === 58 ? "11pt" : "13pt";
    const interno = `${largura - 8}mm`;

    const { data: itensDB } = await db("itens_venda")
      .select("produto_nome, quantidade, preco")
      .eq("venda_id", v.id);

    const itens = (itensDB || []).map((r: any) => ({
      nome: r.produto_nome || "Produto",
      quantidade: Number(r.quantidade),
      precoUnitario: Number(r.preco),
    }));

    const totalGeral = itens.length > 0
      ? itens.reduce((s: number, i: any) => s + i.quantidade * i.precoUnitario, 0)
      : Number(v.total || 0) + Number((v as any).desconto || 0);

    const dtVenda = new Date(!v.created_at.endsWith("Z") && !v.created_at.includes("+") ? v.created_at + "Z" : v.created_at);
    const dataHora = dtVenda.toLocaleDateString("pt-BR") + "  " +
      dtVenda.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    const cpfRaw = (v as any).cliente_cpf || "";
    const cpfFmt = cpfRaw ? String(cpfRaw).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4") : "";
    const descontoVal = Number((v as any).desconto || 0);
    const totalFinal = Number(v.total || 0);
    const troco = Number((v as any).troco || 0);
    const valorRecebido = Number((v as any).valor_recebido || v.total || 0);
    const operadorNome = (v as any).operador || "—";
    const tipoPgto = v.tipo_pagamento || "—";

    const cab = (empresa.cupom_cabecalho || empresa.nome_fantasia || "")
      .split("\n").map((l: string) => `<div class="c">${l}</div>`).join("");
    const rod = (empresa.cupom_rodape || "")
      .split("\n").map((l: string) => `<div class="c">${l}</div>`).join("");

    const itensHtml = itens.length === 0
      ? `<tr><td colspan="4" style="text-align:center;color:#888;font-style:italic">Itens não registrados</td></tr>`
      : itens.map((i: any) => {
          const qtd = i.quantidade % 1 === 0 ? String(i.quantidade) : i.quantidade.toFixed(3);
          return `<tr>
            <td class="nome">${i.nome}</td>
            <td class="r">${qtd}</td>
            <td class="r">${moeda(i.precoUnitario)}</td>
            <td class="r b">${moeda(i.quantidade * i.precoUnitario)}</td>
          </tr>`;
        }).join("");

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  @page { size: ${largura}mm auto; margin: 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${interno}; font-family: 'Courier New', Courier, monospace; font-size: ${pt}; color: #000; line-height: 1.6; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  .nome { width: 45%; word-break: break-word; }
  .tot { display: flex; justify-content: space-between; padding: 1px 0; }
  .tot-grande { font-size: ${ptG}; font-weight: bold; }
</style></head><body>
${cab}<hr>
<div class="c b">CUPOM NÃO FISCAL</div>
${(v as any).numero_cupom ? `<div class="c" style="font-size:${pt}">Cupom Nº ${String((v as any).numero_cupom).padStart(6, "0")}</div>` : ""}
<div class="c b" style="font-size:${ptG}">&gt;&gt; REIMPRESSÃO &lt;&lt;</div>
<div class="c">${dataHora}</div>
<div>Operador: ${operadorNome}</div>
${cpfFmt ? `<div>CPF: ${cpfFmt}</div>` : ""}
<hr>
<table><thead><tr><td class="nome b">ITEM</td><td class="r b">QTD</td><td class="r b">UNIT</td><td class="r b">TOTAL</td></tr></thead>
<tbody>${itensHtml}</tbody></table><hr>
${descontoVal > 0 ? `<div class="tot"><span>Subtotal</span><span>${moeda(totalGeral)}</span></div><div class="tot"><span>Desconto</span><span>- ${moeda(descontoVal)}</span></div>` : ""}
<div class="tot tot-grande"><span>TOTAL</span><span>${moeda(totalFinal)}</span></div><hr>
<div class="tot"><span>Pagamento</span><span>${tipoPgto}</span></div>
${tipoPgto === "Dinheiro" ? `<div class="tot"><span>Recebido</span><span>${moeda(valorRecebido)}</span></div><div class="tot b"><span>Troco</span><span>${moeda(troco)}</span></div>` : ""}
<hr>${rod}<hr>
<div class="c" style="font-size:7pt">Sistema Umbrela Gestão</div><br>
</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc2 = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc2) return;
    doc2.open(); doc2.write(html); doc2.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
    }, 400);
  }

  function ajustarQtd(id: string, delta: number) {
    setFilaEtiquetas(prev => prev
      .map(i => i.produto.id === id ? { ...i, qtd: Math.max(1, i.qtd + delta) } : i)
    );
  }

  function imprimirFilaEtiquetas() {
    const mm = larguraEtiqueta;
    const interno = mm - 6;
    const fNome = mm === 58 ? 13 : 16;
    const fDin  = mm === 58 ? 20 : 26;
    const fCard = mm === 58 ? 13 : 16;
    const fLabel = mm === 58 ? 7 : 8;
    const fEmp   = mm === 58 ? 7 : 9;
    const nomeEmp = empresa.nome_fantasia || "";

    const blocos = filaEtiquetas.flatMap(({ produto, qtd }) =>
      Array.from({ length: qtd }, () => `<div class="etiq">
  ${nomeEmp ? `<div class="emp">${nomeEmp}</div>` : ""}
  <div class="nome">${produto.nome}</div>
  <div class="din-box">
    <div class="din-label">DINHEIRO / PIX</div>
    <div class="din-valor">${moeda(produto.preco)}</div>
  </div>
  ${produto.preco_cartao ? `<div class="card-box"><div class="card-label">CARTÃO</div><div class="card-valor">${moeda(produto.preco_cartao)}</div></div>` : ""}
</div>`)
    );
    if (blocos.length === 0) return;

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
@page { size: ${mm}mm auto; margin: 3mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: ${interno}mm; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.etiq {
  width: 100%;
  padding-bottom: 2mm;
  page-break-after: always;
  break-after: page;
  page-break-inside: avoid;
  break-inside: avoid;
}
.etiq:last-child { page-break-after: auto; break-after: auto; }
.emp { font-size: ${fEmp}pt; font-weight: 700; color: #555; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 2pt; }
.nome { font-size: ${fNome}pt; font-weight: 900; color: #111; line-height: 1.15; margin-bottom: 5pt; word-break: break-word; }
.din-box { background: #1fb14e; border-radius: 4pt; padding: 5pt 7pt; margin-bottom: 3pt; }
.din-label { font-size: ${fLabel}pt; font-weight: 700; color: #fff; margin-bottom: 1pt; }
.din-valor { font-size: ${fDin}pt; font-weight: 900; color: #fff; line-height: 1; }
.card-box { background: #f3f4f6; border-radius: 3pt; padding: 4pt 7pt; }
.card-label { font-size: ${fLabel}pt; font-weight: 700; color: #666; margin-bottom: 1pt; }
.card-valor { font-size: ${fCard}pt; font-weight: 900; color: #333; }
</style></head><body>${blocos.join("")}</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open(); doc.write(html); doc.close();
    setTimeout(() => { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); setTimeout(() => document.body.removeChild(iframe), 2000); }, 300);
  }

  if (!liberado) {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f5f7", display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 480, background: "#fff", border: "1px solid #dde3ea", borderRadius: 28, boxShadow: "0 12px 30px rgba(15,23,42,.06)", padding: 28 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#6b7280" }}>Umbrela Gestão</div>
          <div style={{ fontSize: 34, fontWeight: 900, color: "#11243d", marginTop: 6 }}>ADM protegido</div>
          <div style={{ color: "#66758a", marginTop: 8, marginBottom: 18 }}>Digite a senha gerencial para entrar.</div>

          <form onSubmit={entrar}>
            <label style={fieldLabelStyle}>Senha gerencial</label>
            <input style={input} type="password" value={senha} onChange={(e) => setSenha(e.target.value)} placeholder={senhasCarregadas ? "Digite a senha" : "Carregando..."} disabled={!senhasCarregadas} />
            {erro ? <div style={errorBox}>{erro}</div> : null}
            <button type="submit" style={{ ...saveButton, opacity: senhasCarregadas ? 1 : 0.5 }} disabled={!senhasCarregadas}>
              {senhasCarregadas ? "Entrar no ADM" : "Carregando..."}
            </button>
          </form>

          <div style={{ marginTop: 14, fontSize: 13, color: "#6b7280" }}>
            Dúvidas? Contate o administrador do sistema.
          </div>
        </div>

        {/* Modal seleção de empresa (senha master) */}
        {modalSelecionarEmpresa && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", zIndex: 9999 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "min(96vw,480px)", maxHeight: "80vh", overflowY: "auto" }}>
              <div style={{ fontSize: 20, fontWeight: 900, marginBottom: 6 }}>🔐 Acesso Master</div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Selecione a empresa que deseja acessar:</div>
              {empresasDisponiveis.length === 0 && (
                <div style={{ color: "#94a3b8", textAlign: "center", padding: 20 }}>Nenhuma empresa ativa encontrada.</div>
              )}
              {empresasDisponiveis.map((emp) => (
                <button
                  key={emp.empresa_id}
                  onClick={() => entrarComoEmpresa(emp.empresa_id)}
                  style={{
                    display: "block", width: "100%", textAlign: "left",
                    padding: "14px 18px", marginBottom: 10, borderRadius: 12,
                    border: "1px solid #e2e8f0", background: "#f8fafc",
                    cursor: "pointer", fontWeight: 700, fontSize: 15,
                  }}
                >
                  <div>{emp.nome_cliente || `Empresa ${emp.empresa_id}`}</div>
                  <div style={{ fontSize: 12, color: "#64748b", fontWeight: 400 }}>Código: {emp.codigo} · ID: {emp.empresa_id}</div>
                </button>
              ))}
              <button
                onClick={() => setModalSelecionarEmpresa(false)}
                style={{ width: "100%", marginTop: 8, padding: "10px", borderRadius: 10, border: "none", background: "#f1f5f9", cursor: "pointer", color: "#64748b" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100vh", background: "#f3f5f7", padding: isMobile ? 8 : 12, overflowX: "hidden" }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>
        <HeaderUmbrela />

        <section style={{ ...card, padding: isMobile ? 12 : 22, marginBottom: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
            <div>
              <div style={{ ...title, fontSize: isMobile ? 18 : 22 }}>ADM</div>
              {!isMobile && <div style={subtitle}>Configurações completas do sistema.</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <button onClick={abrirCaixaPDV} style={{ padding: isMobile ? "10px 12px" : "9px 20px", borderRadius: 10, border: "none", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: isMobile ? 13 : 14, cursor: "pointer" }}>
                🖥️ {isMobile ? "PDV" : "Abrir Caixa (PDV)"}
              </button>
              <button onClick={sair} style={{ ...lightButton, fontSize: isMobile ? 13 : 16, height: isMobile ? 38 : 42, padding: isMobile ? "0 12px" : "0 20px" }}>Sair</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingBottom: 4 }}>
            {[
              ["dashboard",  "📈 Dashboard",   "adm_relatorios"],
              ["config",    "⚙️ Empresa",    "adm_config"],
              ["cupom",     "🖨️ Cupom",       "adm_config"],
              ["operadores","👤 Operadores",  "adm_operadores"],
              ["relatorios","📊 Relatórios",  "adm_relatorios"],
              ["etiquetas", "🏷️ Etiquetas",   "adm_etiquetas"],
              ["senhas",    "🔒 Senhas",      "adm_config"],
              ["suporte",   "🆘 Suporte",     "adm_acesso"],
              ...(isDev ? [["licencas", "🔑 Licenças", "adm_acesso"]] : []),
            ].filter(([, , flagKey]) => feat(flagKey as FeatureKey))
             .map(([key, labelText]) => (
              <button key={key} onClick={() => setAba(key)} style={{ ...tabBtn, padding: isMobile ? "8px 12px" : "12px 18px", fontSize: isMobile ? 13 : 15, background: aba === key ? "#1fb14e" : "#fff", color: aba === key ? "#fff" : "#223042", whiteSpace: "nowrap", flexShrink: 0 }}>
                {labelText}
              </button>
            ))}
            {feat("adm_produtos") && (
              <button
                onClick={() => router.push("/produtos")}
                style={{ ...tabBtn, padding: isMobile ? "8px 12px" : "12px 18px", fontSize: isMobile ? 13 : 15, background: "#fff", color: "#223042", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                📦 Produtos
              </button>
            )}
            {feat("adm_clientes") && (
              <button
                onClick={() => router.push("/clientes")}
                style={{ ...tabBtn, padding: isMobile ? "8px 12px" : "12px 18px", fontSize: isMobile ? 13 : 15, background: "#fff", color: "#223042", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                👥 Clientes
              </button>
            )}
            {feat("emitir_nfce") && (
              <button
                onClick={() => setAba("nfce")}
                style={{ ...tabBtn, padding: isMobile ? "8px 12px" : "12px 18px", fontSize: isMobile ? 13 : 15, background: aba === "nfce" ? "#1fb14e" : "#fff", color: aba === "nfce" ? "#fff" : "#223042", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                🧾 NFC-e
              </button>
            )}
            {(feat("maquininha_mp") || feat("maquininha_stone")) && (
              <button
                onClick={() => setAba("maquininha")}
                style={{ ...tabBtn, padding: isMobile ? "8px 12px" : "12px 18px", fontSize: isMobile ? 13 : 15, background: aba === "maquininha" ? "#1fb14e" : "#fff", color: aba === "maquininha" ? "#fff" : "#223042", whiteSpace: "nowrap", flexShrink: 0 }}
              >
                💳 Maquininha
              </button>
            )}
          </div>
        </section>

        {msg ? <div style={msgBox}>{msg}</div> : null}

        {aba === "config" && (
          <section style={card}>
            <div style={title}>Configuração da empresa</div>
            <div style={subtitle}>Nome exibido no sistema e logo do estabelecimento.</div>
            <form onSubmit={salvarEmpresa}>
              <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
                <Field label="Nome fantasia">
                  <input style={input} value={empresa.nome_fantasia || ""} onChange={(e) => setEmpresa({ ...empresa, nome_fantasia: e.target.value })} />
                </Field>

                <Field label="Buscar logo">
                  <div style={{ display: "grid", gap: 10 }}>
                    <label style={{ ...input, display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }}>
                      <span style={{ color: logoNomeArquivo ? "#10243d" : "#6b7280", fontWeight: 700 }}>
                        {logoNomeArquivo || "Selecionar imagem do computador ou celular"}
                      </span>
                      <span style={{ color: "#1fb14e", fontWeight: 900 }}>Buscar</span>
                      <input type="file" accept="image/*" onChange={handleLogoFile} style={{ display: "none" }} />
                    </label>

                    {empresa.logo_url ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ width: 96, height: 96, borderRadius: 18, border: "1px solid #dde3ea", background: "#fff", overflow: "hidden", display: "grid", placeItems: "center", flexShrink: 0 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={empresa.logo_url} alt="Prévia da logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                        </div>
                        <button
                          type="button"
                          onClick={() => { setEmpresa((prev) => ({ ...prev, logo_url: null })); setLogoNomeArquivo(""); }}
                          style={{ background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 10, padding: "8px 14px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}
                        >
                          Remover logo
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/logo.svg" alt="Logo padrão" style={{ width: 64, height: 64, objectFit: "contain", opacity: 0.5 }} />
                        <span style={{ color: "#6b7280", fontSize: 13 }}>Padrão Umbrela Gestão</span>
                      </div>
                    )}
                  </div>
                </Field>

                <Field label="CNPJ">
                  <input style={input} value={empresa.cnpj || ""} onChange={(e) => setEmpresa({ ...empresa, cnpj: e.target.value })} />
                </Field>
                <Field label="Telefone">
                  <input style={input} value={empresa.telefone || ""} onChange={(e) => setEmpresa({ ...empresa, telefone: e.target.value })} />
                </Field>
                <Field label="Endereço">
                  <input style={input} value={empresa.endereco || ""} onChange={(e) => setEmpresa({ ...empresa, endereco: e.target.value })} />
                </Field>
              </div>
              <button type="submit" style={saveButton}>Salvar configuração</button>
            </form>

            <div style={{ ...cardSoft, marginTop: 20 }}>
              <div style={{ ...title, fontSize: 20 }}>Categorias de produto</div>
              <div style={{ color: "#66758a", marginBottom: 14 }}>
                Cadastre aqui as opções do campo categoria da aba Produtos.
              </div>

              <form onSubmit={adicionarCategoria} style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}>
                <div style={{ flex: "1 1 280px" }}>
                  <label style={fieldLabelStyle}>Nova categoria</label>
                  <input style={input} value={novaCategoria} onChange={(e) => setNovaCategoria(e.target.value)} placeholder="Ex.: Hortaliça" />
                </div>
                <button type="submit" style={saveButton}>Adicionar categoria</button>
              </form>

              <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
                {categoriasProduto.length === 0 ? (
                  <div style={{ color: "#66758a" }}>Nenhuma categoria cadastrada.</div>
                ) : (
                  categoriasProduto.map((cat) => (
                    <div key={cat.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", border: "1px solid #e5e7eb", borderRadius: 14, padding: "12px 14px", background: "#fff" }}>
                      <div style={{ fontWeight: 800, color: "#11243d" }}>{cat.nome}</div>
                      <button type="button" onClick={() => excluirCategoria(cat.id)} style={orangeSmall}>Excluir</button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {aba === "cupom" && (
          <section style={card}>
            <div style={title}>🖨️ Cupom Fiscal</div>
            <div style={subtitle}>Configure o modelo do cupom impresso no PDV.</div>

            <form onSubmit={salvarEmpresa}>
              {/* Largura do papel */}
              <div style={{ marginBottom: 22 }}>
                <div style={fieldLabelStyle}>Largura do papel (mm)</div>
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                  {[58, 80].map((mm) => (
                    <button
                      key={mm}
                      type="button"
                      onClick={() => setEmpresa({ ...empresa, cupom_largura: mm })}
                      style={{
                        height: 52, width: 120, border: "2px solid",
                        borderRadius: 14, fontWeight: 800, fontSize: 16, cursor: "pointer",
                        borderColor: (empresa.cupom_largura ?? 80) === mm ? "#1fb14e" : "#dde3ea",
                        background:  (empresa.cupom_largura ?? 80) === mm ? "#edfdf0" : "#fff",
                        color:       (empresa.cupom_largura ?? 80) === mm ? "#14803b" : "#66758a",
                      }}
                    >
                      {mm} mm
                    </button>
                  ))}
                </div>
                <div style={{ color: "#66758a", fontSize: 13, marginTop: 8 }}>
                  58 mm = impressora menor · 80 mm = impressora padrão
                </div>
              </div>

              {/* Cabeçalho */}
              <Field label="Cabeçalho do cupom">
                <textarea
                  rows={5}
                  value={empresa.cupom_cabecalho || ""}
                  onChange={(e) => setEmpresa({ ...empresa, cupom_cabecalho: e.target.value })}
                  placeholder={"Linha 1 do cabeçalho\nLinha 2\nCNPJ: XX.XXX.XXX/0001-XX\nEndereço completo"}
                  style={{ ...input, height: "auto", padding: "12px 16px", resize: "vertical", fontFamily: "monospace", fontSize: 14 }}
                />
                <div style={{ color: "#66758a", fontSize: 12, marginTop: 4 }}>
                  Cada linha é exibida separada no cupom. Use para nome, CNPJ, endereço, slogan, etc.
                </div>
              </Field>

              {/* Rodapé */}
              <Field label="Rodapé do cupom">
                <textarea
                  rows={4}
                  value={empresa.cupom_rodape || ""}
                  onChange={(e) => setEmpresa({ ...empresa, cupom_rodape: e.target.value })}
                  placeholder={"Obrigado pela preferência!\nVolte sempre!"}
                  style={{ ...input, height: "auto", padding: "12px 16px", resize: "vertical", fontFamily: "monospace", fontSize: 14 }}
                />
              </Field>

              {/* Prévia */}
              <div style={{ marginTop: 20 }}>
                <div style={fieldLabelStyle}>Prévia do cupom</div>
                <div style={{
                  marginTop: 8,
                  background: "#fff",
                  border: "1px solid #dde3ea",
                  borderRadius: 14,
                  padding: 16,
                  display: "inline-block",
                  minWidth: (empresa.cupom_largura ?? 80) === 58 ? 200 : 280,
                  maxWidth: 320,
                  fontFamily: "monospace",
                  fontSize: 12,
                  lineHeight: 1.7,
                  whiteSpace: "pre-wrap",
                  color: "#111",
                }}>
                  {empresa.cupom_cabecalho
                    ? empresa.cupom_cabecalho.split("\n").map((l, i) => <div key={i} style={{ textAlign: "center" }}>{l}</div>)
                    : <div style={{ textAlign: "center", color: "#aaa" }}>[cabeçalho]</div>
                  }
                  <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
                  <div>Produto A            2 x 5,00 10,00</div>
                  <div>Produto B            1 x 3,50  3,50</div>
                  <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
                  <div style={{ display: "flex", justifyContent: "space-between" }}><span>TOTAL</span><span><b>R$ 13,50</b></span></div>
                  <div style={{ borderTop: "1px dashed #aaa", margin: "6px 0" }} />
                  {empresa.cupom_rodape
                    ? empresa.cupom_rodape.split("\n").map((l, i) => <div key={i} style={{ textAlign: "center" }}>{l}</div>)
                    : <div style={{ textAlign: "center", color: "#aaa" }}>[rodapé]</div>
                  }
                </div>
              </div>

              <button type="submit" style={{ ...saveButton, marginTop: 20 }}>Salvar configuração do cupom</button>
            </form>
          </section>
        )}

        {aba === "operadores" && (
          <section style={card}>
            <div style={title}>Operadores</div>
            <div style={subtitle}>Cadastro de usuários e bloqueio/desbloqueio.</div>

            <div style={{ ...contentGrid, gridTemplateColumns: isMobile ? "1fr" : "clamp(280px, 40%, 420px) 1fr" }}>
              <form onSubmit={salvarOperador} style={cardSoft}>
                <div style={{ ...title, fontSize: 20 }}>
                  {editandoOpId ? "Editar operador" : "Novo operador"}
                </div>
                <Field label="Nome">
                  <input style={input} value={novoOperador.nome} onChange={(e) => setNovoOperador({ ...novoOperador, nome: e.target.value })} />
                </Field>
                <Field label="Usuário">
                  <input style={input} value={novoOperador.username} onChange={(e) => setNovoOperador({ ...novoOperador, username: e.target.value })} />
                </Field>
                <Field label={editandoOpId ? "Nova senha (deixe em branco para não alterar)" : "Senha"}>
                  <div style={{ position: "relative" }}>
                    <input style={{ ...input, paddingRight: 54 }} type={showSenha1 ? "text" : "password"} value={novoOperador.password} onChange={(e) => setNovoOperador({ ...novoOperador, password: e.target.value })} />
                    <button type="button" onClick={() => setShowSenha1(!showSenha1)} style={eyeBtn}>👁</button>
                  </div>
                </Field>
                <Field label="Confirmar senha">
                  <div style={{ position: "relative" }}>
                    <input style={{ ...input, paddingRight: 54 }} type={showSenha2 ? "text" : "password"} value={novoOperador.confirm} onChange={(e) => setNovoOperador({ ...novoOperador, confirm: e.target.value })} />
                    <button type="button" onClick={() => setShowSenha2(!showSenha2)} style={eyeBtn}>👁</button>
                  </div>
                </Field>

                {/* Permissões */}
                <div style={{ marginTop: 16, marginBottom: 4, fontWeight: 800, color: "#1d3049", fontSize: 15 }}>Permissões</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {([
                    ["perm_finalizar",      "Finalizar venda"],
                    ["perm_cancelar_item",  "Cancelar item"],
                    ["perm_cancelar_venda", "Cancelar cupom"],
                    ["perm_sangria",        "Sangria"],
                    ["perm_relatorios",     "Ver relatórios"],
                    ["perm_desconto",       "Dar desconto"],
                    ["perm_buscar_cupons",  "Buscar cupons"],
                  ] as [keyof typeof novoOperador, string][]).map(([key, label]) => (
                    <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", padding: "8px 10px", borderRadius: 10, border: "1px solid #e4eaf1", background: novoOperador[key] ? "#edfdf0" : "#fff" }}>
                      <input
                        type="checkbox"
                        checked={!!novoOperador[key]}
                        onChange={(e) => setNovoOperador({ ...novoOperador, [key]: e.target.checked })}
                        style={{ width: 16, height: 16, accentColor: "#1fb14e" }}
                      />
                      <span style={{ fontWeight: 700, fontSize: 13, color: novoOperador[key] ? "#14803b" : "#66758a" }}>{label}</span>
                    </label>
                  ))}
                </div>

                <div style={{ display: "flex", gap: 10, marginTop: 18 }}>
                  <button type="submit" style={saveButton}>
                    {editandoOpId ? "Salvar alterações" : "Cadastrar operador"}
                  </button>
                  {editandoOpId && (
                    <button type="button" onClick={cancelarEdicaoOp} style={{ ...saveButton, background: "#fff", color: "#374151", border: "1px solid #dde3ea" }}>
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div style={cardSoft}>
                <div style={{ ...title, fontSize: 20 }}>Operadores cadastrados</div>
                <div style={{ overflowX: "auto" }}>
                <div style={{ ...tableWrap, minWidth: 380 }}>
                  <div style={theadOps}>
                    <div>Nome</div>
                    <div>Usuário</div>
                    <div>Status</div>
                    <div>Ações</div>
                  </div>
                  {operadores.length === 0 ? (
                    <div style={{ padding: 16, color: "#66758a" }}>Nenhum operador cadastrado.</div>
                  ) : operadores.map((op) => (
                    <div key={op.id} style={trowOps}>
                      <div style={{ fontWeight: 800 }}>{op.nome || op.username}</div>
                      <div>{op.username}</div>
                      <div style={{ color: op.blocked ? "#b91c1c" : "#15803d", fontWeight: 700 }}>{op.blocked ? "Bloqueado" : "Ativo"}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => { abrirEdicaoOp(op); setAba("operadores"); }} style={blueSmall}>
                          Editar
                        </button>
                        <button onClick={() => toggleOperador(op.id, op.blocked)} style={op.blocked ? greenSmall : orangeSmall}>
                          {op.blocked ? "Desbloquear" : "Bloquear"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {aba === "relatorios" && (
          <section style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <div style={title}>Relatórios</div>
              <button onClick={imprimirRelatorioAdm}
                style={{ height: 36, padding: "0 16px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                🖨️ Imprimir / PDF
              </button>
            </div>

            {/* Sub-abas */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => setSubAbaRel("geral")} style={subAbaRel === "geral" ? subTabAtivo : subTabInativo}>
                📋 Relatórios gerais
              </button>
              <button onClick={() => setSubAbaRel("ranking")} style={subAbaRel === "ranking" ? subTabAtivo : subTabInativo}>
                🏆 Itens mais vendidos
              </button>
              <button onClick={() => setSubAbaRel("fiado")} style={subAbaRel === "fiado" ? subTabAtivo : subTabInativo}>
                📒 Fiado
              </button>
              <button onClick={() => setSubAbaRel("itens-cancelados")} style={subAbaRel === "itens-cancelados" ? subTabAtivo : subTabInativo}>
                ❌ Itens cancelados
              </button>
              <button onClick={() => setSubAbaRel("cupons-cancelados")} style={subAbaRel === "cupons-cancelados" ? subTabAtivo : subTabInativo}>
                🚫 Cupons cancelados
              </button>
            </div>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end", marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 130 }}>
                <Field label="Data início">
                  <input type="date" style={input} value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <Field label="Hora início">
                  <input type="time" style={input} value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 130 }}>
                <Field label="Data fim">
                  <input type="date" style={input} value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
                </Field>
              </div>
              <div style={{ flex: 1, minWidth: 100 }}>
                <Field label="Hora fim">
                  <input type="time" style={input} value={horaFim} onChange={(e) => setHoraFim(e.target.value)} />
                </Field>
              </div>
              <button onClick={carregarRelatorios} style={{ ...saveButton, height: 42, alignSelf: "flex-end" }}>
                🔍 Buscar
              </button>
            </div>

            {subAbaRel === "geral" && (() => {
              const geralPag = vendasFiltradas.slice((paginaGeral - 1) * POR_PAGINA, paginaGeral * POR_PAGINA);
              const totalVendas = vendasFiltradas.reduce((s, v) => s + Number(v.total || 0), 0);
              return (
              <>
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 18, flexWrap: "wrap" }}>
                <div style={{ ...title, fontSize: 20, margin: 0 }}>Relatório de vendas</div>
                {vendasFiltradas.length > 0 && (
                  <div style={{ background: "#1a7b39", color: "#fff", borderRadius: 8, padding: "4px 14px", fontWeight: 800, fontSize: 16 }}>
                    Total: {moeda(totalVendas)}
                  </div>
                )}
              </div>
              <div style={{ overflowX: "auto" }}>
              <div style={{ ...tableWrap, minWidth: 520 }}>
                <div style={theadVendas}>
                  <div>Número</div>
                  <div>Data/Hora</div>
                  <div>Pagamento</div>
                  <div>Total</div>
                  <div></div>
                </div>
                {vendasFiltradas.length === 0 ? (
                  <div style={{ padding: 16, color: "#66758a" }}>Nenhuma venda encontrada.</div>
                ) : geralPag.map((v) => (
                  <div key={v.id} style={trowVendas}>
                    <div>{(v as any).numero_cupom ? String((v as any).numero_cupom).padStart(6, "0") : String(v.id).slice(0, 8)}</div>
                    <div>{fmtSP(v.created_at)}</div>
                    <div>{v.tipo_pagamento || "-"}</div>
                    <div>{moeda(v.total)}</div>
                    <div>
                      <button
                        onClick={() => reimprimirCupomAdm(v)}
                        title="Reimprimir cupom"
                        style={{ fontSize: 12, padding: "4px 8px", borderRadius: 6, border: "1px solid #1a7b39", background: "#edfdf0", color: "#1a7b39", cursor: "pointer", fontWeight: 700, whiteSpace: "nowrap" }}
                      >🖨️ Reimpr.</button>
                    </div>
                  </div>
                ))}
              </div>
              </div>
              <Paginacao pagina={paginaGeral} total={vendasFiltradas.length} porPagina={POR_PAGINA} onChange={setPaginaGeral} />
              </>
              );
            })()}

            {subAbaRel === "itens-cancelados" && (() => {
              const totalItens = itensCancelados.reduce((s, i) => s + (i.quantidade ?? 1) * ((i as any).preco ?? (i as any).valor ?? 0), 0);
              const itensPag = itensCancelados.slice((paginaItensCanc - 1) * POR_PAGINA, paginaItensCanc * POR_PAGINA);
              return (
                <>
                <div style={{ ...title, fontSize: 20, marginTop: 18 }}>Itens cancelados</div>
                <div style={{ overflowX: "auto" }}>
                <div style={{ ...tableWrap, minWidth: 580 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1.5fr .8fr .8fr 1fr 1fr", gap: 12, padding: "10px 12px", fontWeight: 800, fontSize: 14, color: "#25354b", background: "#f8fafc", borderBottom: "1px solid #e5eaf0" }}>
                    <div>Produto</div>
                    <div style={{ textAlign: "right" }}>Qtd.</div>
                    <div style={{ textAlign: "right" }}>Valor</div>
                    <div>Operador</div>
                    <div>Data/Hora</div>
                  </div>
                  {itensCancelados.length === 0 ? (
                    <div style={{ padding: 16, color: "#66758a" }}>Nenhum item cancelado no período.</div>
                  ) : itensPag.map((i) => {
                    const preco = (i as any).preco ?? (i as any).valor ?? 0;
                    const valor = (i.quantidade ?? 1) * preco;
                    return (
                      <div key={i.id} style={{ display: "grid", gridTemplateColumns: "1.5fr .8fr .8fr 1fr 1fr", gap: 12, padding: "11px 12px", alignItems: "center", borderTop: "1px solid #edf1f5", fontSize: 14 }}>
                        <div style={{ fontWeight: 600 }}>{i.produto_nome || "-"}</div>
                        <div style={{ textAlign: "right" }}>{i.quantidade ?? 1}</div>
                        <div style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{moeda(valor)}</div>
                        <div>{i.operador || "-"}</div>
                        <div style={{ fontSize: 12, color: "#64748b" }}>{fmtSP(i.created_at)}</div>
                      </div>
                    );
                  })}
                </div>
                </div>
                <Paginacao pagina={paginaItensCanc} total={itensCancelados.length} porPagina={POR_PAGINA} onChange={setPaginaItensCanc} />
                {itensCancelados.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 15, textAlign: "right", padding: "10px 4px", borderTop: "2px solid #dc2626", color: "#dc2626", marginTop: 4 }}>
                    Total cancelado: {moeda(totalItens)}
                  </div>
                )}
                </>
              );
            })()}

            {subAbaRel === "cupons-cancelados" && (() => {
              const totalCupons = cuponsCancelados.reduce((s, c) => s + Number(c.total ?? 0), 0);
              const cuponsPag = cuponsCancelados.slice((paginaCuponsCanc - 1) * POR_PAGINA, paginaCuponsCanc * POR_PAGINA);
              return (
                <>
                <div style={{ ...title, fontSize: 20, marginTop: 18 }}>Cupons cancelados</div>
                <div style={{ overflowX: "auto" }}>
                <div style={{ ...tableWrap, minWidth: 520 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "10px 12px", fontWeight: 800, fontSize: 14, color: "#25354b", background: "#f8fafc", borderBottom: "1px solid #e5eaf0" }}>
                    <div style={{ textAlign: "right" }}>Valor</div>
                    <div>Motivo</div>
                    <div>Operador</div>
                    <div>Data/Hora</div>
                  </div>
                  {cuponsCancelados.length === 0 ? (
                    <div style={{ padding: 16, color: "#66758a" }}>Nenhum cupom cancelado no período.</div>
                  ) : cuponsPag.map((c) => (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, padding: "11px 12px", alignItems: "center", borderTop: "1px solid #edf1f5", fontSize: 14 }}>
                      <div style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{moeda(c.total ?? 0)}</div>
                      <div>{c.motivo || "-"}</div>
                      <div>{c.operador || "-"}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{fmtSP(c.created_at)}</div>
                    </div>
                  ))}
                </div>
                </div>
                <Paginacao pagina={paginaCuponsCanc} total={cuponsCancelados.length} porPagina={POR_PAGINA} onChange={setPaginaCuponsCanc} />
                {cuponsCancelados.length > 0 && (
                  <div style={{ fontWeight: 800, fontSize: 15, textAlign: "right", padding: "10px 4px", borderTop: "2px solid #dc2626", color: "#dc2626", marginTop: 4 }}>
                    Total cancelado: {moeda(totalCupons)}
                  </div>
                )}
                </>
              );
            })()}

            {subAbaRel === "ranking" && (
              carregandoRanking ? (
                <div style={{ padding: 16, color: "#66758a" }}>Carregando ranking...</div>
              ) : rankingMaisVendidos.length === 0 ? (
                <div style={{ padding: 24, color: "#66758a", textAlign: "center" }}>Selecione o período e clique em <strong>Buscar</strong> para ver o ranking.</div>
              ) : (() => {
                const rankingPag = rankingMaisVendidos.slice((paginaRanking - 1) * POR_PAGINA, paginaRanking * POR_PAGINA);
                const offset = (paginaRanking - 1) * POR_PAGINA;
                return (
                  <>
                  <div style={{ overflowX: "auto" }}>
                  <div style={{ ...tableWrap, minWidth: 480 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "40px 1fr .7fr .9fr", gap: 12, padding: "10px 12px", fontWeight: 800, fontSize: 14, color: "#25354b", background: "#f8fafc", borderBottom: "1px solid #e5eaf0" }}>
                      <div>#</div>
                      <div>Produto</div>
                      <div style={{ textAlign: "right" }}>Qtd.</div>
                      <div style={{ textAlign: "right" }}>Receita</div>
                    </div>
                    {rankingPag.map((item, i) => {
                      const idx = offset + i;
                      const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : String(idx + 1);
                      return (
                        <div key={item.nome} style={{ display: "grid", gridTemplateColumns: "40px 1fr .7fr .9fr", gap: 12, padding: "12px 12px", alignItems: "center", borderTop: "1px solid #edf1f5", fontSize: 14, background: idx < 3 ? (idx === 0 ? "#fffbeb" : "#fafafa") : "#fff" }}>
                          <div style={{ fontWeight: 900, fontSize: 16 }}>{medalha}</div>
                          <div style={{ fontWeight: idx < 3 ? 800 : 600, color: "#11243d" }}>{item.nome}</div>
                          <div style={{ textAlign: "right", fontWeight: 800, color: "#1a7b39" }}>
                            {item.totalQtd % 1 === 0 ? item.totalQtd.toLocaleString("pt-BR") : item.totalQtd.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                          </div>
                          <div style={{ textAlign: "right", fontWeight: 700, color: "#1d3049" }}>{moeda(item.totalReceita)}</div>
                        </div>
                      );
                    })}
                  </div>
                  </div>
                  <Paginacao pagina={paginaRanking} total={rankingMaisVendidos.length} porPagina={POR_PAGINA} onChange={setPaginaRanking} />
                  </>
                );
              })()
            )}

            {subAbaRel === "fiado" && (() => {
              const termo = filtroFiadoAdm.toLowerCase().trim();
              const fiadoFiltrado = termo
                ? vendasFiado.filter((r) => (r.cliente_nome || "").toLowerCase().includes(termo))
                : vendasFiado;
              const porCliente: Record<string, { nome: string; total: number; cupons: any[] }> = {};
              for (const r of fiadoFiltrado) {
                const nome = r.cliente_nome || "Sem nome";
                if (!porCliente[nome]) porCliente[nome] = { nome, total: 0, cupons: [] };
                porCliente[nome].total += Number(r.total || 0);
                porCliente[nome].cupons.push(r);
              }
              const clientes = Object.values(porCliente).sort((a, b) => a.nome.localeCompare(b.nome));
              const fmtData = (d: string) => fmtSP(d, { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
              return (
                <div>
                  <input
                    type="text"
                    placeholder="🔍 Buscar por nome do cliente..."
                    value={filtroFiadoAdm}
                    onChange={(e) => setFiltroFiadoAdm(e.target.value)}
                    style={{ ...input, width: "100%", marginBottom: 16 }}
                  />
                  {clientes.length === 0 ? (
                    <div style={{ padding: 24, color: "#66758a", textAlign: "center" }}>Nenhum lançamento de fiado no período.</div>
                  ) : clientes.map((cli) => (
                    <div key={cli.nome} style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                      <div style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: 800, fontSize: 15 }}>👤 {cli.nome}</span>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{moeda(cli.total)}</span>
                      </div>
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 14px", fontWeight: 700, fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0", background: "#f8fafc" }}>
                          <div>Cupom</div><div>Data/Hora</div><div style={{ textAlign: "right" }}>Valor</div>
                        </div>
                        {cli.cupons.map((r: any) => (
                          <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                            <div style={{ fontFamily: "monospace", color: "#1e3a5f", fontWeight: 700 }}>#{String(r.id).slice(0, 8).toUpperCase()}</div>
                            <div style={{ color: "#475569" }}>{fmtData(r.created_at)}</div>
                            <div style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{moeda(r.total || 0)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {clientes.length > 0 && (
                    <div style={{ fontWeight: 800, fontSize: 15, textAlign: "right", padding: "10px 4px", borderTop: "2px solid #1e3a5f", color: "#1e3a5f" }}>
                      Total geral: {moeda(fiadoFiltrado.reduce((s: number, r: any) => s + Number(r.total || 0), 0))}
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        {aba === "etiquetas" && (
          <section style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={title}>🏷️ Etiquetas de Preço</div>
                <div style={subtitle}>Selecione os produtos e imprima todas as etiquetas de uma vez.</div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={fieldLabelStyle}>Papel:</div>
                {([58, 80] as const).map((w) => (
                  <button key={w} type="button" onClick={() => setLarguraEtiqueta(w)}
                    style={{ height: 36, padding: "0 14px", border: "2px solid", borderRadius: 10, fontWeight: 800, fontSize: 13, cursor: "pointer",
                      borderColor: larguraEtiqueta === w ? "#1fb14e" : "#dde3ea",
                      background:  larguraEtiqueta === w ? "#edfdf0" : "#fff",
                      color:       larguraEtiqueta === w ? "#14803b" : "#66758a" }}>
                    {w}mm
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {categoriasFila.map(cat => (
                  <button key={cat} type="button" onClick={() => { setEtqCategoria(cat); setEtqBusca(""); }}
                    style={{ padding: "6px 14px", borderRadius: 20, border: "2px solid", fontSize: 13, fontWeight: 700, cursor: "pointer",
                      borderColor: etqCategoria === cat ? "#1fb14e" : "#dde3ea",
                      background:  etqCategoria === cat ? "#edfdf0" : "#fff",
                      color:       etqCategoria === cat ? "#14803b" : "#66758a" }}>
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <input
              style={{ ...input, fontSize: 15 }}
              value={etqBusca}
              onChange={e => setEtqBusca(e.target.value)}
              placeholder="🔍 Buscar produto pelo nome..."
              autoFocus
            />

            {/* Mosaico de produtos */}
            {produtosFiltrados.length === 0 ? (
              <div style={{ color: "#94a3b8", textAlign: "center", padding: 32 }}>Nenhum produto encontrado.</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(auto-fill, minmax(170px, 1fr))", gap: 10 }}>
                {produtosFiltrados.map(produto => {
                  const naFila = filaEtiquetas.find(i => i.produto.id === produto.id);
                  return (
                    <div key={produto.id}
                      onClick={() => adicionarNaFila(produto)}
                      style={{ background: naFila ? "#edfdf0" : "#fff", border: `2px solid ${naFila ? "#1fb14e" : "#e2e8f0"}`, borderRadius: 14, padding: "12px 14px", cursor: "pointer", position: "relative", transition: "all .15s" }}>
                      {naFila && (
                        <div style={{ position: "absolute", top: 8, right: 8, background: "#1fb14e", color: "#fff", borderRadius: 20, fontSize: 11, fontWeight: 800, padding: "2px 8px" }}>
                          ×{naFila.qtd}
                        </div>
                      )}
                      {produto.categoria && (
                        <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", marginBottom: 4 }}>{produto.categoria}</div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 900, color: "#0f172a", lineHeight: 1.2, marginBottom: 8, minHeight: 34 }}>{produto.nome}</div>
                      <div style={{ background: "#1fb14e", borderRadius: 8, padding: "6px 10px", marginBottom: produto.preco_cartao ? 4 : 0 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color: "#fff", opacity: 0.8 }}>DINHEIRO / PIX</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: "#fff", lineHeight: 1 }}>{moeda(produto.preco)}</div>
                      </div>
                      {produto.preco_cartao ? (
                        <div style={{ background: "#f1f5f9", borderRadius: 6, padding: "4px 10px" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#64748b" }}>CARTÃO</div>
                          <div style={{ fontSize: 14, fontWeight: 900, color: "#374151" }}>{moeda(produto.preco_cartao)}</div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Fila de impressão */}
            {filaEtiquetas.length > 0 && (
              <div style={{ background: "#f8fafc", border: "2px solid #1fb14e", borderRadius: 14, padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: 15, color: "#0f172a" }}>
                  🖨️ Fila de impressão — {filaEtiquetas.reduce((s, i) => s + i.qtd, 0)} etiqueta(s)
                </div>
                {filaEtiquetas.map(({ produto, qtd }) => (
                  <div key={produto.id} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", borderRadius: 10, padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{produto.nome}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{moeda(produto.preco)}</div>
                    </div>
                    <button type="button" onClick={() => ajustarQtd(produto.id, -1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>−</button>
                    <span style={{ fontWeight: 800, fontSize: 16, minWidth: 24, textAlign: "center" }}>{qtd}</span>
                    <button type="button" onClick={() => ajustarQtd(produto.id, 1)} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>+</button>
                    <button type="button" onClick={() => removerDaFila(produto.id)} style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "#fee2e2", color: "#dc2626", fontWeight: 900, fontSize: 16, cursor: "pointer" }}>×</button>
                  </div>
                ))}
                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setFilaEtiquetas([])} style={{ flex: 1, padding: 12, borderRadius: 10, border: "1px solid #e2e8f0", background: "#fff", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>
                    Limpar fila
                  </button>
                  <button type="button" onClick={imprimirFilaEtiquetas} style={{ ...saveButton, flex: 2, margin: 0 }}>
                    🖨️ Imprimir {filaEtiquetas.reduce((s, i) => s + i.qtd, 0)} etiqueta(s)
                  </button>
                </div>
              </div>
            )}

            {filaEtiquetas.length === 0 && (
              <div style={{ textAlign: "center", color: "#94a3b8", fontSize: 13, padding: "8px 0" }}>
                Clique nos produtos para adicioná-los à fila de impressão.
              </div>
            )}
          </section>
        )}

        {aba === "senhas" && (
          <section style={card}>
            <div style={title}>Senhas operacionais</div>
            <div style={subtitle}>Centralize aqui todas as senhas do sistema.</div>

            <form onSubmit={salvarSenhas}>
              <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
                <Field label="Senha do ADM">
                  <input style={input} value={senhasOp.adm_password || ""} onChange={(e) => setSenhasOp({ ...senhasOp, adm_password: e.target.value })} />
                </Field>
                <Field label="Senha cancelar item">
                  <input style={input} value={senhasOp.senha_cancelar_item || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_cancelar_item: e.target.value })} />
                </Field>
                <Field label="Senha cancelar venda">
                  <input style={input} value={senhasOp.senha_cancelar_venda || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_cancelar_venda: e.target.value })} />
                </Field>
                <Field label="Senha sangria">
                  <input style={input} value={senhasOp.senha_sangria || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_sangria: e.target.value })} />
                </Field>
                <Field label="Senha suprimento">
                  <input style={input} value={senhasOp.senha_suprimento || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_suprimento: e.target.value })} />
                </Field>
                <Field label="Senha alterar preço">
                  <input style={input} value={senhasOp.senha_alterar_preco || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_alterar_preco: e.target.value })} />
                </Field>
                <Field label="Senha reabrir caixa">
                  <input style={input} value={senhasOp.senha_reabrir_caixa || ""} onChange={(e) => setSenhasOp({ ...senhasOp, senha_reabrir_caixa: e.target.value })} />
                </Field>
              </div>
              <button type="submit" style={saveButton}>Salvar senhas</button>
            </form>

            {feat("notificacoes_adm") && (
              <div style={{ marginTop: 32, padding: 20, background: "#f0fdf4", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>🔔 Notificações ADM</div>
                <div style={{ fontSize: 13, color: "#374151", marginBottom: 14 }}>
                  Receba uma notificação no celular sempre que um operador usar a senha gerencial.<br />
                  Abra esta página no seu celular e clique em &quot;Ativar notificações&quot;.
                </div>
                {!push.suportado ? (
                  <p style={{ fontSize: 13, color: "#6b7280" }}>Este dispositivo não suporta notificações push.</p>
                ) : push.permissao === "denied" ? (
                  <p style={{ fontSize: 13, color: "#dc2626" }}>Permissão de notificação bloqueada. Libere nas configurações do navegador.</p>
                ) : push.inscrito ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 13, color: "#16a34a" }}>✅ Notificações ativas neste dispositivo</span>
                    <button
                      onClick={push.desativar}
                      disabled={push.carregando}
                      style={{ fontSize: 12, padding: "4px 12px", borderRadius: 6, border: "1px solid #dc2626", background: "#fff", color: "#dc2626", cursor: "pointer" }}
                    >
                      {push.carregando ? "..." : "Desativar"}
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={async () => {
                        setPushErro("");
                        const r = await push.ativar();
                        if (!r.ok) setPushErro(r.erro ?? r.error ?? "Erro desconhecido");
                      }}
                      disabled={push.carregando}
                      style={{ ...saveButton, background: "#1fb14e", fontSize: 14, padding: "10px 22px" }}
                    >
                      {push.carregando ? "Aguarde..." : "🔔 Ativar notificações neste dispositivo"}
                    </button>
                    {pushErro && <p style={{ fontSize: 13, color: "#dc2626", marginTop: 8 }}>❌ {pushErro}</p>}
                  </>
                )}
              </div>
            )}
          </section>
        )}

        {aba === "suporte" && (
          <section style={card}>
            <div style={title}>🆘 Suporte</div>
            <div style={subtitle}>Preencha o formulário e nossa equipe responderá em breve.</div>

            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 28, alignItems: "start" }}>
              {/* Formulário */}
              <form onSubmit={enviarSuporte}>
                <Field label="Seu nome *">
                  <input
                    style={input}
                    value={supNome}
                    onChange={e => setSupNome(e.target.value)}
                    placeholder="Como devemos te chamar?"
                    required
                  />
                </Field>

                <div style={{ marginTop: 16 }}>
                  <Field label="WhatsApp para contato">
                    <input
                      style={input}
                      value={supWhatsapp}
                      onChange={e => setSupWhatsapp(e.target.value.replace(/\D/g, ""))}
                      placeholder="Ex: 11999998888"
                      inputMode="tel"
                      maxLength={15}
                    />
                  </Field>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Field label="Assunto *">
                    <select
                      style={input}
                      value={supAssunto}
                      onChange={e => setSupAssunto(e.target.value)}
                    >
                      <option value="duvida">Dúvida técnica</option>
                      <option value="erro">Erro no sistema</option>
                      <option value="sugestao">Sugestão de melhoria</option>
                      <option value="outro">Outro assunto</option>
                    </select>
                  </Field>
                </div>

                <div style={{ marginTop: 16 }}>
                  <Field label="Mensagem *">
                    <textarea
                      style={{ ...input, height: "auto", padding: "12px 16px", resize: "vertical", fontSize: 15, lineHeight: 1.6 }}
                      rows={5}
                      value={supMensagem}
                      onChange={e => setSupMensagem(e.target.value)}
                      placeholder="Descreva sua dúvida ou problema com o máximo de detalhes possível..."
                      required
                    />
                  </Field>
                </div>

                {supMsg && (
                  <div style={{
                    marginTop: 14,
                    padding: "12px 16px",
                    borderRadius: 12,
                    fontWeight: 700,
                    fontSize: 14,
                    background: supMsg.ok ? "#f0fdf4" : "#fef2f2",
                    border: `1px solid ${supMsg.ok ? "#bbf7d0" : "#fecaca"}`,
                    color: supMsg.ok ? "#15803d" : "#991b1b",
                  }}>
                    {supMsg.ok ? "✅ " : "⚠️ "}{supMsg.texto}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={supEnviando || !supNome.trim() || !supMensagem.trim()}
                  style={{ ...saveButton, opacity: supEnviando || !supNome.trim() || !supMensagem.trim() ? 0.6 : 1 }}
                >
                  {supEnviando ? "Enviando..." : "📨 Enviar mensagem"}
                </button>
              </form>

              {/* Informações */}
              <div style={{ ...cardSoft, display: "flex", flexDirection: "column", gap: 20 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#11243d", marginBottom: 6 }}>
                    📬 Como funciona?
                  </div>
                  <div style={{ color: "#66758a", fontSize: 14, lineHeight: 1.8 }}>
                    Preencha o formulário ao lado com o máximo de detalhes possível.
                    Nossa equipe analisará e retornará em até <strong>24 horas</strong> nos dias úteis.
                  </div>
                </div>

                <div style={{ background: "#f8fafc", border: "1px solid #e4eaf1", borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontWeight: 800, color: "#1d3049", fontSize: 14, marginBottom: 10 }}>
                    📋 Antes de enviar, verifique:
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, color: "#66758a", fontSize: 14, lineHeight: 2.2 }}>
                    <li>O sistema está na versão mais recente?</li>
                    <li>O problema acontece sempre ou só às vezes?</li>
                    <li>Em qual tela o erro aparece?</li>
                    <li>Há alguma mensagem de erro visível?</li>
                  </ul>
                </div>

                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 14, padding: "16px" }}>
                  <div style={{ fontWeight: 800, color: "#15803d", fontSize: 14, marginBottom: 6 }}>
                    ⏱️ Prazo de resposta
                  </div>
                  <div style={{ color: "#16a34a", fontSize: 13, lineHeight: 1.7 }}>
                    Dúvidas e sugestões: até 24h úteis<br />
                    Erros críticos: até 4h úteis
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {aba === "licencas" && (
          <section style={card}>
            <div style={title}>🔑 Gerenciar Licenças</div>
            <div style={subtitle}>Gere chaves de acesso para seus clientes. A validade de 5 anos começa na primeira ativação.</div>

            {/* Formulário para gerar novas chaves */}
            <form onSubmit={gerarNovasChaves} style={{ marginBottom: 28 }}>
              <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))", marginBottom: 12 }}>
                <Field label="Cliente (opcional)">
                  <input style={input} placeholder="Ex: Mercadinho do João" value={novaLicCliente} onChange={(e) => setNovaLicCliente(e.target.value)} />
                </Field>
                <Field label="Observações (opcional)">
                  <input style={input} placeholder="Qualquer nota interna" value={novaLicNotas} onChange={(e) => setNovaLicNotas(e.target.value)} />
                </Field>
                <Field label="Quantidade de chaves">
                  <input style={input} type="number" min={1} max={50} value={novaLicQtd} onChange={(e) => setNovaLicQtd(Number(e.target.value))} />
                </Field>
              </div>
              <button type="submit" style={saveButton}>Gerar chave(s)</button>
            </form>

            {/* Chaves recém geradas */}
            {licencasGeradas.length > 0 && (
              <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 14, padding: 16, marginBottom: 24 }}>
                <div style={{ fontWeight: 800, color: "#166534", marginBottom: 8 }}>✅ Chaves geradas — copie e envie ao cliente:</div>
                {licencasGeradas.map((c) => (
                  <div key={c} style={{ fontFamily: "monospace", fontSize: 17, letterSpacing: 1, color: "#166534", padding: "4px 0" }}>{c}</div>
                ))}
                <button
                  style={{ ...blueSmall, marginTop: 10, background: licCopied ? "#1fb14e" : undefined }}
                  onClick={() => {
                    navigator.clipboard.writeText(licencasGeradas.join("\n"));
                    setLicCopied(true);
                    setTimeout(() => setLicCopied(false), 2000);
                  }}
                >
                  {licCopied ? "✅ Copiado!" : "📋 Copiar todas"}
                </button>
                <button style={{ ...lightButton, marginTop: 10, marginLeft: 8 }} onClick={() => setLicencasGeradas([])}>Fechar</button>
              </div>
            )}

            {/* Lista de licenças */}
            <div style={{ fontWeight: 800, fontSize: 16, color: "#11243d", marginBottom: 10 }}>Todas as chaves ({licencas.length})</div>
            {licencas.length === 0 ? (
              <div style={{ color: "#66758a" }}>Nenhuma chave cadastrada ainda.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {licencas.map((lic) => {
                  const ativada = !!lic.ativado_em;
                  const validade = lic.validade ? new Date(lic.validade) : null;
                  const expirada = validade ? validade < new Date() : false;
                  const statusColor = !lic.ativo ? "#ef4444" : expirada ? "#f97316" : ativada ? "#1fb14e" : "#3b82f6";
                  const statusLabel = !lic.ativo ? "Revogada" : expirada ? "Expirada" : ativada ? "Ativa" : "Aguardando ativação";

                  return (
                    <div key={lic.id} style={{ ...cardSoft, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
                      {/* Chave */}
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 700, letterSpacing: 1, color: "#11243d" }}>{lic.chave}</div>
                        {lic.cliente && <div style={{ fontSize: 13, color: "#4b6275" }}>👤 {lic.cliente}</div>}
                        {lic.notas && <div style={{ fontSize: 12, color: "#66758a" }}>📝 {lic.notas}</div>}
                      </div>
                      {/* Datas */}
                      <div style={{ fontSize: 12, color: "#66758a", minWidth: 150 }}>
                        <div>Criada: {new Date(lic.criado_em).toLocaleDateString("pt-BR")}</div>
                        {ativada && <div>Ativada: {new Date(lic.ativado_em!).toLocaleDateString("pt-BR")}</div>}
                        {validade && <div>Expira: {validade.toLocaleDateString("pt-BR")}</div>}
                      </div>
                      {/* Status */}
                      <div style={{ background: statusColor + "22", color: statusColor, fontWeight: 700, fontSize: 12, borderRadius: 20, padding: "4px 12px" }}>
                        {statusLabel}
                      </div>
                      {/* Ações */}
                      <div style={{ display: "flex", gap: 6 }}>
                        {lic.ativo ? (
                          <button style={{ ...blueSmall, background: "#ef4444" }} onClick={() => revogarLicenca(lic.id)}>Revogar</button>
                        ) : (
                          <button style={{ ...blueSmall, background: "#1fb14e" }} onClick={() => reativarLicenca(lic.id)}>Reativar</button>
                        )}
                        <button style={{ ...blueSmall, background: "#6b7280" }} onClick={() => excluirLicenca(lic.id)}>Excluir</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* Modal: PDV não instalado */}
      {modalDownloadPDV && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 36, maxWidth: 420, width: "90%", textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.25)" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🖥️</div>
            <div style={{ fontSize: 20, fontWeight: 800, color: "#1a2230", marginBottom: 8 }}>PDV não instalado</div>
            <div style={{ fontSize: 14, color: "#475569", marginBottom: 24, lineHeight: 1.6 }}>
              O aplicativo de caixa não foi encontrado neste computador.<br/>
              Baixe e instale o PDV para usar o caixa.
            </div>
            <a
              href={urlDownloadPDV}
              download
              style={{ display: "block", background: "#16a34a", color: "#fff", fontWeight: 700, fontSize: 15, padding: "12px 24px", borderRadius: 10, textDecoration: "none", marginBottom: 12 }}
            >
              ⬇️ Baixar e instalar PDV
            </a>
            <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 20 }}>
              Após instalar, clique novamente em "Abrir Caixa (PDV)"
            </div>
            <button onClick={() => setModalDownloadPDV(false)} style={{ background: "none", border: "1px solid #dde3ea", borderRadius: 8, padding: "8px 20px", color: "#475569", cursor: "pointer", fontSize: 13 }}>
              Fechar
            </button>
          </div>
        </div>
      )}

      {aba === "dashboard" && (
        <DashboardAba hoje={dashHoje} ontem={dashOntem} mes={dashMes} somaHoje={dashSomaHoje} somaOntem={dashSomaOntem} somaMes={dashSomaMes} clientesHoje={dashClientesHoje} clientesOntem={dashClientesOntem} clientesMes={dashClientesMes} carregando={dashCarregando} onAtualizar={carregarDashboard} />
      )}

      {/* ── Aba NFC-e ── */}
      {aba === "nfce" && (
        <section style={card}>
          <div style={title}>🧾 Configuração NFC-e</div>
          <div style={subtitle}>Configure sua conta de emissão de NFC-e. Cada nota emitida é cobrada diretamente pelo provedor escolhido.</div>

          {nfceMsg && <div style={{ padding: "10px 14px", borderRadius: 8, background: nfceMsg.startsWith("✅") ? "#f0fdf4" : nfceMsg.startsWith("⏳") ? "#f0f9ff" : "#fef2f2", color: nfceMsg.startsWith("✅") ? "#166534" : nfceMsg.startsWith("⏳") ? "#0369a1" : "#991b1b", fontWeight: 600, fontSize: 14 }}>{nfceMsg}</div>}

          <form onSubmit={salvarNfceConfig} style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Provedor e ambiente */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>🔌 Provedor de API</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <Field label="Provedor">
                  <select style={input} value={nfceConfig.provider} onChange={e => setNfceConfig(p => ({ ...p, provider: e.target.value as "focusnfe" | "nfeio" }))}>
                    <option value="focusnfe">Focus NFe (R$ 0,10/nota)</option>
                    <option value="nfeio">NFe.io (R$ 0,08/nota)</option>
                  </select>
                </Field>
                <Field label="Ambiente">
                  <select style={input} value={nfceConfig.ambiente} onChange={e => setNfceConfig(p => ({ ...p, ambiente: e.target.value as "homologacao" | "producao" }))}>
                    <option value="homologacao">Homologação (testes)</option>
                    <option value="producao">Produção (real)</option>
                  </select>
                </Field>
              </div>
              <Field label="Token / API Key">
                <div style={{ display: "flex", gap: 8 }}>
                  <input style={{ ...input, flex: 1, fontFamily: "monospace" }} value={nfceConfig.token} onChange={e => setNfceConfig(p => ({ ...p, token: e.target.value }))} placeholder="Cole aqui o token fornecido pelo provedor" />
                  <button type="button" onClick={testarConexaoNfce} style={{ padding: "0 16px", borderRadius: 8, border: "1px solid #e2e8f0", background: "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap" }}>
                    🔍 Testar
                  </button>
                </div>
              </Field>
              <div style={{ fontSize: 12, color: "#64748b", background: "#fff", borderRadius: 8, padding: "8px 12px", border: "1px solid #e2e8f0" }}>
                {nfceConfig.provider === "focusnfe"
                  ? "📌 Crie sua conta em focusnfe.com.br → Acesse o painel → Configurações → Token de acesso"
                  : "📌 Crie sua conta em nfe.io → Painel → Empresa → Chave de API"}
              </div>
            </div>

            {/* Dados do emitente */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>🏢 Dados do Emitente</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 12 }}>
                <Field label="CNPJ">
                  <input style={input} value={nfceConfig.cnpj} onChange={e => setNfceConfig(p => ({ ...p, cnpj: e.target.value }))} placeholder="00.000.000/0000-00" />
                </Field>
                <Field label="Razão Social">
                  <input style={input} value={nfceConfig.razao_social} onChange={e => setNfceConfig(p => ({ ...p, razao_social: e.target.value }))} placeholder="Nome da empresa no CNPJ" />
                </Field>
                <Field label="Inscrição Estadual (IE)">
                  <input style={input} value={nfceConfig.ie} onChange={e => setNfceConfig(p => ({ ...p, ie: e.target.value }))} placeholder="Somente números" />
                </Field>
                <Field label="Regime Tributário (CRT)">
                  <select style={input} value={nfceConfig.crt} onChange={e => setNfceConfig(p => ({ ...p, crt: e.target.value as "1"|"2"|"3" }))}>
                    <option value="1">1 — Simples Nacional</option>
                    <option value="2">2 — Simples Nacional (excesso de sublimite)</option>
                    <option value="3">3 — Regime Normal</option>
                  </select>
                </Field>
                <Field label="Telefone">
                  <input style={input} value={nfceConfig.telefone} onChange={e => setNfceConfig(p => ({ ...p, telefone: e.target.value }))} placeholder="(00) 00000-0000" />
                </Field>
                <Field label="UF">
                  <select style={input} value={nfceConfig.uf} onChange={e => setNfceConfig(p => ({ ...p, uf: e.target.value }))}>
                    {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map(uf => <option key={uf}>{uf}</option>)}
                  </select>
                </Field>
              </div>
            </div>

            {/* Endereço */}
            <div style={{ background: "#f8fafc", borderRadius: 12, padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>📍 Endereço</div>
              <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 12 }}>
                <Field label="CEP">
                  <input style={input} value={nfceConfig.cep} onChange={e => setNfceConfig(p => ({ ...p, cep: e.target.value }))} placeholder="00000-000" />
                </Field>
                <Field label="Logradouro">
                  <input style={input} value={nfceConfig.logradouro} onChange={e => setNfceConfig(p => ({ ...p, logradouro: e.target.value }))} placeholder="Rua, Av..." />
                </Field>
                <Field label="Número">
                  <input style={input} value={nfceConfig.numero} onChange={e => setNfceConfig(p => ({ ...p, numero: e.target.value }))} placeholder="S/N" />
                </Field>
                <Field label="Bairro">
                  <input style={input} value={nfceConfig.bairro} onChange={e => setNfceConfig(p => ({ ...p, bairro: e.target.value }))} placeholder="Bairro" />
                </Field>
                <Field label="Município">
                  <input style={input} value={nfceConfig.municipio} onChange={e => setNfceConfig(p => ({ ...p, municipio: e.target.value }))} placeholder="Nome da cidade" />
                </Field>
              </div>
            </div>

            <button type="submit" disabled={nfceSalvando} style={saveButton}>
              {nfceSalvando ? "Salvando..." : "💾 Salvar Configuração"}
            </button>
          </form>

          {/* Histórico de notas */}
          {nfceNotas.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#0f172a", marginBottom: 12 }}>📋 Últimas notas emitidas</div>
              <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                {nfceNotas.map((nota) => (
                  <div key={nota.id} style={{ display: "grid", gridTemplateColumns: "1fr auto auto auto", gap: 12, alignItems: "center", padding: "10px 14px", borderBottom: "1px solid #f1f5f9", fontSize: 13 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#1e293b" }}>{nota.numero ? `NFC-e #${nota.numero}` : nota.id.slice(0, 8)}</div>
                      {nota.chave_acesso && <div style={{ fontSize: 11, color: "#94a3b8", fontFamily: "monospace" }}>{nota.chave_acesso.slice(0, 20)}...</div>}
                    </div>
                    <div style={{ fontSize: 11, color: "#64748b" }}>{fmtSP(nota.created_at)}</div>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: nota.status === "autorizado" ? "#dcfce7" : nota.status === "cancelado" ? "#fee2e2" : "#fef9c3", color: nota.status === "autorizado" ? "#166534" : nota.status === "cancelado" ? "#991b1b" : "#92400e" }}>
                      {nota.status}
                    </span>
                    <div style={{ fontWeight: 800, color: "#1a7b39" }}>R$ {Number(nota.total).toFixed(2).replace(".", ",")}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {aba === "maquininha" && (
        <section style={card}>
          <div style={title}>💳 Maquininha</div>
          <div style={subtitle}>Configure a integração com a maquininha para enviar cobranças automaticamente ao finalizar com cartão.</div>

          {maqMsg && (
            <div style={{ padding: "10px 14px", borderRadius: 8, fontWeight: 600, fontSize: 14,
              background: maqMsg.startsWith("✅") ? "#f0fdf4" : maqMsg.startsWith("⚠️") ? "#fffbeb" : "#fef2f2",
              color:      maqMsg.startsWith("✅") ? "#166534" : maqMsg.startsWith("⚠️") ? "#92400e" : "#991b1b" }}>
              {maqMsg}
            </div>
          )}

          {/* Seletor de provedor */}
          <div style={{ display: "flex", gap: 10 }}>
            {(["mercadopago", "stone"] as const).map(p => (
              <button key={p} type="button"
                onClick={() => { setMaqConfig(c => ({ ...c, provider: p })); setMaqDispositivos([]); }}
                style={{ flex: 1, padding: "12px 0", borderRadius: 12, border: "2px solid", fontWeight: 800, fontSize: 14, cursor: "pointer",
                  borderColor: maqConfig.provider === p ? "#1fb14e" : "#e2e8f0",
                  background:  maqConfig.provider === p ? "#edfdf0" : "#fff",
                  color:       maqConfig.provider === p ? "#14803b" : "#64748b" }}>
                {p === "mercadopago" ? "🟡 Mercado Pago" : "🟢 Stone"}
              </button>
            ))}
          </div>

          <form onSubmit={salvarMaqConfig} style={{ display: "flex", flexDirection: "column", gap: 16 }}>

            {/* ── Mercado Pago ── */}
            {maqConfig.provider === "mercadopago" && (<>
              <Field label="Access Token (Mercado Pago Developers)">
                <input style={input} type="password" value={maqConfig.mp_token}
                  onChange={e => setMaqConfig(p => ({ ...p, mp_token: e.target.value }))}
                  placeholder="APP_USR-..." />
              </Field>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, fontSize: 13, color: "#475569" }}>
                1. Acesse <strong>mercadopago.com.br/developers</strong><br/>
                2. Crie um aplicativo → copie o <strong>Access Token de Produção</strong>
              </div>
              {maqDispositivos.length > 0 && (
                <Field label="Selecionar terminal">
                  <select style={input} value={maqConfig.mp_device_id}
                    onChange={e => setMaqConfig(p => ({ ...p, mp_device_id: e.target.value }))}>
                    <option value="">-- Selecione --</option>
                    {maqDispositivos.map(d => <option key={d.id} value={d.id}>{d.label || d.id}</option>)}
                  </select>
                </Field>
              )}
              {maqConfig.mp_device_id && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#166534", fontWeight: 600 }}>
                  ✅ Terminal: {maqConfig.mp_device_id}
                </div>
              )}
            </>)}

            {/* ── Stone ── */}
            {maqConfig.provider === "stone" && (<>
              <Field label="Secret Key (Pagar.me / Stone)">
                <input style={input} type="password" value={maqConfig.stone_token}
                  onChange={e => setMaqConfig(p => ({ ...p, stone_token: e.target.value }))}
                  placeholder="sk_live_..." />
              </Field>
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: 14, fontSize: 13, color: "#475569" }}>
                1. Acesse <strong>dashboard.pagar.me</strong> (conta Stone)<br/>
                2. Configurações → Chaves de API → copie a <strong>Secret Key</strong>
              </div>
              {maqDispositivos.length > 0 && (
                <Field label="Selecionar terminal Stone Smart">
                  <select style={input} value={maqConfig.stone_terminal_id}
                    onChange={e => setMaqConfig(p => ({ ...p, stone_terminal_id: e.target.value }))}>
                    <option value="">-- Selecione --</option>
                    {maqDispositivos.map(d => <option key={d.id} value={d.id}>{d.label || d.id}</option>)}
                  </select>
                </Field>
              )}
              {maqConfig.stone_terminal_id && (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#166534", fontWeight: 600 }}>
                  ✅ Terminal: {maqConfig.stone_terminal_id}
                </div>
              )}
            </>)}

            <button type="button" onClick={buscarDispositivos}
              style={{ ...saveButton, margin: 0, background: "#0070f3" }} disabled={maqBuscando}>
              {maqBuscando ? "Buscando..." : "🔍 Buscar terminais vinculados"}
            </button>

            <button type="submit" style={saveButton}
              disabled={maqSalvando || (maqConfig.provider === "mercadopago" ? !maqConfig.mp_token : !maqConfig.stone_token)}>
              {maqSalvando ? "Salvando..." : "💾 Salvar configuração"}
            </button>
          </form>
        </section>
      )}

      {/* Rodapé com versão */}
      <div style={{ textAlign: "center", color: "#475569", fontSize: 12, paddingTop: 24, paddingBottom: 8, lineHeight: 1.7 }}>
        Umbrela Gestão · v{process.env.NEXT_PUBLIC_APP_VERSION || "—"}<br/>
        Desenvolvido por Jean Silva
      </div>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dde3ea",
  borderRadius: 28,
  padding: 22,
  boxShadow: "0 8px 24px rgba(15,23,42,.04)",
};

const cardSoft: React.CSSProperties = {
  background: "#fbfcfd",
  border: "1px solid #e4eaf1",
  borderRadius: 22,
  padding: 18,
};

const title: React.CSSProperties = {
  fontSize: 22,
  fontWeight: 900,
  color: "#11243d",
  marginBottom: 4,
};

const subtitle: React.CSSProperties = {
  color: "#66758a",
  marginBottom: 18,
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  fontWeight: 800,
  color: "#1d3049",
  fontSize: 15,
  marginBottom: 8,
};

const grid2: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gap: 16,
};

const contentGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "clamp(280px, 40%, 420px) 1fr",
  gap: 18,
};

const filterGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
  marginBottom: 18,
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
  boxSizing: "border-box",
};

const saveButton: React.CSSProperties = {
  marginTop: 20,
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

const lightButton: React.CSSProperties = {
  border: "1px solid #d5dde7",
  background: "#fff",
  color: "#243447",
  height: 42,
  padding: "0 20px",
  borderRadius: 12,
  fontWeight: 800,
  fontSize: 16,
  cursor: "pointer",
};

const tabBtn: React.CSSProperties = {
  border: "1px solid #dbe2ea",
  borderRadius: 999,
  padding: "12px 18px",
  fontWeight: 800,
  fontSize: 15,
  cursor: "pointer",
};

const msgBox: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #dbe4ec",
  borderRadius: 18,
  padding: "12px 16px",
  color: "#1d4f2f",
  marginBottom: 14,
};

const errorBox: React.CSSProperties = {
  marginTop: 12,
  color: "#991b1b",
  background: "#fef2f2",
  border: "1px solid #fecaca",
  padding: "12px 14px",
  borderRadius: 14,
  fontWeight: 700,
};

const eyeBtn: React.CSSProperties = {
  position: "absolute",
  right: 10,
  top: 8,
  height: 32,
  width: 32,
  borderRadius: 10,
  border: "1px solid #dbe2ea",
  background: "#fff",
  cursor: "pointer",
};

const tableWrap: React.CSSProperties = {
  borderTop: "1px solid #edf1f5",
};

const theadOps: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr .8fr 1.4fr",
  gap: 14,
  padding: "14px 12px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 15,
};

const trowOps: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 1fr .8fr 1.4fr",
  gap: 14,
  padding: "14px 12px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 16,
};

const theadVendas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.6fr 1fr 1fr 90px",
  gap: 14,
  padding: "14px 12px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 15,
};

const trowVendas: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.6fr 1fr 1fr 90px",
  gap: 14,
  padding: "14px 12px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 16,
};

const theadCancelados: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.5fr 1fr 1.4fr",
  gap: 14,
  padding: "14px 12px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 15,
};

const trowCancelados: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1.5fr 1fr 1.4fr",
  gap: 14,
  padding: "14px 12px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 16,
};

const orangeSmall: React.CSSProperties = {
  border: "1px solid #f3b981",
  background: "#fff7ed",
  color: "#c65d07",
  borderRadius: 12,
  height: 40,
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 120,
};

const blueSmall: React.CSSProperties = {
  border: "1px solid #93c5fd",
  background: "#eff6ff",
  color: "#1d4ed8",
  borderRadius: 12,
  height: 40,
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 80,
  padding: "0 12px",
};

const greenSmall: React.CSSProperties = {
  border: "1px solid #b7edc5",
  background: "#edfdf0",
  color: "#1a7b39",
  borderRadius: 12,
  height: 40,
  fontWeight: 900,
  cursor: "pointer",
  minWidth: 120,
};

const etiquetaBox: React.CSSProperties = {
  border: "2px dashed #d1d5db",
  borderRadius: 18,
  padding: 20,
  background: "#fff",
  maxWidth: 320,
  boxShadow: "0 4px 14px rgba(0,0,0,.06)",
};

const subTabAtivo: React.CSSProperties = {
  padding: "8px 18px",
  borderRadius: 12,
  border: "none",
  background: "#1a7b39",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};

const subTabInativo: React.CSSProperties = {
  padding: "8px 18px",
  borderRadius: 12,
  border: "1px solid #dde3ea",
  background: "#f8fafc",
  color: "#243447",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};
