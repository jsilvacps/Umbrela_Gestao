"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/supabaseClient";
import { useOnlineStatus } from "@/lib/useOnlineStatus";
import {
  syncProdutosLocal, getProdutosLocal, debitarEstoqueLocal,
  savePendingVenda, countPendingVendas, syncPendingVendas,
} from "@/lib/syncService";
import {
  inicializarLicenca, validarLicencaOnline, salvarChave, salvarLicencaCache,
  getDiasTrialRestantes, gerarChave,
  type Plano, type RecursoPro, temRecurso,
} from "@/lib/licenca";

/* ── Tipos ── */
type Produto = {
  id: string;
  nome: string;
  codigo: string | null;
  ean: string | null;
  preco: number | null;
  preco_cartao: number | null;
  unidade: string | null;
};

type ItemCarrinho = {
  id: string;
  produto: Produto;
  quantidade: number;
  precoUnitario: number;
};

type Operador = {
  id?: string;
  nome?: string | null;
  username: string;
  perm_finalizar?:      boolean | null;
  perm_cancelar_item?:  boolean | null;
  perm_cancelar_venda?: boolean | null;
  perm_sangria?:        boolean | null;
  perm_relatorios?:     boolean | null;
  perm_desconto?:       boolean | null;
  perm_buscar_cupons?:  boolean | null;
};

/* ── Formatação ── */
function formatarCPF(valor: string) {
  const n = valor.replace(/\D/g, "").slice(0, 11);
  return n
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function moedaBR(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function validarCPF(cpf: string): boolean {
  const n = cpf.replace(/\D/g, "");
  if (n.length !== 11 || /^(\d)\1{10}$/.test(n)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += parseInt(n[i]) * (10 - i);
  let r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(n[9])) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += parseInt(n[i]) * (11 - i);
  r = (s * 10) % 11; if (r === 10 || r === 11) r = 0;
  return r === parseInt(n[10]);
}

export default function PDVPage() {
  /* ── Licença ── */
  const [plano, setPlano]                     = useState<Plano>("trial");
  // Inicia com 15 (valor SSR-safe). O useEffect abaixo corrige com o valor real do localStorage.
  const [diasTrial, setDiasTrial]             = useState(15);
  const [clienteLicenca, setClienteLicenca]   = useState("");
  const [modalLicenca, setModalLicenca]       = useState(false);
  const [chaveInput, setChaveInput]           = useState("");
  const [ativandoLicenca, setAtivandoLicenca] = useState(false);
  const [erroLicenca, setErroLicenca]         = useState("");
  const refChaveInput                         = useRef<HTMLInputElement>(null);

  const router = useRouter();

  /* ── Online/offline ── */
  const isOnline = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [sincronizando, setSincronizando] = useState(false);

  /* ── Estado do operador e empresa ── */
  const [operador, setOperador] = useState<Operador | null>(null);
  const [logoSrc, setLogoSrc] = useState<string | null>(null);

  /* ── Estado do CPF ── */
  const [cpf, setCpf] = useState("");
  const [pedirCadastroCPF, setPedirCadastroCPF] = useState(false);
  const [cpfNaoEncontrado, setCpfNaoEncontrado] = useState("");
  const [mostrarModalCPF, setMostrarModalCPF] = useState(true);
  const [clienteLabel, setClienteLabel] = useState("Sem cliente identificado");

  /* ── Estado do carrinho ── */
  const [codigoBusca, setCodigoBusca] = useState("");
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [quantidade, setQuantidade] = useState("1");
  const [precoUnitario, setPrecoUnitario] = useState("");
  const [carrinho, setCarrinho] = useState<ItemCarrinho[]>(() => {
    try {
      const salvo = typeof window !== "undefined" ? localStorage.getItem("pdv_carrinho") : null;
      return salvo ? JSON.parse(salvo) : [];
    } catch { return []; }
  });
  const [mensagem, setMensagem] = useState("");

  /* ── Busca rápida (autocomplete) ── */
  const [todosProdutos, setTodosProdutos] = useState<Produto[]>([]);
  const [sugestoes, setSugestoes] = useState<Produto[]>([]);
  const [sugestaoIdx, setSugestaoIdx] = useState(-1);

  /* ── Senha ADM ── */
  const [senhaAdmConfig, setSenhaAdmConfig] = useState("1234");
  const [modalAdm, setModalAdm] = useState<{
    titulo: string;
    descricao: string;
    onConfirmar: () => Promise<void>;
  } | null>(null);
  const [senhaAdmInput, setSenhaAdmInput] = useState("");
  const [erroSenhaAdm, setErroSenhaAdm] = useState("");
  const [salvandoAdm, setSalvandoAdm] = useState(false);
  const refSenhaAdm = useRef<HTMLInputElement>(null);

  /* ── Modal motivo cancelamento ── */
  const [modalMotivo, setModalMotivo] = useState<{
    titulo: string;
    descricao: string;
    onConfirmar: (motivo: string) => void;
  } | null>(null);
  const [motivoInput, setMotivoInput] = useState("");
  const refMotivo = useRef<HTMLInputElement>(null);

  /* ── Finalizar venda ── */
  const [modalFinalizar, setModalFinalizar] = useState(false);
  const [tipoPagamento, setTipoPagamento]   = useState<"dinheiro" | "pix" | "cartao" | "fiado">("dinheiro");
  const [subtipoCartao, setSubtipoCartao]   = useState<"debito" | "credito" | "alimentacao">("debito");
  const [desconto, setDesconto]             = useState("");
  const [tipoDesconto, setTipoDesconto]     = useState<"R$" | "%">("R$");
  const [valorRecebido, setValorRecebido]   = useState("");
  const [finalizando, setFinalizando]       = useState(false);
  const refValorRecebido                    = useRef<HTMLInputElement>(null);

  /* ── Config do cupom ── */
  const [cupomCfg, setCupomCfg] = useState({
    largura: 80, cabecalho: "", rodape: "", nome: "", cnpj: "", endereco: "", telefone: ""
  });

  /* ── Sangria ── */
  const [modalSangria, setModalSangria] = useState(false);
  const [valorSangria, setValorSangria] = useState("");
  const [obsSangria, setObsSangria] = useState("");
  const [salvandoSangria, setSalvandoSangria] = useState(false);
  const [totalCaixa, setTotalCaixa] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    return Number(localStorage.getItem("pdv_total_caixa") || "0");
  });

  /* ── Relatórios PDV ── */
  const [modalRelatorios, setModalRelatorios] = useState(false);
  const [abaRelatorio, setAbaRelatorio] = useState<"vendas" | "cupons" | "itens" | "sangrias" | "ranking" | "fiado">("vendas");
  const [relVendas, setRelVendas]       = useState<any[]>([]);
  const [relCupons, setRelCupons]       = useState<any[]>([]);
  const [relItens, setRelItens]         = useState<any[]>([]);
  const [relSangrias, setRelSangrias]   = useState<any[]>([]);
  const [relRanking, setRelRanking]     = useState<{ nome: string; totalQtd: number; totalReceita: number }[]>([]);
  const [relFiado, setRelFiado]         = useState<any[]>([]);
  const [filtroFiado, setFiltroFiado]   = useState("");
  const [carregandoRel, setCarregandoRel] = useState(false);
  const [carregandoRankingRel, setCarregandoRankingRel] = useState(false);
  const [erroRelatorio, setErroRelatorio] = useState<string | null>(null);
  const [dataInicioRel, setDataInicioRel] = useState(() => new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [dataFimRel, setDataFimRel]       = useState(() => new Date().toISOString().slice(0, 10));

  /* ── Fechamento de caixa ── */
  const [modalFechamento, setModalFechamento]   = useState(false);
  const [fechamentoData, setFechamentoData]     = useState<{
    totalVendas: number; totalDinheiro: number; totalPix: number; totalCartao: number;
    totalSangrias: number; saldoFinal: number; qtdVendas: number;
  } | null>(null);
  const [carregandoFechamento, setCarregandoFechamento] = useState(false);
  const [fechandoCaixa, setFechandoCaixa]       = useState(false);
  const [etapaFechamento, setEtapaFechamento]   = useState<"gaveta" | "resumo">("gaveta");
  const [valorGaveta, setValorGaveta]           = useState("");
  const [obsFechamento, setObsFechamento]       = useState("");
  const refValorGaveta                          = useRef<HTMLInputElement>(null);

  /* ── Abertura de caixa ── */
  const [modalAbrirCaixa, setModalAbrirCaixa]   = useState(false);
  const [valorAbertura, setValorAbertura]         = useState("");
  const [valorAberturaNum, setValorAberturaNum]   = useState(0);
  const refValorAbertura                          = useRef<HTMLInputElement>(null);

  /* ── Trava de caixa alto ── */
  const LIMITE_SANGRIA = 300;
  const [travaCaixa, setTravaCaixa] = useState(false);

  // valores derivados do fechamento (evita IIFE no JSX)
  const gavetaNum   = parseFloat(valorGaveta.replace(",", ".")) || 0;
  // esperadoGav inclui o fundo de abertura do caixa
  const esperadoGav = (fechamentoData?.totalDinheiro ?? 0) - (fechamentoData?.totalSangrias ?? 0) + valorAberturaNum;
  const difGav      = gavetaNum - esperadoGav;

  /* ── Fiado ── */
  const [clienteFiado, setClienteFiado]         = useState<{ id: string; nome: string; limite_credito?: number } | null>(null);
  const [buscandoFiado, setBuscandoFiado]       = useState(false);
  const [erroFiado, setErroFiado]               = useState("");
  const [buscaFiado, setBuscaFiado]             = useState("");
  const [resultadosFiado, setResultadosFiado]   = useState<{ id: string; nome: string; limite_credito?: number }[]>([]);

  /* ── Recebimento de fiado ── */
  const [modalReceberFiado, setModalReceberFiado]     = useState(false);
  const [clienteReceberFiado, setClienteReceberFiado] = useState<{ id: string; nome: string } | null>(null);
  const [saldoDevedor, setSaldoDevedor]               = useState(0);
  const [valorPagamento, setValorPagamento]           = useState("");
  const [obsPagamento, setObsPagamento]               = useState("");
  const [salvandoPagamento, setSalvandoPagamento]     = useState(false);
  const [listaClientesFiado, setListaClientesFiado]   = useState<{ id: string; nome: string }[]>([]);
  const [buscaClienteRec, setBuscaClienteRec]         = useState("");

  /* ── Seleção / cadastro de cliente no fiado ── */
  const [modalSelecionarCliente, setModalSelecionarCliente] = useState(false);
  const [modalNovoCliente, setModalNovoCliente] = useState(false);
  const [novoCliNome, setNovoCliNome]           = useState("");
  const [novoCliTelefone, setNovoCliTelefone]   = useState("");
  const [novoCliCpf, setNovoCliCpf]             = useState("");
  const [novoCliCep, setNovoCliCep]             = useState("");
  const [novoCliLimite, setNovoCliLimite]       = useState("");
  const [novoCliEndereco, setNovoCliEndereco]   = useState("");
  const [novoCliNumero, setNovoCliNumero]        = useState("");
  const [buscandoCep, setBuscandoCep]           = useState(false);
  const [salvandoNovoCli, setSalvandoNovoCli]   = useState(false);

  /* ── Buscar cupons ── */
  const [modalCupons, setModalCupons]           = useState(false);
  const [cupons, setCupons]                     = useState<any[]>([]);
  const [filtroData, setFiltroData]             = useState("");
  const [filtroCPF, setFiltroCPF]               = useState("");
  const [carregandoCupons, setCarregandoCupons] = useState(false);
  const refFiltroCPF                            = useRef<HTMLInputElement>(null);

  /* ── Refs de foco ── */
  const refCodigo    = useRef<HTMLInputElement>(null);
  const refQtd       = useRef<HTMLInputElement>(null);
  const refPrecoUnit = useRef<HTMLInputElement>(null);

  /* ── Verifica se o caixa está aberto (roda apenas no cliente) ── */
  useEffect(() => {
    const aberto = localStorage.getItem("pdv_caixa_aberto");
    const vAb    = Number(localStorage.getItem("pdv_valor_abertura") || "0");
    setValorAberturaNum(vAb);
    if (aberto !== "true") {
      setModalAbrirCaixa(true);
      setTimeout(() => refValorAbertura.current?.focus(), 350);
    }
  }, []);

  /* ── Trava automática quando caixa ultrapassa limite ── */
  useEffect(() => {
    if (totalCaixa >= LIMITE_SANGRIA && !modalAbrirCaixa) setTravaCaixa(true);
    else if (totalCaixa < LIMITE_SANGRIA)                 setTravaCaixa(false);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCaixa, modalAbrirCaixa]);

  /* ── Carrega operador e logo na montagem ── */
  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.sessionStorage.getItem("operador_logado") : null;
    if (raw) {
      try { setOperador(JSON.parse(raw)); } catch {}
    }
  }, []);

  /* ── Recarrega permissões do banco para garantir dados frescos ── */
  const carregarPermissoes = useCallback(async (username: string) => {
    const { data } = await db("operadores")
      .select("id, nome, username, perm_finalizar, perm_cancelar_item, perm_cancelar_venda, perm_sangria, perm_relatorios, perm_desconto, perm_buscar_cupons")
      .eq("username", username)
      .maybeSingle();
    if (data) setOperador((prev) => ({ ...prev, ...data } as Operador));
  }, []);

  useEffect(() => {
    if (operador?.username) carregarPermissoes(operador.username);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operador?.username]);

  const carregarLogo = useCallback(async () => {
    const { data } = await db("empresa")
      .select("logo_url, nome_fantasia, cnpj, telefone, endereco, cupom_largura, cupom_cabecalho, cupom_rodape")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data?.logo_url) setLogoSrc(data.logo_url as string);
    if (data) setCupomCfg({
      largura:   Number(data.cupom_largura)  || 80,
      cabecalho: String(data.cupom_cabecalho || ""),
      rodape:    String(data.cupom_rodape    || ""),
      nome:      String(data.nome_fantasia   || ""),
      cnpj:      String(data.cnpj            || ""),
      endereco:  String(data.endereco        || ""),
      telefone:  String(data.telefone        || ""),
    });
  }, []);

  useEffect(() => {
    carregarLogo();
  }, [carregarLogo]);

  /* ── Carrega senha ADM ── */
  const carregarSenhaAdm = useCallback(async () => {
    const { data } = await db("senhas_operacionais")
      .select("adm_password")
      .limit(1)
      .maybeSingle();
    if (data?.adm_password) setSenhaAdmConfig(data.adm_password as string);
  }, []);

  useEffect(() => { carregarSenhaAdm(); }, [carregarSenhaAdm]);

  /* ── Verifica permissão do operador (null/undefined = liberado por padrão) ── */
  function temPerm(perm: keyof Pick<Operador,
    "perm_finalizar"|"perm_cancelar_item"|"perm_cancelar_venda"|
    "perm_sangria"|"perm_relatorios"|"perm_desconto"|"perm_buscar_cupons">
  ): boolean {
    if (!operador) return false;
    const v = operador[perm];
    return v === null || v === undefined ? true : Boolean(v);
  }

  function semPermissao(acao: string) {
    setMensagem(`🚫 Sem permissão para: ${acao}. Solicite ao gerente.`);
    setTimeout(() => setMensagem(""), 4000);
  }

  /** Verifica se o plano tem acesso ao recurso. Se não, exibe aviso e retorna true (bloqueado). */
  function exigirPro(recurso: RecursoPro): boolean {
    if (temRecurso(plano, recurso)) return false;
    setMensagem("🔒 Recurso disponível apenas no Plano Pro. Pressione F12 para ativar.");
    setTimeout(() => setMensagem(""), 5000);
    return true; // bloqueado
  }

  /** Ativa uma licença digitada pelo usuário */
  async function ativarLicenca() {
    const chave = chaveInput.trim().toUpperCase();
    if (!chave) return;
    setAtivandoLicenca(true);
    setErroLicenca("");
    const status = await validarLicencaOnline(chave);
    setAtivandoLicenca(false);
    if (!status.valida) {
      setErroLicenca("Chave inválida ou expirada. Verifique e tente novamente.");
      return;
    }
    salvarChave(chave);
    salvarLicencaCache(status);
    setPlano(status.plano);
    if (status.cliente) setClienteLicenca(status.cliente);
    setModalLicenca(false);
    setChaveInput("");
    setErroLicenca("");
    setMensagem(`✅ Licença Pro ativada! Bem-vindo(a)${status.cliente ? ", " + status.cliente : ""}.`);
    setTimeout(() => setMensagem(""), 6000);
  }

  /* ── Abre modal de senha ADM ── */
  function pedirSenha(titulo: string, descricao: string, onConfirmar: () => Promise<void>) {
    setSenhaAdmInput("");
    setErroSenhaAdm("");
    setModalAdm({ titulo, descricao, onConfirmar });
    setTimeout(() => refSenhaAdm.current?.focus(), 80);
  }

  /* ── Verifica e executa ação protegida ── */
  async function confirmarSenhaAdm() {
    if (!modalAdm) return;
    if (senhaAdmInput !== senhaAdmConfig) {
      setErroSenhaAdm("Senha inválida. Tente novamente.");
      setSenhaAdmInput("");
      setTimeout(() => refSenhaAdm.current?.focus(), 30);
      return;
    }
    setSalvandoAdm(true);
    try {
      await modalAdm.onConfirmar();
      setModalAdm(null);
    } catch {
      setErroSenhaAdm("Erro ao executar a ação.");
    } finally {
      setSalvandoAdm(false);
    }
  }

  /* ── Carrega todos os produtos — offline-first ── */
  const carregarProdutos = useCallback(async () => {
    // 1. Carrega do IndexedDB primeiro (instantâneo, funciona offline)
    const local = await getProdutosLocal();
    if (local.length > 0) setTodosProdutos(local as Produto[]);

    // 2. Tenta sincronizar do Supabase em background
    const ok = await syncProdutosLocal();
    if (ok) {
      const atualizados = await getProdutosLocal();
      if (atualizados.length > 0) setTodosProdutos(atualizados as Produto[]);
    }
  }, []);

  /* ── Verificação de licença ── */
  useEffect(() => {
    inicializarLicenca().then((status) => {
      setPlano(status.plano);
      if (status.diasRestantes !== undefined) setDiasTrial(status.diasRestantes);
      if (status.cliente) setClienteLicenca(status.cliente);
      // Trial expirado sem chave → abre modal de ativação
      if (status.plano === "free" && !status.cliente) setModalLicenca(true);
    });
  }, []);

  useEffect(() => {
    carregarProdutos();
    // Conta pendentes ao montar
    countPendingVendas().then(setPendingCount);
  }, [carregarProdutos]);

  /* ── Auto-sync quando volta online ── */
  useEffect(() => {
    if (!isOnline) return;
    let ativo = true;
    (async () => {
      setSincronizando(true);
      try {
        const n = await syncPendingVendas();
        if (!ativo) return;
        if (n > 0) {
          setMensagem(`✅ ${n} venda(s) offline sincronizada(s) com sucesso!`);
          setTimeout(() => setMensagem(""), 5000);
        }
        const c = await countPendingVendas();
        if (!ativo) return;
        setPendingCount(c);
        // Resync produtos
        await carregarProdutos();
      } finally {
        if (ativo) setSincronizando(false);
      }
    })();
    return () => { ativo = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline]);

  /* ── Bloqueia fechar/atualizar com venda em aberto ── */
  const carrinhoRef = useRef(carrinho);
  carrinhoRef.current = carrinho;

  useEffect(() => {
    localStorage.setItem("pdv_carrinho", JSON.stringify(carrinho));
  }, [carrinho]);
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (carrinhoRef.current.length === 0) return;
      e.preventDefault();
      e.returnValue = "";
      return "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  /* ── Teclado global ── */
  const teclasHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  teclasHandlerRef.current = (e: KeyboardEvent) => {
    if (e.key === "F2") { e.preventDefault(); refCodigo.current?.focus(); refCodigo.current?.select(); return; }
    if (e.key === "F3") { e.preventDefault(); abrirFinalizar(); return; }
    if (e.key === "F4") { e.preventDefault(); abrirBuscarCupons(); return; }
    if (e.key === "F5") { e.preventDefault(); abrirReceberFiado(); return; }
    if (e.key === "F6") { e.preventDefault(); pedirSenhaCancelarCupom(); return; }
    if (e.key === "F7") { e.preventDefault(); abrirSangria(); return; }
    if (e.key === "F8") { e.preventDefault(); abrirRelatorios(); return; }
    if (e.key === "F9") { e.preventDefault(); abrirFechamento(); return; }
    if (e.key === "F10") { e.preventDefault(); setMostrarModalCPF(true); return; }
    if (e.key === "F12") { e.preventDefault(); setModalLicenca(true); setTimeout(() => refChaveInput.current?.focus(), 80); return; }
    if (mostrarModalCPF) {
      if (e.key === "Enter") { e.preventDefault(); confirmarCPF(); }
      if (e.key === "Escape") { e.preventDefault(); fecharModalCPF(); }
    }
  };
  useEffect(() => {
    const handler = (e: KeyboardEvent) => teclasHandlerRef.current(e);
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  /* ── Teclado do modal finalizar ── */
  const subtipoCartaoRef = useRef(subtipoCartao);
  subtipoCartaoRef.current = subtipoCartao;
  const tipoPagamentoRef = useRef(tipoPagamento);
  tipoPagamentoRef.current = tipoPagamento;
  const modalSelecionarClienteRef = useRef(modalSelecionarCliente);
  modalSelecionarClienteRef.current = modalSelecionarCliente;
  const modalNovoClienteRef = useRef(modalNovoCliente);
  modalNovoClienteRef.current = modalNovoCliente;

  useEffect(() => {
    if (!modalFinalizar) return;
    const subtipos: Array<"debito" | "credito" | "alimentacao"> = ["debito", "credito", "alimentacao"];
    function onKey(e: KeyboardEvent) {
      // Se sub-modal de cliente estiver aberto, não interceptar teclas
      if (modalSelecionarClienteRef.current || modalNovoClienteRef.current) return;
      const k = e.key.toUpperCase();
      // Navegação entre subtipos de cartão com setas
      if (tipoPagamentoRef.current === "cartao" && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault();
        const idx = subtipos.indexOf(subtipoCartaoRef.current);
        const next = e.key === "ArrowRight"
          ? subtipos[(idx + 1) % subtipos.length]
          : subtipos[(idx - 1 + subtipos.length) % subtipos.length];
        setSubtipoCartao(next);
        return;
      }
      if (k === "D") { e.preventDefault(); selecionarPagamento("dinheiro"); }
      else if (k === "P") { e.preventDefault(); selecionarPagamento("pix"); }
      else if (k === "C") { e.preventDefault(); selecionarPagamento("cartao"); }
      else if (k === "F" && temRecurso(plano, "fiado")) { e.preventDefault(); selecionarPagamento("fiado"); }
      else if (e.key === "Enter") { e.preventDefault(); confirmarVenda(); }
      else if (e.key === "Escape") { e.preventDefault(); setModalFinalizar(false); }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalFinalizar, plano]);

  /* ── CPF ── */
  async function confirmarCPF() {
    const limpo = cpf.replace(/\D/g, "");
    if (limpo && !validarCPF(limpo)) {
      setMensagem("⚠️ CPF inválido. Verifique e tente novamente.");
      setTimeout(() => setMensagem(""), 4000);
      return;
    }
    if (!limpo) {
      setClienteLabel("Sem cliente identificado");
      setMostrarModalCPF(false);
      setTimeout(() => refQtd.current?.focus(), 50);
      return;
    }
    // Busca cliente pelo CPF no banco
    const { data } = await db("clientes").select("id, nome, cpf").eq("cpf", formatarCPF(limpo)).maybeSingle();
    if (data) {
      // Cliente encontrado
      setClienteLabel(`${(data as {nome: string}).nome} — ${formatarCPF(limpo)}`);
    } else {
      // Não encontrado → perguntar se quer cadastrar
      setCpfNaoEncontrado(limpo);
      setPedirCadastroCPF(true);
      return;
    }
    setMostrarModalCPF(false);
    setTimeout(() => refQtd.current?.focus(), 50);
  }

  function fecharModalCPF() {
    setCpf("");
    setClienteLabel("Sem cliente identificado");
    setMostrarModalCPF(false);
    setPedirCadastroCPF(false);
    setCpfNaoEncontrado("");
    setTimeout(() => refQtd.current?.focus(), 50);
  }

  /* ── Autocomplete: filtra produtos ao digitar ── */
  function aoDigitarBusca(valor: string) {
    setCodigoBusca(valor);
    setProdutoSelecionado(null);   // usuário digitou de novo → limpa seleção anterior
    setSugestaoIdx(-1);

    const termo = valor.trim().toLowerCase();
    if (termo.length < 3) { setSugestoes([]); return; }

    const filtrado = todosProdutos.filter((p) =>
      p.nome.toLowerCase().startsWith(termo) ||
      (p.codigo && p.codigo.toLowerCase().startsWith(termo)) ||
      (p.ean   && p.ean.startsWith(termo))
    ).slice(0, 8);

    setSugestoes(filtrado);
  }

  /* ── Navegar no dropdown com ↑ ↓ Escape Enter ── */
  function onKeyDownBusca(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setSugestaoIdx((i) => Math.min(i + 1, sugestoes.length - 1)); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setSugestaoIdx((i) => Math.max(i - 1, -1)); return; }
    if (e.key === "Escape")    { setSugestoes([]); setSugestaoIdx(-1); return; }
    // Enter com dropdown aberto → seleciona produto e vai para quantidade
    if (e.key === "Enter" && sugestoes.length > 0) {
      e.preventDefault();
      const idx = sugestaoIdx >= 0 ? sugestaoIdx : 0;
      selecionarSugestao(sugestoes[idx]);
    }
  }

  /* ── Seleciona produto do dropdown (não lança ainda — vai para qty) ── */
  function selecionarSugestao(produto: Produto) {
    setMensagem("");
    setProdutoSelecionado(produto);
    setCodigoBusca(produto.nome);
    // Pré-preenche preço unitário com o valor cadastrado
    setPrecoUnitario(String((produto.preco ?? 0).toFixed(2)).replace(".", ","));
    setSugestoes([]);
    setSugestaoIdx(-1);
    // Produto selecionado → foco vai direto para o preço unitário
    setTimeout(() => { refPrecoUnit.current?.focus(); refPrecoUnit.current?.select(); }, 30);
  }

  /* ── Enter no peso/quantidade → vai para o campo de produto ── */
  function onKeyDownQtd(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      refCodigo.current?.focus();
      refCodigo.current?.select();
    }
  }

  /* ── Preço total calculado em tempo real ── */
  const precoTotalLinha = useMemo(() => {
    const qtd  = parseFloat(quantidade.replace(",", ".")) || 0;
    const unit = parseFloat((precoUnitario || "0").replace(",", ".")) || 0;
    return qtd * unit;
  }, [quantidade, precoUnitario]);

  /* ── Confirma e lança no carrinho ── */
  function confirmarLancamento(produto: Produto) {
    const qtd   = parseFloat(quantidade.replace(",", ".")) || 1;
    const preco = parseFloat((precoUnitario || "0").replace(",", ".")) || (produto.preco ?? 0);

    setCarrinho((prev) => {
      const existente = prev.find((i) => i.produto.id === produto.id && i.precoUnitario === preco);
      if (existente) {
        return prev.map((i) => i.id === existente.id ? { ...i, quantidade: i.quantidade + qtd } : i);
      }
      return [...prev, { id: crypto.randomUUID(), produto, quantidade: qtd, precoUnitario: preco }];
    });

    setCodigoBusca("");
    setProdutoSelecionado(null);
    setQuantidade("1");
    setPrecoUnitario("");
    setSugestoes([]);
    setSugestaoIdx(-1);
    // Após lançar → volta para o campo de peso (início do fluxo)
    setTimeout(() => { refQtd.current?.focus(); refQtd.current?.select(); }, 30);
  }

  /* ── Busca produto por código/EAN (leitor de barras) ── */
  async function buscarProdutoAPI(): Promise<Produto | null> {
    const termo = codigoBusca.trim();
    if (!termo) return null;
    const { data } = await db("produtos")
      .select("id, nome, codigo, ean, preco, preco_cartao, unidade")
      .or(`codigo.eq.${termo},ean.eq.${termo}`)
      .limit(1)
      .maybeSingle();
    return data as Produto | null;
  }

  /* ── Submit do formulário (Enter no preço unitário ou botão) ── */
  async function adicionarItem(e?: React.FormEvent) {
    e?.preventDefault();
    setMensagem("");

    // Produto já selecionado pelo dropdown
    if (produtoSelecionado) {
      confirmarLancamento(produtoSelecionado);
      return;
    }

    // Leitor de barras ou digitação direta: busca exata na API
    const produto = await buscarProdutoAPI();
    if (!produto) {
      setMensagem(`Produto "${codigoBusca}" não encontrado.`);
      return;
    }
    // Preenche preço se ainda não preenchido
    if (!precoUnitario) {
      setPrecoUnitario(String((produto.preco ?? 0).toFixed(2)).replace(".", ","));
    }
    confirmarLancamento(produto);
  }

  /* ── Remove item do carrinho (sem proteção — usado internamente) ── */
  function removerItemDireto(id: string) {
    setCarrinho((prev) => prev.filter((i) => i.id !== id));
  }

  /* ── Cancela item (verifica permissão, depois pede senha se necessário) ── */
  function pedirSenhaCancelarItem(itemId: string) {
    const item = carrinho.find((i) => i.id === itemId);
    if (!item) return;
    if (exigirPro("cancelar_item")) return;
    if (!temPerm("perm_cancelar_item")) { semPermissao("cancelar item"); return; }
    setMotivoInput("");
    setModalMotivo({
      titulo: "Cancelar item",
      descricao: `"${item.produto.nome}" — ${item.quantidade} × ${moedaBR(item.precoUnitario)}`,
      onConfirmar: (motivo) => {
        pedirSenha(
          "Cancelar item",
          `Cancelar "${item.produto.nome}" — ${item.quantidade} × ${moedaBR(item.precoUnitario)}?`,
          async () => {
            const basePayload = {
              operador:     nomeOperador,
              produto_nome: item.produto.nome,
              quantidade:   item.quantidade,
              motivo:       motivo || "Cancelado pelo operador no PDV",
            };
            let r = await db("itens_cancelados").insert([{ ...basePayload, preco: item.precoUnitario }]);
            if (r.error?.message?.toLowerCase().includes("preco")) {
              r = await db("itens_cancelados").insert([{ ...basePayload, valor: item.precoUnitario }]);
            }
            if (r.error?.message?.toLowerCase().includes("valor")) {
              r = await db("itens_cancelados").insert([basePayload]);
            }
            if (r.error) {
              setMensagem(`⚠️ Erro ao registrar cancelamento: ${r.error.message}`);
              setTimeout(() => setMensagem(""), 6000);
            }
            removerItemDireto(itemId);
          }
        );
      },
    });
    setTimeout(() => refMotivo.current?.focus(), 80);
  }

  /* ── Cancela cupom inteiro (verifica permissão) ── */
  function pedirSenhaCancelarCupom() {
    if (carrinho.length === 0) return;
    if (exigirPro("cancelar_venda")) return;
    if (!temPerm("perm_cancelar_venda")) { semPermissao("cancelar cupom"); return; }
    setMotivoInput("");
    setModalMotivo({
      titulo: "Cancelar cupom",
      descricao: `Cupom com ${totalItens} itens — Total ${moedaBR(totalGeral)}`,
      onConfirmar: (motivo) => {
        pedirSenha(
          "Cancelar cupom",
          `Cancelar cupom com ${totalItens} itens — Total ${moedaBR(totalGeral)}?`,
          async () => {
            await db("cupons_cancelados").insert([{
              operador: nomeOperador,
              total:    totalGeral,
              motivo:   motivo || "Cancelado pelo operador no PDV",
            }]);
            setCarrinho([]);
            setClienteLabel("Sem cliente identificado");
            setCpf("");
            setMostrarModalCPF(true);
            setMensagem("");
          }
        );
      },
    });
    setTimeout(() => refMotivo.current?.focus(), 80);
  }

  /* ── Sangria ── */
  async function confirmarSangria() {
    const valor = parseFloat(valorSangria.replace(",", "."));
    if (!valor || valor <= 0) return;
    setSalvandoSangria(true);

    let r = await db("sangrias").insert([{ operador: nomeOperador, valor, observacao: obsSangria || null }]);
    // Se a coluna "observacao" não existe, tenta sem ela
    if (r.error?.message?.toLowerCase().includes("observac")) {
      r = await db("sangrias").insert([{ operador: nomeOperador, valor }]);
    }
    if (r.error) {
      const msg = r.error.message.toLowerCase().includes("row-level security") || r.error.message.toLowerCase().includes("rls")
        ? "⚠️ Sangria bloqueada pelo Supabase (RLS). No Supabase, execute: ALTER TABLE sangrias DISABLE ROW LEVEL SECURITY;"
        : `⚠️ Erro ao registrar sangria: ${r.error.message}`;
      setMensagem(msg);
      setTimeout(() => setMensagem(""), 10000);
    }

    const novoTotal = Math.max(0, totalCaixa - valor);
    setTotalCaixa(novoTotal);
    localStorage.setItem("pdv_total_caixa", String(novoTotal));
    setModalSangria(false);
    setValorSangria("");
    setObsSangria("");
    setSalvandoSangria(false);
  }

  function abrirSangria() {
    if (exigirPro("sangria")) return;
    if (!temPerm("perm_sangria")) { semPermissao("realizar sangria"); return; }
    pedirSenha(
      "Autorizar sangria",
      totalCaixa >= 300
        ? `⚠️ Caixa com ${moedaBR(totalCaixa)} — acima do limite. Informe a senha para retirar.`
        : "Informe a senha ADM para registrar a sangria.",
      async () => { setModalSangria(true); }
    );
  }

  /* ── Carrega dados dos relatórios ── */
  async function buscarRelatorios(inicio: string, fim: string) {
    setErroRelatorio(null);
    setCarregandoRel(true);
    try {
      const [rV, rC, rIt, rS, rF] = await Promise.all([
        db("vendas").select("id, total, tipo_pagamento, created_at, cliente_cpf")
          .gte("created_at", inicio).lte("created_at", fim + "T23:59:59")
          .order("created_at", { ascending: false }).limit(500),
        db("cupons_cancelados").select("*")
          .gte("created_at", inicio).lte("created_at", fim + "T23:59:59")
          .order("created_at", { ascending: false }).limit(500),
        db("itens_cancelados").select("*")
          .gte("created_at", inicio).lte("created_at", fim + "T23:59:59")
          .order("created_at", { ascending: false }).limit(500),
        db("sangrias").select("*")
          .gte("created_at", inicio).lte("created_at", fim + "T23:59:59")
          .order("created_at", { ascending: false }).limit(500),
        db("vendas").select("id, total, created_at, cliente_nome, cliente_cpf, cliente_id")
          .ilike("tipo_pagamento", "fiado")
          .gte("created_at", inicio).lte("created_at", fim + "T23:59:59")
          .order("created_at", { ascending: false }).limit(500),
      ]);
      const erros = [
        rV.error  && `vendas: ${rV.error.message}`,
        rC.error  && `cupons_cancelados: ${rC.error.message}`,
        rIt.error && `itens_cancelados: ${rIt.error.message}`,
        rS.error  && `sangrias: ${rS.error.message}`,
      ].filter(Boolean);
      if (erros.length) setErroRelatorio(erros.join(" | "));
      setRelVendas(rV.data  || []);
      setRelCupons(rC.data  || []);
      setRelItens(rIt.data  || []);
      setRelSangrias(rS.data || []);
      setRelFiado(rF.data || []);

      // Ranking
      setCarregandoRankingRel(true);
      try {
        const ids: string[] = (rV.data || []).map((v: any) => v.id);
        if (ids.length > 0) {
          const { data: itensVenda, error: erroItens } = await (db("itens_venda").select("produto_nome, quantidade, preco") as any).in("venda_id", ids);
          if (erroItens) throw new Error(erroItens.message);
          const mapa: Record<string, { nome: string; totalQtd: number; totalReceita: number }> = {};
          for (const item of (itensVenda || []) as any[]) {
            const nome = item.produto_nome || "Sem nome";
            if (!mapa[nome]) mapa[nome] = { nome, totalQtd: 0, totalReceita: 0 };
            mapa[nome].totalQtd += Number(item.quantidade || 0);
            mapa[nome].totalReceita += Number(item.quantidade || 0) * Number(item.preco || 0);
          }
          setRelRanking(Object.values(mapa).sort((a, b) => b.totalQtd - a.totalQtd));
        } else {
          setRelRanking([]);
        }
      } catch (exRanking: any) {
        setErroRelatorio((prev) => prev ? prev + " | ranking: " + exRanking.message : "ranking: " + exRanking.message);
        setRelRanking([]);
      } finally {
        setCarregandoRankingRel(false);
      }
    } catch (ex: any) {
      setErroRelatorio(ex?.message || "Erro inesperado ao carregar relatórios");
    }
    setCarregandoRel(false);
  }

  function imprimirRelatorio() {
    const nomeAba =
      abaRelatorio === "vendas"   ? "Vendas"
      : abaRelatorio === "cupons"  ? "Cupons Cancelados"
      : abaRelatorio === "itens"   ? "Itens Cancelados"
      : abaRelatorio === "sangrias"? "Sangrias"
      : abaRelatorio === "ranking" ? "Itens Mais Vendidos"
      : "Fiado";

    const periodo = `${dataInicioRel.split("-").reverse().join("/")} a ${dataFimRel.split("-").reverse().join("/")}`;
    const fmt = (d: string) => new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

    let corpoHtml = "";

    if (abaRelatorio === "vendas") {
      corpoHtml = `<table><thead><tr><th>Cupom</th><th>Data/Hora</th><th>Pagamento</th><th>Cliente</th><th>Total</th></tr></thead><tbody>
        ${relVendas.map(r => `<tr><td>#${String(r.id).slice(0,8).toUpperCase()}</td><td>${fmt(r.created_at)}</td><td>${r.tipo_pagamento||"—"}</td><td>${r.cliente_cpf||"—"}</td><td class="r">${moedaBR(r.total||0)}</td></tr>`).join("")}
        <tr class="total"><td colspan="4"><b>Total</b></td><td class="r"><b>${moedaBR(relVendas.reduce((s,r)=>s+Number(r.total||0),0))}</b></td></tr>
      </tbody></table>`;
    } else if (abaRelatorio === "cupons") {
      corpoHtml = `<table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Total</th><th>Motivo</th></tr></thead><tbody>
        ${relCupons.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${r.operador||"—"}</td><td class="r">${moedaBR(r.total||0)}</td><td>${r.motivo||"—"}</td></tr>`).join("")}
        <tr class="total"><td colspan="2"><b>Total cancelado</b></td><td class="r"><b>${moedaBR(relCupons.reduce((s,r)=>s+Number(r.total||0),0))}</b></td><td></td></tr>
      </tbody></table>`;
    } else if (abaRelatorio === "itens") {
      corpoHtml = `<table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Produto</th><th>Qtd</th><th>Total</th><th>Motivo</th></tr></thead><tbody>
        ${relItens.map(r => { const p=r.preco??r.valor??0; return `<tr><td>${fmt(r.created_at)}</td><td>${r.operador||"—"}</td><td>${r.produto_nome||"—"}</td><td class="r">${r.quantidade??""}</td><td class="r">${moedaBR((r.quantidade??0)*p)}</td><td>${r.motivo||"—"}</td></tr>`; }).join("")}
      </tbody></table>`;
    } else if (abaRelatorio === "sangrias") {
      corpoHtml = `<table><thead><tr><th>Data/Hora</th><th>Operador</th><th>Valor</th><th>Observação</th></tr></thead><tbody>
        ${relSangrias.map(r => `<tr><td>${fmt(r.created_at)}</td><td>${r.operador||"—"}</td><td class="r">${moedaBR(r.valor||0)}</td><td>${r.observacao||"—"}</td></tr>`).join("")}
        <tr class="total"><td colspan="2"><b>Total</b></td><td class="r"><b>${moedaBR(relSangrias.reduce((s,r)=>s+Number(r.valor||0),0))}</b></td><td></td></tr>
      </tbody></table>`;
    } else if (abaRelatorio === "ranking") {
      corpoHtml = `<table><thead><tr><th>#</th><th>Produto</th><th>Qtd</th><th>Receita</th></tr></thead><tbody>
        ${relRanking.map((item,idx) => `<tr><td>${idx+1}</td><td>${item.nome}</td><td class="r">${item.totalQtd % 1 === 0 ? item.totalQtd : item.totalQtd.toFixed(3)}</td><td class="r">${moedaBR(item.totalReceita)}</td></tr>`).join("")}
      </tbody></table>`;
    } else if (abaRelatorio === "fiado") {
      const termo = filtroFiado.toLowerCase().trim();
      const fiadoFiltrado = termo ? relFiado.filter(r => (r.cliente_nome||"").toLowerCase().includes(termo)) : relFiado;
      const porCliente: Record<string, {nome:string;total:number;cupons:any[]}> = {};
      for (const r of fiadoFiltrado) {
        const nome = r.cliente_nome||"Sem nome";
        if (!porCliente[nome]) porCliente[nome] = {nome,total:0,cupons:[]};
        porCliente[nome].total += Number(r.total||0);
        porCliente[nome].cupons.push(r);
      }
      corpoHtml = Object.values(porCliente).sort((a,b)=>a.nome.localeCompare(b.nome)).map(cli => `
        <h3 style="margin:16px 0 4px;background:#1e3a5f;color:#fff;padding:6px 10px;border-radius:4px;display:flex;justify-content:space-between">
          <span>${cli.nome}</span><span>${moedaBR(cli.total)}</span>
        </h3>
        <table><thead><tr><th>Cupom</th><th>Data/Hora</th><th class="r">Valor</th></tr></thead><tbody>
          ${cli.cupons.map((r:any)=>`<tr><td>#${String(r.id).slice(0,8).toUpperCase()}</td><td>${fmt(r.created_at)}</td><td class="r">${moedaBR(r.total||0)}</td></tr>`).join("")}
        </tbody></table>`).join("") +
        `<p style="text-align:right;font-weight:bold;font-size:15px;margin-top:12px">Total geral: ${moedaBR(fiadoFiltrado.reduce((s:number,r:any)=>s+Number(r.total||0),0))}</p>`;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${nomeAba} — ${periodo}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #000; padding: 20px; }
      h1 { font-size: 18px; margin: 0 0 4px; }
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

    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 400);
  }

  async function abrirRelatorios() {
    if (exigirPro("relatorios")) return;
    if (!temPerm("perm_relatorios")) { semPermissao("ver relatórios"); return; }
    setModalRelatorios(true);
    await buscarRelatorios(dataInicioRel, dataFimRel);
  }

  /* ── Fechamento de caixa ── */
  async function abrirFechamento() {
    if (exigirPro("fechamento_caixa")) return;
    if (!temPerm("perm_relatorios")) { semPermissao("fechar caixa"); return; }
    pedirSenha("Fechar Caixa", "Informe a senha ADM para conferir e fechar o caixa.", async () => {
      setModalFechamento(true);
      setCarregandoFechamento(true);
      setEtapaFechamento("gaveta");
      setValorGaveta("");
      setObsFechamento("");
      const hoje = new Date().toISOString().slice(0, 10);
      const { data: vendas } = await db("vendas")
        .select("total, tipo_pagamento")
        .gte("created_at", hoje + "T00:00:00")
        .lte("created_at", hoje + "T23:59:59");
      const { data: sangrias } = await db("sangrias")
        .select("valor")
        .gte("created_at", hoje + "T00:00:00")
        .lte("created_at", hoje + "T23:59:59");
      const vs = vendas || [];
      const totalVendas   = vs.reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const totalDinheiro = vs.filter((v: any) => (v.tipo_pagamento || "").toLowerCase() === "dinheiro").reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const totalPix      = vs.filter((v: any) => (v.tipo_pagamento || "").toLowerCase() === "pix").reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const totalCartao   = vs.filter((v: any) => ["cartão","cartao"].includes((v.tipo_pagamento || "").toLowerCase())).reduce((s: number, v: any) => s + Number(v.total || 0), 0);
      const totalSangrias = (sangrias || []).reduce((s: number, sg: any) => s + Number(sg.valor || 0), 0);
      setFechamentoData({
        totalVendas, totalDinheiro, totalPix, totalCartao,
        totalSangrias, saldoFinal: totalCaixa, qtdVendas: vs.length,
      });
      setCarregandoFechamento(false);
      // Foca o campo valor gaveta após carregar
      setTimeout(() => refValorGaveta.current?.focus(), 100);
    });
  }

  async function confirmarFechamento() {
    if (fechandoCaixa) return;
    setFechandoCaixa(true);
    await db("fechamentos_caixa").insert([{
      operador:        nomeOperador,
      total_vendas:    fechamentoData?.totalVendas   ?? 0,
      total_dinheiro:  fechamentoData?.totalDinheiro ?? 0,
      total_pix:       fechamentoData?.totalPix      ?? 0,
      total_cartao:    fechamentoData?.totalCartao   ?? 0,
      total_sangrias:  fechamentoData?.totalSangrias ?? 0,
      saldo_final:     fechamentoData?.saldoFinal    ?? 0,
      qtd_vendas:      fechamentoData?.qtdVendas     ?? 0,
      valor_gaveta:    gavetaNum,
      diferenca_gaveta: difGav,
      obs:             obsFechamento.trim() || null,
    }]);
    setTotalCaixa(0);
    setValorAberturaNum(0);
    localStorage.setItem("pdv_total_caixa",    "0");
    localStorage.removeItem("pdv_caixa_aberto");
    localStorage.removeItem("pdv_valor_abertura");
    setModalFechamento(false);
    setFechamentoData(null);
    setFechandoCaixa(false);
    setEtapaFechamento("gaveta");
    setValorGaveta("");
    setObsFechamento("");
    setMensagem("✅ Caixa fechado com sucesso!");
    setTimeout(() => setMensagem(""), 4000);
  }

  /* ── Buscar cupons ── */
  async function abrirBuscarCupons() {
    if (exigirPro("buscar_cupons")) return;
    if (!temPerm("perm_buscar_cupons")) { semPermissao("buscar cupons"); return; }
    setModalCupons(true);
    setFiltroData(new Date().toISOString().slice(0, 10)); // hoje por padrão
    setFiltroCPF("");
    await carregarCupons("", new Date().toISOString().slice(0, 10));
    setTimeout(() => refFiltroCPF.current?.focus(), 80);
  }

  async function reimprimirCupomDoBanco(venda: any) {
    // Busca itens da venda no banco
    const { data: itensDB } = await db("itens_venda")
      .select("produto_nome, quantidade, preco")
      .eq("venda_id", venda.id);

    const itens: { nome: string; quantidade: number; precoUnitario: number }[] =
      (itensDB || []).map((r: any) => ({
        nome:          r.produto_nome || "Produto",
        quantidade:    Number(r.quantidade),
        precoUnitario: Number(r.preco),
      }));

    // Reconstrói totais a partir dos itens (ou usa dados da venda se itens vazios)
    const totalGeral = itens.length > 0
      ? itens.reduce((s, i) => s + i.quantidade * i.precoUnitario, 0)
      : (venda.total || 0) + (venda.desconto || 0);

    const dtVenda = new Date(venda.created_at);
    const dataHora = dtVenda.toLocaleDateString("pt-BR") + "  " +
      dtVenda.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

    const cpfFormatado = venda.cliente_cpf
      ? String(venda.cliente_cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
      : "";

    imprimirCupom({
      itens,
      totalGeral,
      descontoVal:     Number(venda.desconto || 0),
      totalFinal:      Number(venda.total || 0),
      tipoPagamento:   venda.tipo_pagamento || "—",
      valorRecebidoVal: Number(venda.valor_recebido || venda.total || 0),
      troco:           Number(venda.troco || 0),
      nomeOperador:    venda.operador || "—",
      clienteLabel:    cpfFormatado || "Sem cliente",
      cpf:             cpfFormatado,
      dataHora,
      reimpressao:     true,
    });
  }

  async function carregarCupons(cpf: string, data: string) {
    setCarregandoCupons(true);
    let q = db("vendas")
      .select("id, created_at, total, tipo_pagamento, operador, desconto, troco, valor_recebido, cliente_cpf")
      .order("created_at", { ascending: false })
      .limit(60);
    if (cpf.replace(/\D/g, "")) q = q.eq("cliente_cpf", cpf.replace(/\D/g, ""));
    if (data) {
      q = q.gte("created_at", data + "T00:00:00")
           .lte("created_at", data + "T23:59:59");
    }
    const { data: rows } = await q;
    setCupons(rows || []);
    setCarregandoCupons(false);
  }

  /* ── Totais ── */
  const totalItens = useMemo(() => carrinho.length, [carrinho]);

  const totalGeral = useMemo(
    () => carrinho.reduce((acc, i) => acc + i.quantidade * i.precoUnitario, 0),
    [carrinho]
  );

  const nomeOperador = operador?.nome || operador?.username || "—";

  /* ── Computados do finalizar ── */
  const descontoVal = useMemo(() => {
    const n = parseFloat((desconto || "0").replace(",", ".")) || 0;
    if (tipoDesconto === "%") return Math.min(totalGeral, totalGeral * n / 100);
    return Math.min(totalGeral, n);
  }, [desconto, tipoDesconto, totalGeral]);

  const totalFinal = useMemo(
    () => Math.max(0, totalGeral - descontoVal),
    [totalGeral, descontoVal]
  );
  const valorRecebidoVal = useMemo(
    () => parseFloat((valorRecebido || "0").replace(",", ".")) || 0,
    [valorRecebido]
  );
  const troco = useMemo(
    () => Math.max(0, valorRecebidoVal - totalFinal),
    [valorRecebidoVal, totalFinal]
  );

  /* ── Gera e imprime o cupom numa janela popup ── */
  type ItensCupom = { nome: string; quantidade: number; precoUnitario: number };

  function imprimirCupom(dados: {
    itens: ItensCupom[]; totalGeral: number; descontoVal: number; totalFinal: number;
    tipoPagamento: string; valorRecebidoVal: number; troco: number;
    nomeOperador: string; clienteLabel: string; cpf: string;
    dataHora?: string; // opcional – se não passado usa "agora"
    reimpressao?: boolean;
  }) {
    const mm  = cupomCfg.largura;                    // 58 ou 80
    const pt  = mm === 58 ? "8pt" : "9pt";           // tamanho de fonte
    const ptG = mm === 58 ? "11pt" : "13pt";         // fonte do TOTAL
    // largura interna = papel − margens (4mm cada lado)
    const interno = `${mm - 8}mm`;

    const cab = (cupomCfg.cabecalho || cupomCfg.nome || "")
      .split("\n")
      .map((l) => `<div class="c">${l}</div>`)
      .join("");

    const rod = (cupomCfg.rodape || "")
      .split("\n")
      .map((l) => `<div class="c">${l}</div>`)
      .join("");

    const dtStr = dados.dataHora ?? (() => {
      const agora = new Date();
      return agora.toLocaleDateString("pt-BR") + "  " +
        agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    })();

    const semItens = dados.itens.length === 0;
    const itensHtml = semItens
      ? `<tr><td colspan="4" style="text-align:center;padding:4px;color:#888;font-style:italic">Itens não registrados</td></tr>`
      : dados.itens.map((item) => {
          const qtd = item.quantidade % 1 === 0
            ? String(item.quantidade)
            : item.quantidade.toFixed(3);
          return `<tr>
            <td class="nome">${item.nome}</td>
            <td class="r">${qtd}</td>
            <td class="r">${moedaBR(item.precoUnitario)}</td>
            <td class="r b">${moedaBR(item.quantidade * item.precoUnitario)}</td>
          </tr>`;
        }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page {
    size: ${mm}mm auto;
    margin: 4mm;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: ${interno};
    font-family: 'Courier New', Courier, monospace;
    font-size: ${pt};
    color: #000;
    line-height: 1.6;
  }
  .c  { text-align: center; }
  .r  { text-align: right; }
  .b  { font-weight: bold; }
  hr  { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  /* tabela de itens */
  table { width: 100%; border-collapse: collapse; }
  td    { padding: 1px 2px; vertical-align: top; }
  .nome { width: 45%; word-break: break-word; }
  .r    { white-space: nowrap; }
  /* linha de totais */
  .tot  { display: flex; justify-content: space-between; padding: 1px 0; }
  .tot-grande { font-size: ${ptG}; font-weight: bold; }
</style>
</head><body>

${cab}
<hr>
<div class="c b">CUPOM NÃO FISCAL</div>
${dados.reimpressao ? `<div class="c b" style="font-size:${ptG}">&gt;&gt; REIMPRESSÃO &lt;&lt;</div>` : ""}
<div class="c">${dtStr}</div>
<div>Operador: ${dados.nomeOperador}</div>
${dados.cpf ? `<div>CPF: ${dados.clienteLabel}</div>` : ""}
<hr>

<table>
  <thead>
    <tr>
      <td class="nome b">ITEM</td>
      <td class="r b">QTD</td>
      <td class="r b">UNIT</td>
      <td class="r b">TOTAL</td>
    </tr>
  </thead>
  <tbody>
    ${itensHtml}
  </tbody>
</table>
<hr>

${dados.descontoVal > 0 ? `
  <div class="tot"><span>Subtotal</span><span>${moedaBR(dados.totalGeral)}</span></div>
  <div class="tot"><span>Desconto</span><span>- ${moedaBR(dados.descontoVal)}</span></div>
` : ""}
<div class="tot tot-grande"><span>TOTAL</span><span>${moedaBR(dados.totalFinal)}</span></div>
<hr>

<div class="tot"><span>Pagamento</span><span>${dados.tipoPagamento}</span></div>
${dados.tipoPagamento === "Dinheiro" ? `
  <div class="tot"><span>Recebido</span><span>${moedaBR(dados.valorRecebidoVal)}</span></div>
  <div class="tot b"><span>Troco</span><span>${moedaBR(dados.troco)}</span></div>
` : ""}
<hr>

${rod}
<hr>
<div class="c" style="font-size:7pt">Sistema Umbrela Gestão</div>
<br>
</body></html>`;

    // Impressão via iframe oculto — abre o diálogo do sistema diretamente, sem popup
    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:1px;height:1px;border:none;";
    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
      setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
    }, 400);
  }

  /* ── Cupom de fiado (com campo de assinatura) ── */
  function imprimirCupomFiado(dados: {
    itens: ItensCupom[]; totalFinal: number; descontoVal: number; totalGeral: number;
    nomeCliente: string; nomeOperador: string; dataHora?: string; cupomId?: string;
  }) {
    const mm = cupomCfg.largura;
    const pt = mm === 58 ? "8pt" : "9pt";
    const ptG = mm === 58 ? "11pt" : "13pt";
    const interno = `${mm - 8}mm`;
    const cab = (cupomCfg.cabecalho || cupomCfg.nome || "").split("\n").map((l) => `<div class="c">${l}</div>`).join("");
    const dtStr = dados.dataHora ?? (() => {
      const agora = new Date();
      return agora.toLocaleDateString("pt-BR") + "  " + agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    })();
    const itensHtml = dados.itens.map((item) => {
      const qtd = item.quantidade % 1 === 0 ? String(item.quantidade) : item.quantidade.toFixed(3);
      return `<tr>
        <td class="nome">${item.nome}</td>
        <td class="r">${qtd}</td>
        <td class="r">${moedaBR(item.precoUnitario)}</td>
        <td class="r b">${moedaBR(item.quantidade * item.precoUnitario)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: ${mm}mm auto; margin: 4mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: ${interno}; font-family: 'Courier New', Courier, monospace; font-size: ${pt}; color: #000; line-height: 1.6; }
  .c { text-align: center; } .r { text-align: right; } .b { font-weight: bold; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 1px 2px; vertical-align: top; }
  .nome { width: 45%; word-break: break-word; }
  .tot { display: flex; justify-content: space-between; padding: 1px 0; }
  .tot-grande { font-size: ${ptG}; font-weight: bold; }
  .assinatura { margin-top: 24px; border-top: 1px solid #000; padding-top: 4px; text-align: center; font-size: ${pt}; }
</style>
</head><body>
${cab}
<hr>
<div class="c b">COMPROVANTE DE FIADO</div>
<div class="c">${dtStr}</div>
${dados.cupomId ? `<div class="c">Cupom: ${dados.cupomId.slice(-8).toUpperCase()}</div>` : ""}
<hr>
<div><strong>Cliente:</strong> ${dados.nomeCliente}</div>
<div>Operador: ${dados.nomeOperador}</div>
<hr>
<table>
  <thead><tr>
    <td class="nome b">ITEM</td><td class="r b">QTD</td><td class="r b">UNIT</td><td class="r b">TOTAL</td>
  </tr></thead>
  <tbody>${itensHtml}</tbody>
</table>
<hr>
${dados.descontoVal > 0 ? `<div class="tot"><span>Subtotal</span><span>${moedaBR(dados.totalGeral)}</span></div><div class="tot"><span>Desconto</span><span>- ${moedaBR(dados.descontoVal)}</span></div>` : ""}
<div class="tot tot-grande"><span>TOTAL A PRAZO</span><span>${moedaBR(dados.totalFinal)}</span></div>
<hr>
<div class="c" style="font-size:${pt};margin-top:4px">Declaro que recebi os produtos acima descritos</div>
<div class="c" style="font-size:${pt}">e me comprometo a pagar o valor indicado.</div>
<div class="assinatura">
  <br><br><br>
  _____________________________________________<br>
  Assinatura do cliente<br>
  ${dados.nomeCliente}
</div>
<br>
<div class="c" style="font-size:7pt">Sistema Umbrela Gestão</div>
<br>
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

  /* ── Abre o caixa com fundo inicial ── */
  function abrirCaixa() {
    const valor = parseFloat(valorAbertura.replace(",", ".")) || 0;
    setTotalCaixa(valor);
    setValorAberturaNum(valor);
    localStorage.setItem("pdv_total_caixa",    String(valor));
    localStorage.setItem("pdv_caixa_aberto",   "true");
    localStorage.setItem("pdv_valor_abertura", String(valor));
    setModalAbrirCaixa(false);
    setValorAbertura("");
    if (valor > 0) {
      setMensagem(`✅ Caixa aberto — Fundo: ${moedaBR(valor)}`);
      setTimeout(() => setMensagem(""), 4000);
    }
    setTimeout(() => refQtd.current?.focus(), 80);
  }

  /* ── Seleciona tipo de pagamento (botões e teclado) ── */
  function selecionarPagamento(tipo: "dinheiro" | "pix" | "cartao" | "fiado") {
    setTipoPagamento(tipo);
    setDesconto("");
    setClienteFiado(null);
    setErroFiado("");
    setBuscaFiado("");
    setResultadosFiado([]);
    if (tipo === "fiado") {
      const cpfAtual = cpf.replace(/\D/g, "");
      if (cpfAtual.length === 11) buscarClienteFiado(cpfAtual);
    } else {
      setTimeout(() => refValorRecebido.current?.focus(), 30);
    }
  }

  /* ── Abre modal finalizar ── */
  function abrirFinalizar() {
    if (carrinho.length === 0) { setMensagem("Adicione itens antes de finalizar."); setTimeout(() => setMensagem(""), 4000); return; }
    if (!temPerm("perm_finalizar")) { semPermissao("finalizar venda"); return; }
    setDesconto("");
    setTipoDesconto("R$");
    setValorRecebido("");
    setTipoPagamento("dinheiro");
    setSubtipoCartao("debito");
    setModalFinalizar(true);
    setTimeout(() => refValorRecebido.current?.focus(), 80);
  }

  /* ── Label amigável do tipo de pagamento ── */
  const labelPagamento =
    tipoPagamento === "dinheiro" ? "Dinheiro" :
    tipoPagamento === "pix"     ? "PIX"      :
    tipoPagamento === "fiado"   ? "Fiado"    :
    subtipoCartao === "debito"  ? "Cartão Débito" :
    subtipoCartao === "credito" ? "Cartão Crédito" : "Cartão Alimentação";

  /* ── Busca cliente por CPF para fiado ── */
  async function buscarClienteFiado(cpfRaw: string) {
    const cpfLimpo = cpfRaw.replace(/\D/g, "");
    if (!cpfLimpo) { setErroFiado("Informe o CPF do cliente para fiado."); return; }
    setBuscandoFiado(true);
    setErroFiado("");
    setClienteFiado(null);
    const { data } = await db("clientes")
      .select("id, nome, limite_credito")
      .eq("cpf", cpfLimpo)
      .maybeSingle();
    setBuscandoFiado(false);
    if (!data) { setErroFiado("Cliente não encontrado. Cadastre-o antes de usar fiado."); return; }
    setClienteFiado(data as { id: string; nome: string; limite_credito: number });
  }

  // Carrega todos os clientes ao abrir o modal de seleção
  useEffect(() => {
    if (modalSelecionarCliente) {
      setBuscaFiado("");
      setResultadosFiado([]);
      buscarClienteFiadoPorNome("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalSelecionarCliente]);

  /* ── Busca cliente fiado por nome (vazio = todos) ── */
  async function buscarClienteFiadoPorNome(termo: string) {
    setBuscandoFiado(true);
    const q = db("clientes").select("id, nome, limite_credito") as any;
    const { data, error } = termo.trim()
      ? await q.ilike("nome", `%${termo.trim()}%`).limit(50)
      : await q.order("nome", { ascending: true }).limit(50);
    console.log("[fiado] clientes:", { data, error, eid: localStorage.getItem("hg_empresa_id") });
    setBuscandoFiado(false);
    if (error) setErroFiado(`Erro ao buscar clientes: ${error.message}`);
    setResultadosFiado(data || []);
  }

  /* ── Recebimento de fiado ── */
  async function abrirReceberFiado() {
    setModalReceberFiado(true);
    setClienteReceberFiado(null);
    setSaldoDevedor(0);
    setValorPagamento("");
    setObsPagamento("");
    setBuscaClienteRec("");
    // Carrega lista de clientes com saldo devedor
    const { data } = await (db("clientes").select("id, nome") as any).order("nome", { ascending: true }).limit(100);
    setListaClientesFiado(data || []);
  }

  async function selecionarClienteParaReceber(cliente: { id: string; nome: string }) {
    setClienteReceberFiado(cliente);
    // Calcula saldo: soma vendas fiado - soma pagamentos
    const [rVendas, rPag] = await Promise.all([
      (db("vendas").select("total") as any).ilike("tipo_pagamento", "fiado").eq("cliente_id", cliente.id),
      (db("pagamentos_fiado").select("valor") as any).eq("cliente_id", cliente.id),
    ]);
    const totalVendas = (rVendas.data || []).reduce((s: number, v: any) => s + Number(v.total || 0), 0);
    const totalPago   = (rPag.data   || []).reduce((s: number, v: any) => s + Number(v.valor || 0), 0);
    setSaldoDevedor(Math.max(0, totalVendas - totalPago));
    setValorPagamento("");
  }

  async function confirmarPagamentoFiado() {
    if (!clienteReceberFiado) return;
    const valor = parseFloat(valorPagamento.replace(",", "."));
    if (!valor || valor <= 0) return;
    setSalvandoPagamento(true);
    const { error } = await db("pagamentos_fiado").insert([{
      cliente_id:   clienteReceberFiado.id,
      cliente_nome: clienteReceberFiado.nome,
      valor,
      operador: nomeOperador,
      observacao: obsPagamento || null,
    }]);
    setSalvandoPagamento(false);
    if (error) { alert("Erro ao registrar pagamento: " + error.message); return; }
    // Atualiza saldo
    setSaldoDevedor(prev => Math.max(0, prev - valor));
    setValorPagamento("");
    setObsPagamento("");
    setMensagem(`✅ Pagamento de ${moedaBR(valor)} registrado para ${clienteReceberFiado.nome}`);
    setTimeout(() => setMensagem(""), 5000);
    setModalReceberFiado(false);
  }

  /* ── CEP auto-complete ── */
  async function buscarCep(cep: string) {
    const limpo = cep.replace(/\D/g, "");
    if (limpo.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${limpo}/json/`);
      const json = await res.json();
      if (!json.erro) {
        setNovoCliEndereco(`${json.logradouro || ""}, ${json.bairro || ""} — ${json.localidade || ""}/${json.uf || ""}`);
      }
    } catch { /* ignora */ }
    setBuscandoCep(false);
  }

  /* ── Salva novo cliente e já seleciona no fiado ── */
  async function salvarNovoClienteFiado(e: React.FormEvent) {
    e.preventDefault();
    if (!novoCliNome.trim()) return;
    setSalvandoNovoCli(true);
    const payload: any = {
      nome: novoCliNome.trim(),
      telefone: novoCliTelefone.trim() || null,
      cpf: novoCliCpf.replace(/\D/g, "") || null,
      cep: novoCliCep.replace(/\D/g, "") || null,
      endereco: novoCliEndereco.trim() || null,
      numero: novoCliNumero.trim() || null,
      limite_credito: novoCliLimite ? Number(novoCliLimite.replace(",", ".")) : 0,
    };
    const { data, error } = await db("clientes").insert([payload]).select().single() as any;
    setSalvandoNovoCli(false);
    if (error) { setErroFiado("Erro ao cadastrar: " + error.message); setModalNovoCliente(false); return; }
    if (data) {
      setClienteFiado({ id: data.id, nome: data.nome, limite_credito: data.limite_credito || 0 });
      setErroFiado("");
    }
    setModalNovoCliente(false);
    setNovoCliNome(""); setNovoCliTelefone(""); setNovoCliCpf("");
    setNovoCliCep(""); setNovoCliEndereco(""); setNovoCliNumero(""); setNovoCliLimite("");
  }

  /* ── Grava venda — online primeiro, offline como fallback ── */
  async function confirmarVenda() {
    if (finalizando) return;

    // Validação fiado
    if (tipoPagamento === "fiado") {
      if (!clienteFiado) { setErroFiado("Selecione um cliente para fiado ou cadastre um novo."); return; }
    }

    setFinalizando(true);
    try {
      const ehDinheiro = tipoPagamento === "dinheiro";

      // Monta os payloads uma vez só
      const vendaPayload: Record<string, unknown> = {
        total:           totalFinal,
        tipo_pagamento:  labelPagamento,
        operador:        nomeOperador,
        desconto:        descontoVal,
        valor_recebido:  ehDinheiro ? valorRecebidoVal : totalFinal,
        troco:           ehDinheiro ? troco : 0,
        cliente_cpf:     cpf.replace(/\D/g, "") || null,
        cliente_id:      tipoPagamento === "fiado" ? (clienteFiado?.id ?? null) : null,
        cliente_nome:    tipoPagamento === "fiado" ? (clienteFiado?.nome ?? null) : null,
      };

      const itensSalvos = carrinho.map((item) => ({
        produto_id:   item.produto.id,
        produto_nome: item.produto.nome,
        quantidade:   item.quantidade,
        preco:        item.precoUnitario,
      }));

      const estoqueDeltas = carrinho.map((item) => ({
        id: item.produto.id, delta: item.quantidade,
      }));

      const fiadoUpdate = (tipoPagamento === "fiado" && clienteFiado)
        ? { clienteId: clienteFiado.id, delta: totalFinal }
        : null;

      // ── Tenta gravar online ──────────────────────────────────────────────
      let gravouOnline = false;
      try {
        const { data: vendaData, error } = await db("vendas").insert([vendaPayload]).select().single();

        if (!error && vendaData?.id) {
          // Itens
          await db("itens_venda").insert(
            itensSalvos.map((i) => ({ ...i, venda_id: vendaData.id }))
          );
          // Estoque
          for (const upd of estoqueDeltas) {
            const { data: prod } = await db("produtos").select("estoque").eq("id", upd.id).maybeSingle();
            const atual = Number((prod as { estoque?: number } | null)?.estoque ?? 0);
            await db("produtos")
              .update({ estoque: Math.max(0, atual - upd.delta) }).eq("id", upd.id);
          }
          // Fiado: registrado via vendas, sem coluna saldo_fiado
          gravouOnline = true;
        }
      } catch {
        // Sem internet ou erro de rede → vai para fila offline
      }

      // ── Fallback offline ─────────────────────────────────────────────────
      if (!gravouOnline) {
        await savePendingVenda({
          localId:       crypto.randomUUID(),
          vendaPayload,
          itens:         itensSalvos,
          estoqueDeltas,
          fiadoUpdate,
          createdAt:     new Date().toISOString(),
        });
        // Debita estoque no IndexedDB para manter autocomplete correto offline
        for (const upd of estoqueDeltas) {
          await debitarEstoqueLocal(upd.id, upd.delta);
        }
        const c = await countPendingVendas();
        setPendingCount(c);
      }

      // ── Atualiza caixa (local — independe de online/offline) ─────────────
      if (ehDinheiro) {
        const novoTotal = totalCaixa + totalFinal;
        setTotalCaixa(novoTotal);
        localStorage.setItem("pdv_total_caixa", String(novoTotal));
      }

      // ── Imprime cupom ────────────────────────────────────────────────────
      const itensCupom = carrinho.map((i) => ({ nome: i.produto.nome, quantidade: i.quantidade, precoUnitario: i.precoUnitario }));
      imprimirCupom({
        itens: itensCupom,
        totalGeral, descontoVal, totalFinal,
        tipoPagamento: labelPagamento,
        valorRecebidoVal: ehDinheiro ? valorRecebidoVal : totalFinal,
        troco: ehDinheiro ? troco : 0,
        nomeOperador, clienteLabel, cpf,
      });
      // Cupom adicional de fiado com campo de assinatura
      if (tipoPagamento === "fiado" && clienteFiado) {
        imprimirCupomFiado({
          itens: itensCupom, totalFinal, descontoVal, totalGeral,
          nomeCliente: clienteFiado.nome, nomeOperador,
        });
      }

      // ── Limpa cupom ──────────────────────────────────────────────────────
      setCarrinho([]);
      setClienteLabel("Sem cliente identificado");
      setCpf("");
      setClienteFiado(null);
      setErroFiado("");
      setBuscaFiado("");
      setResultadosFiado([]);
      setModalFinalizar(false);
      setMostrarModalCPF(true);

      if (!gravouOnline) {
        setMensagem("📶 Venda salva localmente — será enviada quando conectar.");
        setTimeout(() => setMensagem(""), 6000);
      } else {
        setMensagem("");
      }
    } finally {
      setFinalizando(false);
    }
  }

  /* ─────────────────────────── RENDER ─────────────────────────── */
  return (
    <main
      style={{
        height: "100vh",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        background: "linear-gradient(180deg, #f0f4f8 0%, #e8eef5 100%)",
        color: "#0f172a",
        padding: "6px 10px 8px",
        fontFamily: "Segoe UI, Arial, sans-serif",
        boxSizing: "border-box",
      }}
    >
      <div style={{ maxWidth: 1580, margin: "0 auto", width: "100%", flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "2px 0 6px", flexShrink: 0 }}>
          <div style={{ width: 180, display: "flex", alignItems: "center" }}>
            <button
              onClick={() => {
                const base = window.location.origin;
                window.open(`${base}/adm`, "_blank", "width=1280,height=800");
              }}
              title="Abrir painel ADM"
              style={{
                background: "#f1f5f9",
                border: "1px solid #cbd5e1",
                borderRadius: 8,
                color: "#475569",
                fontSize: 13,
                fontWeight: 700,
                padding: "5px 14px",
                cursor: "pointer",
                letterSpacing: 1,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              ⚙️ ADM
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 26, letterSpacing: 10, color: "#94a3b8", fontWeight: 300 }}>
            FRENTE DE CAIXA
          </div>
          <div style={{ width: 180, display: "flex", justifyContent: "flex-end" }}>
            <Relogio />
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 380px) minmax(480px, 1fr) 230px",
            gap: 10,
            alignItems: "stretch",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* ── Coluna esquerda: entrada ── */}
          <section style={colPanel}>
            <form onSubmit={adicionarItem} style={{ flexShrink: 0 }}>
              <Campo label="① Produto — código, EAN ou nome  (F2)">
                <div style={{ position: "relative" }}>
                  <input
                    ref={refCodigo}
                    value={codigoBusca}
                    onChange={(e) => aoDigitarBusca(e.target.value)}
                    onKeyDown={onKeyDownBusca}
                    placeholder="Digite 3 letras ou bipe o código"
                    autoComplete="off"
                    style={inputGrande}
                  />
                  {sugestoes.length > 0 && (
                    <div style={{
                      position: "absolute",
                      top: "calc(100% + 4px)",
                      left: 0,
                      right: 0,
                      zIndex: 200,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 12,
                      overflow: "hidden",
                      boxShadow: "0 12px 32px rgba(0,0,0,.15)",
                    }}>
                      {sugestoes.map((p, i) => (
                        <div
                          key={p.id}
                          onMouseDown={(e) => { e.preventDefault(); selecionarSugestao(p); }}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "10px 14px",
                            cursor: "pointer",
                            background: i === sugestaoIdx ? "#f0fdf4" : "#fff",
                            borderBottom: "1px solid #f1f5f9",
                            transition: "background .1s",
                          }}
                          onMouseEnter={() => setSugestaoIdx(i)}
                        >
                          <div>
                            <div style={{ color: "#0f172a", fontWeight: 700, fontSize: 15 }}>{p.nome}</div>
                            <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 1 }}>
                              {[p.codigo && `Cód: ${p.codigo}`, p.ean && `EAN: ${p.ean}`].filter(Boolean).join("  ·  ") || p.unidade}
                            </div>
                          </div>
                          <div style={{ color: "#16a34a", fontWeight: 900, fontSize: 16, marginLeft: 12, whiteSpace: "nowrap" }}>
                            {moedaBR(p.preco ?? 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Campo>

              <Campo label="② Peso / Quantidade">
                <input
                  ref={refQtd}
                  style={{ ...inputGrande, textAlign: "right", fontSize: 22, fontWeight: 700 }}
                  value={quantidade}
                  onChange={(e) => setQuantidade(e.target.value)}
                  onKeyDown={onKeyDownQtd}
                  inputMode="decimal"
                  placeholder="1"
                  autoFocus
                />
              </Campo>

              <Campo label="③ Valor unitário (preenchido automático)">
                <input
                  ref={refPrecoUnit}
                  style={{ ...inputGrande, textAlign: "right", fontSize: 20, fontWeight: 800 }}
                  value={precoUnitario}
                  onChange={(e) => setPrecoUnitario(e.target.value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </Campo>

              <Campo label="Preço total">
                <div
                  style={{
                    ...inputGrande,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    fontSize: 26,
                    fontWeight: 900,
                    color: precoTotalLinha > 0 ? "#16a34a" : "#d1d5db",
                    letterSpacing: 0.5,
                    userSelect: "none",
                  }}
                >
                  {moedaBR(precoTotalLinha)}
                </div>
              </Campo>

              <button
                type="submit"
                style={{
                  width: "100%",
                  marginTop: 8,
                  height: 46,
                  border: "none",
                  borderRadius: 12,
                  background: produtoSelecionado ? "#1faa4a" : "#374151",
                  color: "#fff",
                  fontWeight: 900,
                  fontSize: 17,
                  cursor: "pointer",
                  transition: "background .2s",
                }}
              >
                {produtoSelecionado ? `✔ Lançar  ${produtoSelecionado.nome}` : "+ Adicionar item (Enter)"}
              </button>
            </form>

            {mensagem ? (
              <div style={{ marginTop: 12, background: "#7f1d1d", color: "#fca5a5", borderRadius: 10, padding: "10px 14px", fontSize: 14 }}>
                {mensagem}
              </div>
            ) : null}

            <div
              style={{
                marginTop: 12,
                borderRadius: 14,
                border: "1px solid #e2e8f0",
                background: "#f8fafc",
                flex: 1,
                minHeight: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                padding: 12,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoSrc || "/logo.svg"}
                alt="Logo da empresa"
                style={{ maxWidth: "100%", maxHeight: 240, objectFit: "contain", filter: "drop-shadow(0 4px 10px rgba(0,0,0,.35))" }}
              />
            </div>
          </section>

          {/* ── Coluna central: lista de itens ── */}
          <section
            style={{
              ...colPanel,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Cabeçalho da tabela */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr .6fr .8fr .9fr 32px",
                gap: 8,
                color: "#94a3b8",
                fontWeight: 700,
                fontSize: 14,
                padding: "0 4px 10px",
                borderBottom: "1px solid #e2e8f0",
              }}
            >
              <div>Item</div>
              <div style={{ textAlign: "right" }}>Qtd</div>
              <div style={{ textAlign: "right" }}>Unit.</div>
              <div style={{ textAlign: "right" }}>Total</div>
              <div />
            </div>

            {/* Lista de itens */}
            <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              {carrinho.length === 0 ? (
                <div style={{ color: "#475569", fontSize: 16, padding: "18px 4px" }}>
                  Nenhum item lançado
                </div>
              ) : (
                carrinho.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr .6fr .8fr .9fr 32px",
                      gap: 8,
                      alignItems: "center",
                      padding: "10px 4px",
                      borderBottom: "1px solid #f1f5f9",
                      color: "#0f172a",
                      fontSize: 15,
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.produto.nome}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{item.produto.unidade || "Un"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      {item.quantidade % 1 === 0 ? item.quantidade : item.quantidade.toFixed(3)}
                    </div>
                    <div style={{ textAlign: "right" }}>{moedaBR(item.precoUnitario)}</div>
                    <div style={{ textAlign: "right", fontWeight: 700 }}>
                      {moedaBR(item.quantidade * item.precoUnitario)}
                    </div>
                    <button
                      type="button"
                      onClick={() => pedirSenhaCancelarItem(item.id)}
                      title="Cancelar item (senha ADM)"
                      style={{
                        width: 28,
                        height: 28,
                        border: "none",
                        borderRadius: 8,
                        background: "rgba(239,68,68,.2)",
                        color: "#f87171",
                        cursor: "pointer",
                        fontSize: 16,
                        display: "grid",
                        placeItems: "center",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Modal CPF sobreposto */}
            {mostrarModalCPF ? (
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  background: "rgba(0,0,0,.65)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 16,
                  zIndex: 999,
                }}
              >
                <div
                  style={{
                    width: 440,
                    background: "#ffffff",
                    borderRadius: 18,
                    boxShadow: "0 18px 45px rgba(0,0,0,.40)",
                    padding: 22,
                  }}
                >
                  <div style={{ color: "#0f172a", fontWeight: 800, fontSize: 19, marginBottom: 20 }}>
                    CPF na compra
                  </div>
                  <div style={{ color: "#1e293b", fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
                    Digite o CPF ou pressione Enter para seguir sem CPF
                  </div>
                  <input
                    autoFocus
                    value={cpf}
                    onChange={(e) => setCpf(formatarCPF(e.target.value))}
                    placeholder="000.000.000-00"
                    style={{
                      width: "100%",
                      height: 42,
                      borderRadius: 10,
                      border: `1px solid ${cpf.replace(/\D/g,"").length === 11 && !validarCPF(cpf) ? "#ef4444" : "#d7dbe2"}`,
                      padding: "0 12px",
                      outline: "none",
                      fontSize: 16,
                      color: "#111827",
                      marginBottom: 4,
                    }}
                  />
                  {cpf.replace(/\D/g,"").length === 11 && !validarCPF(cpf) && (
                    <div style={{ color: "#ef4444", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>CPF inválido</div>
                  )}
                  <div style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
                    ESC — sem CPF e fechar
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      type="button"
                      onClick={fecharModalCPF}
                      style={{ height: 38, border: "1px solid #d7dbe2", borderRadius: 8, background: "#f8fafc", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    >
                      Sem CPF
                    </button>
                    <button
                      type="button"
                      onClick={confirmarCPF}
                      style={{ height: 38, border: "none", borderRadius: 8, background: "#1faa4a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
                    >
                      Confirmar
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Mini-modal: CPF não cadastrado → pergunta se quer cadastrar */}
            {pedirCadastroCPF && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 1000 }}>
                <div style={{ width: 400, background: "#fff", borderRadius: 18, boxShadow: "0 18px 45px rgba(0,0,0,.4)", padding: 28 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginBottom: 8 }}>CPF não cadastrado</div>
                  <div style={{ color: "#475569", fontSize: 14, marginBottom: 20 }}>
                    O CPF <b>{formatarCPF(cpfNaoEncontrado)}</b> não está na base de clientes.<br />Deseja realizar o cadastro agora?
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <button
                      onClick={() => {
                        setPedirCadastroCPF(false);
                        setMostrarModalCPF(false);
                        setClienteLabel(formatarCPF(cpfNaoEncontrado));
                        setCpfNaoEncontrado("");
                        setTimeout(() => refQtd.current?.focus(), 50);
                      }}
                      style={{ height: 42, border: "1px solid #d7dbe2", borderRadius: 10, background: "#f8fafc", color: "#374151", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
                    >
                      Não, continuar
                    </button>
                    <button
                      onClick={() => {
                        setPedirCadastroCPF(false);
                        setMostrarModalCPF(false);
                        router.push(`/clientes?cpf=${cpfNaoEncontrado}`);
                      }}
                      style={{ height: 42, border: "none", borderRadius: 10, background: "#1faa4a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}
                    >
                      Sim, cadastrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Modal: cadastro rápido de cliente para fiado */}
            {/* Modal: selecionar cliente para fiado */}
            {modalSelecionarCliente && (
              <div
                style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 11000 }}
                onKeyDown={(e) => e.stopPropagation()}
              >
                <div style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: 22, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,.5)", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a" }}>👤 Selecionar cliente</div>
                    <button type="button" onClick={() => setModalSelecionarCliente(false)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#475569" }}>×</button>
                  </div>
                  <input
                    type="text"
                    placeholder="Filtrar por nome..."
                    value={buscaFiado}
                    autoFocus
                    onChange={(e) => { setBuscaFiado(e.target.value); buscarClienteFiadoPorNome(e.target.value); }}
                    onKeyDown={(e) => e.stopPropagation()}
                    style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #fcd34d", padding: "0 12px", fontSize: 14, outline: "none", marginBottom: 10, boxSizing: "border-box" }}
                  />
                  <div style={{ flex: 1, overflowY: "auto", border: "1px solid #fde68a", borderRadius: 10, marginBottom: 12 }}>
                    {buscandoFiado ? (
                      <div style={{ padding: 20, textAlign: "center", color: "#92400e", fontSize: 14 }}>Carregando...</div>
                    ) : resultadosFiado.length === 0 ? (
                      <div style={{ padding: 20, textAlign: "center", color: "#92400e", fontSize: 14 }}>
                        Nenhum cliente encontrado.<br/>
                        <span style={{ fontSize: 11, color: "#64748b" }}>(empresa_id: {localStorage.getItem("hg_empresa_id") ?? "não definido"})</span>
                      </div>
                    ) : resultadosFiado.map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid #fef9c3" }}>
                        <div>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{c.nome}</div>
                          <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                            Limite: <b>{moedaBR(c.limite_credito || 0)}</b>
                          </div>
                        </div>
                        <button type="button"
                          onClick={() => { setClienteFiado(c); setBuscaFiado(""); setResultadosFiado([]); setModalSelecionarCliente(false); setErroFiado(""); }}
                          style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "none", background: "#1e3a5f", color: "#fff", fontWeight: 700, fontSize: 13, cursor: "pointer", flexShrink: 0, marginLeft: 10 }}>
                          Selecionar
                        </button>
                      </div>
                    ))}
                  </div>
                  <button type="button"
                    onClick={() => { setModalSelecionarCliente(false); setModalNovoCliente(true); }}
                    style={{ width: "100%", height: 42, borderRadius: 10, border: "none", background: "#1faa4a", color: "#fff", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                    + Cadastrar novo cliente
                  </button>
                </div>
              </div>
            )}

            {modalNovoCliente && (
              <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 11000 }}>
                <div style={{ width: "100%", maxWidth: 440, background: "#fff", borderRadius: 22, padding: 28, boxShadow: "0 20px 50px rgba(0,0,0,.5)" }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: "#0f172a", marginBottom: 4 }}>Cadastrar cliente</div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Preencha os dados para fiado. Após salvar, o cliente será selecionado automaticamente.</div>
                  <form onSubmit={salvarNovoClienteFiado}>
                    <div style={{ display: "grid", gap: 14 }}>
                      <div>
                        <label style={labelModal}>Nome *</label>
                        <input style={inputModal} value={novoCliNome} onChange={(e) => setNovoCliNome(e.target.value)} placeholder="Nome completo" required autoFocus />
                      </div>
                      <div>
                        <label style={labelModal}>Telefone</label>
                        <input style={inputModal} value={novoCliTelefone} onChange={(e) => setNovoCliTelefone(e.target.value)} placeholder="(00) 00000-0000" inputMode="numeric" />
                      </div>
                      <div>
                        <label style={labelModal}>CPF (opcional)</label>
                        <input style={inputModal} value={novoCliCpf} onChange={(e) => setNovoCliCpf(e.target.value)} placeholder="000.000.000-00" inputMode="numeric" />
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                        <div>
                          <label style={labelModal}>CEP</label>
                          <input style={inputModal} value={novoCliCep}
                            onChange={(e) => { setNovoCliCep(e.target.value); if (e.target.value.replace(/\D/g,"").length === 8) buscarCep(e.target.value); }}
                            placeholder="00000-000" inputMode="numeric" />
                        </div>
                        <div>
                          <label style={labelModal}>Número</label>
                          <input style={inputModal} value={novoCliNumero} onChange={(e) => setNovoCliNumero(e.target.value)} placeholder="Nº" />
                        </div>
                      </div>
                      {novoCliEndereco && (
                        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 10, padding: "8px 12px", fontSize: 13, color: "#15803d" }}>
                          {buscandoCep ? "Buscando endereço..." : `📍 ${novoCliEndereco}`}
                        </div>
                      )}
                      <div>
                        <label style={labelModal}>Limite de crédito (R$) *</label>
                        <input style={inputModal} value={novoCliLimite}
                          onChange={(e) => setNovoCliLimite(e.target.value.replace(/[^0-9,\.]/g, ""))}
                          placeholder="Ex: 200,00" inputMode="decimal" required />
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 20 }}>
                      <button type="button" onClick={() => setModalNovoCliente(false)}
                        style={{ height: 44, borderRadius: 12, border: "1px solid #d5dde7", background: "#f8fafc", color: "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                        Cancelar
                      </button>
                      <button type="submit" disabled={salvandoNovoCli || !novoCliNome.trim() || !novoCliLimite.trim()}
                        style={{ height: 44, borderRadius: 12, border: "none", background: "#1faa4a", color: "#fff", fontWeight: 900, fontSize: 15, cursor: "pointer", opacity: !novoCliNome.trim() ? 0.5 : 1 }}>
                        {salvandoNovoCli ? "Salvando..." : "✔ Salvar e selecionar"}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* Rodapé: contagem e total */}
            <div style={{ marginTop: "auto", paddingTop: 10, borderTop: "1px solid #e2e8f0" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "rgba(255,255,255,.55)",
                  fontWeight: 700,
                  fontSize: 16,
                  marginBottom: 8,
                }}
              >
                <div>Total geral</div>
                <div>{totalItens} {totalItens === 1 ? "item" : "itens"}</div>
              </div>

              <div
                style={{
                  background: "linear-gradient(180deg, rgba(64,72,89,.65), rgba(43,50,65,.8))",
                  borderRadius: 12,
                  minHeight: 80,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 48,
                  fontWeight: 900,
                  color: "#f0fdf4",
                  letterSpacing: 1,
                }}
              >
                {moedaBR(totalGeral)}
              </div>
            </div>
          </section>

          {/* ── Coluna direita: operador + atalhos ── */}
          <aside style={colPanel}>
            {/* Indicador online/offline */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 6, padding: "5px 10px", borderRadius: 10,
              background: isOnline ? "rgba(31,170,74,.12)" : "rgba(239,68,68,.14)",
              border: `1px solid ${isOnline ? "rgba(31,170,74,.3)" : "rgba(239,68,68,.3)"}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <span style={{ fontSize: 10 }}>{isOnline ? "🟢" : "🔴"}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isOnline ? "#4ade80" : "#f87171" }}>
                  {sincronizando ? "Sincronizando..." : isOnline ? "Online" : "Offline"}
                </span>
              </div>
              {pendingCount > 0 && (
                <span style={{
                  background: "#ef4444", color: "#fff", borderRadius: 999,
                  padding: "1px 7px", fontSize: 10, fontWeight: 900,
                }}>
                  {pendingCount} pendente{pendingCount > 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* Badge de plano */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 6, padding: "5px 10px", borderRadius: 10,
              background: plano === "pro"
                ? "rgba(21,128,61,.2)"
                : plano === "trial"
                ? "rgba(180,120,0,.2)"
                : "rgba(185,28,28,.2)",
              border: `1px solid ${plano === "pro" ? "rgba(21,128,61,.4)" : plano === "trial" ? "rgba(180,120,0,.4)" : "rgba(185,28,28,.4)"}`,
              cursor: "pointer",
            }} onClick={() => { setModalLicenca(true); setTimeout(() => refChaveInput.current?.focus(), 80); }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: plano === "pro" ? "#4ade80" : plano === "trial" ? "#fbbf24" : "#f87171" }}>
                {plano === "pro"
                  ? `✅ PRO${clienteLicenca ? " · " + clienteLicenca : ""}`
                  : plano === "trial"
                  ? `⏳ TRIAL — ${diasTrial} dia${diasTrial !== 1 ? "s" : ""}`
                  : "🔴 FREE — Clique para ativar"}
              </span>
            </div>

            <div style={{ color: "#94a3b8", fontSize: 11, letterSpacing: 0.4, marginBottom: 1 }}>
              OPERADOR
            </div>
            <div style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
              {nomeOperador}
            </div>

            <div
              style={{
                borderRadius: 10,
                background: "#f1f5f9",
                color: "#0f172a",
                padding: "7px 12px",
                marginBottom: 8,
                border: "1px solid #e2e8f0",
              }}
            >
              <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 0.4 }}>CPF NA COMPRA</div>
              <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2 }}>{clienteLabel}</div>
            </div>

            <div style={{ display: "grid", gap: 5, flex: 1, minHeight: 0, overflowY: "hidden" }}>
              <BotaoAtalho tecla="F2"    texto="Buscar produto"  onClick={() => { refCodigo.current?.focus(); refCodigo.current?.select(); }} />
              <BotaoAtalho tecla="F3"    texto="Finalizar venda" cor="#14532d" onClick={abrirFinalizar} />
              <BotaoAtalho tecla="F4"    texto="Buscar cupons"   cor="#1e3a5f" onClick={abrirBuscarCupons} />
              <BotaoAtalho tecla="F6"    texto="Cancelar cupom"  cor="#7f1d1d" onClick={pedirSenhaCancelarCupom} />
              <BotaoAtalho tecla="F7"    texto="Sangria"         cor={totalCaixa >= 300 ? "#7c3500" : "#0f3d4a"}
                onClick={abrirSangria}
                badge={totalCaixa >= 300 ? moedaBR(totalCaixa) : undefined}
              />
              <BotaoAtalho tecla="F5"    texto="Receber Fiado"   cor="#4a1d96" onClick={abrirReceberFiado} />
              <BotaoAtalho tecla="F8"    texto="Relatórios"      cor="#1e3a5f"
                onClick={() => pedirSenha("Relatórios do Caixa", "Informe a senha ADM para acessar os relatórios.", async () => { abrirRelatorios(); })} />
              <BotaoAtalho tecla="F9"    texto="Fechar Caixa"   cor="#4c1d95" onClick={abrirFechamento} />
              <BotaoAtalho tecla="F10"   texto="Identificar CPF" onClick={() => setMostrarModalCPF(true)} />
              <BotaoAtalho tecla="F12"   texto="Licença / Ativar"
                cor={plano === "free" ? "#7f1d1d" : plano === "trial" ? "#78350f" : "#14532d"}
                onClick={() => { setModalLicenca(true); setTimeout(() => refChaveInput.current?.focus(), 80); }}
              />
              <BotaoAtalho tecla="ESC"   texto="Fechar janela"   onClick={() => window.close()} />
            </div>

            {/* Versão */}
            <div style={{ textAlign: "center", marginTop: 6, color: "#94a3b8", fontSize: 10, letterSpacing: 0.5, lineHeight: 1.6 }}>
              Umbrela Gestão PDV · v{process.env.NEXT_PUBLIC_APP_VERSION || "—"}<br/>
              Desenvolvido por Jean Silva
            </div>
          </aside>
        </div>
      </div>

      {/* ══════════ MODAL LICENÇA ══════════ */}
      {modalLicenca && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "min(96vw, 480px)" }}>
            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a" }}>
                  🔑 Ativar Licença Pro
                </div>
                <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                  {plano === "trial"
                    ? `Período de avaliação: ${diasTrial} dia${diasTrial !== 1 ? "s" : ""} restante${diasTrial !== 1 ? "s" : ""}`
                    : plano === "pro"
                    ? `Licença ativa${clienteLicenca ? " · " + clienteLicenca : ""}`
                    : "Período de avaliação encerrado"}
                </div>
              </div>
              {plano !== "free" && (
                <button type="button" onClick={() => setModalLicenca(false)}
                  style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#94a3b8" }}>×</button>
              )}
            </div>

            {/* Status do plano atual */}
            <div style={{
              padding: "12px 14px", borderRadius: 12, marginBottom: 18,
              background: plano === "pro" ? "#f0fdf4" : plano === "trial" ? "#fffbeb" : "#fef2f2",
              border: `1px solid ${plano === "pro" ? "#bbf7d0" : plano === "trial" ? "#fde68a" : "#fecaca"}`,
            }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: plano === "pro" ? "#15803d" : plano === "trial" ? "#92400e" : "#991b1b" }}>
                {plano === "pro" ? "✅ Plano Pro ativo" : plano === "trial" ? "⏳ Avaliação gratuita" : "🔴 Plano Free (limitado)"}
              </div>
              <div style={{ fontSize: 13, color: "#475569", marginTop: 6, lineHeight: 1.7 }}>
                {plano === "pro"
                  ? "Todos os recursos desbloqueados. Obrigado por usar o Umbrela Gestão!"
                  : plano === "trial"
                  ? `Você tem ${diasTrial} dia${diasTrial !== 1 ? "s" : ""} de avaliação completa. Ative antes do prazo para não perder os recursos avançados.`
                  : "Somente venda básica disponível. Ative o Pro para desbloquear fiado, sangria, fechamento, relatórios e mais."}
              </div>
            </div>

            {/* Comparativo free vs pro */}
            {plano !== "pro" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18, fontSize: 12 }}>
                <div style={{ background: "#f8fafc", borderRadius: 10, padding: "10px 12px", border: "1px solid #e2e8f0" }}>
                  <div style={{ fontWeight: 800, color: "#64748b", marginBottom: 8 }}>FREE</div>
                  {["✅ Vender (caixa/pix/cartão)", "✅ Imprimir cupom", "❌ Fiado", "❌ Sangria / Fechamento", "❌ Relatórios", "❌ Cancelar itens", "❌ Desconto"].map(f => (
                    <div key={f} style={{ color: f.startsWith("❌") ? "#94a3b8" : "#374151", marginBottom: 3 }}>{f}</div>
                  ))}
                </div>
                <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "10px 12px", border: "1px solid #bbf7d0" }}>
                  <div style={{ fontWeight: 800, color: "#15803d", marginBottom: 8 }}>PRO ✨</div>
                  {["✅ Tudo do Free", "✅ Fiado com limite", "✅ Sangria / Fechamento", "✅ Relatórios completos", "✅ Cancelar com log", "✅ Desconto R$ / %", "✅ Offline automático"].map(f => (
                    <div key={f} style={{ color: "#166534", marginBottom: 3 }}>{f}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Input da chave */}
            {plano !== "pro" && (
              <>
                <label style={labelModal}>Chave de licença</label>
                <input
                  ref={refChaveInput}
                  type="text"
                  value={chaveInput}
                  onChange={(e) => setChaveInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => { if (e.key === "Enter") ativarLicenca(); if (e.key === "Escape") { if (plano !== "free") setModalLicenca(false); } }}
                  placeholder="UMBRELA-XXXXX-XXXXX-XXXXX"
                  style={{ ...inputModal, fontSize: 16, fontWeight: 700, letterSpacing: 2, textAlign: "center", marginBottom: erroLicenca ? 6 : 14 }}
                />
                {erroLicenca && (
                  <div style={{ color: "#dc2626", fontSize: 13, fontWeight: 700, marginBottom: 14 }}>{erroLicenca}</div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: plano === "free" ? "1fr" : "1fr 1fr", gap: 10 }}>
                  {plano !== "free" && (
                    <button type="button" onClick={() => setModalLicenca(false)} style={btnCancelarModal}>
                      Continuar no Trial
                    </button>
                  )}
                  <button type="button" onClick={ativarLicenca} disabled={ativandoLicenca || !chaveInput.trim()}
                    style={{ ...btnConfirmarModal, background: "#15803d", opacity: !chaveInput.trim() ? 0.5 : 1 }}>
                    {ativandoLicenca ? "Verificando..." : "🔑 Ativar Licença"}
                  </button>
                </div>
                <div style={{ textAlign: "center", marginTop: 12, fontSize: 12, color: "#94a3b8" }}>
                  Não tem uma chave? Entre em contato para adquirir o Plano Pro.
                </div>
              </>
            )}

            {plano === "pro" && (
              <button type="button" onClick={() => setModalLicenca(false)} style={{ ...btnConfirmarModal, background: "#15803d" }}>
                Fechar
              </button>
            )}
          </div>
        </div>
      )}

      {/* ══════════ MODAL BUSCAR CUPONS ══════════ */}
      {modalCupons && (
        <div style={{ ...overlay, alignItems: "flex-start", paddingTop: 30 }}>
          <div style={{ ...modalBox, width: "min(96vw, 720px)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>

            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>🔍 Buscar Cupons</div>
              <button type="button" onClick={() => setModalCupons(false)}
                style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#475569" }}>×</button>
            </div>

            {/* Filtros */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 10, marginBottom: 14 }}>
              <div>
                <label style={labelModal}>CPF do cliente</label>
                <input
                  ref={refFiltroCPF}
                  type="text"
                  value={filtroCPF}
                  onChange={(e) => setFiltroCPF(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") carregarCupons(filtroCPF, filtroData); }}
                  placeholder="000.000.000-00"
                  style={inputModal}
                />
              </div>
              <div>
                <label style={labelModal}>Data</label>
                <input
                  type="date"
                  value={filtroData}
                  onChange={(e) => setFiltroData(e.target.value)}
                  style={inputModal}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button type="button"
                  onClick={() => carregarCupons(filtroCPF, filtroData)}
                  style={{ ...btnConfirmarModal, height: 44, padding: "0 18px", whiteSpace: "nowrap" }}>
                  🔍 Buscar
                </button>
              </div>
            </div>

            {/* Resultado */}
            <div style={{ flex: 1, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10 }}>
              {carregandoCupons ? (
                <div style={{ padding: 20, color: "#64748b" }}>Buscando...</div>
              ) : cupons.length === 0 ? (
                <div style={{ padding: 20, color: "#64748b" }}>Nenhum cupom encontrado.</div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", position: "sticky", top: 0 }}>
                      {["Data/Hora", "Operador", "CPF", "Pagamento", "Desconto", "Total", ""].map((h) => (
                        <th key={h} style={{ padding: "9px 10px", textAlign: "left", fontWeight: 700, color: "#374151", borderBottom: "2px solid #e2e8f0", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cupons.map((v, i) => {
                      const d = new Date(v.created_at);
                      const dt = d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
                      return (
                        <tr key={v.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc", borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 10px", color: "#1e293b", whiteSpace: "nowrap" }}>{dt}</td>
                          <td style={{ padding: "8px 10px", color: "#1e293b" }}>{v.operador || "—"}</td>
                          <td style={{ padding: "8px 10px", color: "#64748b" }}>
                            {v.cliente_cpf
                              ? String(v.cliente_cpf).replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
                              : "—"}
                          </td>
                          <td style={{ padding: "8px 10px" }}>
                            <span style={{
                              borderRadius: 999, padding: "2px 9px", fontSize: 12, fontWeight: 700,
                              background: v.tipo_pagamento === "Dinheiro" ? "#dcfce7" : "#dbeafe",
                              color:      v.tipo_pagamento === "Dinheiro" ? "#15803d"  : "#1d4ed8",
                            }}>{v.tipo_pagamento || "—"}</span>
                          </td>
                          <td style={{ padding: "8px 10px", color: "#dc2626", textAlign: "right" }}>
                            {v.desconto > 0 ? `- ${moedaBR(v.desconto)}` : "—"}
                          </td>
                          <td style={{ padding: "8px 10px", fontWeight: 800, color: "#15803d", textAlign: "right" }}>
                            {moedaBR(v.total || 0)}
                          </td>
                          <td style={{ padding: "6px 8px" }}>
                            <button
                              type="button"
                              onClick={() => reimprimirCupomDoBanco(v)}
                              style={{
                                border: "1px solid #93c5fd",
                                background: "#eff6ff",
                                color: "#1d4ed8",
                                borderRadius: 8,
                                padding: "4px 10px",
                                fontWeight: 800,
                                fontSize: 12,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              🖨️ Reimprimir
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: "#f0fdf4", borderTop: "2px solid #bbf7d0" }}>
                      <td colSpan={5} style={{ padding: "8px 10px", fontWeight: 700, color: "#166534" }}>
                        {cupons.length} cupom(ns) · Total do período
                      </td>
                      <td style={{ padding: "8px 10px", fontWeight: 900, color: "#15803d", textAlign: "right" }}>
                        {moedaBR(cupons.reduce((s, v) => s + (v.total || 0), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>

            <div style={{ marginTop: 12, textAlign: "right" }}>
              <button type="button" onClick={() => setModalCupons(false)} style={btnCancelarModal}>
                Fechar (ESC)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL FINALIZAR VENDA ══════════ */}
      {modalFinalizar && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "min(96vw, 480px)" }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", marginBottom: 18 }}>
              ✅ Finalizar Venda
            </div>

            {/* Tipo de pagamento */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: tipoPagamento === "cartao" ? 10 : 20 }}>
              {([
                { tipo: "dinheiro", label: "💵 Dinheiro", cor: "#15803d", bg: "#f0fdf4", tecla: "D" },
                { tipo: "pix",      label: "📱 PIX",      cor: "#0369a1", bg: "#f0f9ff", tecla: "P" },
                { tipo: "cartao",   label: "💳 Cartão",   cor: "#1d4ed8", bg: "#eff6ff", tecla: "C" },
                ...(temRecurso(plano, "fiado") ? [{ tipo: "fiado" as const, label: "📒 Fiado", cor: "#92400e", bg: "#fffbeb", tecla: "F" }] : []),
              ] as const).map(({ tipo, label, cor, bg, tecla }) => (
                <button key={tipo} type="button"
                  onClick={() => selecionarPagamento(tipo)}
                  style={{
                    height: 60, border: "2px solid", borderRadius: 12, fontWeight: 800, fontSize: 13, cursor: "pointer",
                    borderColor: tipoPagamento === tipo ? cor : "#e2e8f0",
                    background:  tipoPagamento === tipo ? bg  : "#f9fafb",
                    color:       tipoPagamento === tipo ? cor : "#64748b",
                    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
                  }}>
                  <span>{label}</span>
                  <span style={{
                    fontSize: 10, fontWeight: 700, opacity: 0.6,
                    background: tipoPagamento === tipo ? cor : "#cbd5e1",
                    color: "#fff", borderRadius: 4, padding: "1px 5px",
                  }}>tecla {tecla}</span>
                </button>
              ))}
            </div>

            {/* Sub-tipo cartão */}
            {tipoPagamento === "cartao" && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 20 }}>
                {([
                  { sub: "debito",      label: "Débito",      cor: "#1d4ed8" },
                  { sub: "credito",     label: "Crédito",     cor: "#7c3aed" },
                  { sub: "alimentacao", label: "Alimentação", cor: "#059669" },
                ] as const).map(({ sub, label, cor }) => (
                  <button key={sub} type="button"
                    onClick={() => setSubtipoCartao(sub)}
                    style={{
                      height: 38, border: "2px solid", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer",
                      borderColor: subtipoCartao === sub ? cor : "#e2e8f0",
                      background:  subtipoCartao === sub ? cor : "#f9fafb",
                      color:       subtipoCartao === sub ? "#fff" : "#64748b",
                    }}>
                    {label}
                  </button>
                ))}
              </div>
            )}

            {/* Fiado: bloco de busca */}
            {tipoPagamento === "fiado" && (
              <div style={{ marginBottom: 16, background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: "#92400e", marginBottom: 8 }}>
                  📒 Fiado
                </div>
                {clienteFiado ? (
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ fontWeight: 800, color: "#1e293b", fontSize: 15 }}>{clienteFiado.nome}</div>
                      <button type="button" onClick={() => { setClienteFiado(null); setBuscaFiado(""); setResultadosFiado([]); }}
                        style={{ fontSize: 11, color: "#64748b", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                        trocar
                      </button>
                    </div>
                    <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 13 }}>
                      <span style={{ color: "#475569" }}>Limite: <b>{moedaBR(clienteFiado.limite_credito || 0)}</b></span>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => { setErroFiado(""); setBuscaFiado(""); setResultadosFiado([]); setModalSelecionarCliente(true); }}
                    style={{ height: 40, padding: "0 18px", borderRadius: 10, border: "2px solid #fcd34d", background: "#fffbeb", color: "#92400e", fontWeight: 800, fontSize: 14, cursor: "pointer", width: "100%" }}
                  >
                    👤 Selecionar cliente
                  </button>
                )}
              </div>
            )}

            {/* Subtotal */}
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, fontSize: 15, color: "#475569" }}>
              <span>Subtotal ({totalItens} {totalItens === 1 ? "item" : "itens"})</span>
              <span style={{ fontWeight: 700 }}>{moedaBR(totalGeral)}</span>
            </div>

            {/* Desconto — dinheiro e PIX, apenas se tiver permissão e plano pro */}
            {tipoPagamento !== "cartao" && temRecurso(plano, "desconto") && temPerm("perm_desconto") && (
              <div style={{ marginBottom: 14 }}>
                <label style={labelModal}>Desconto</label>
                <div style={{ display: "flex", gap: 8 }}>
                  {/* Toggle R$ / % */}
                  <div style={{ display: "flex", border: "1px solid #d1d5db", borderRadius: 10, overflow: "hidden", flexShrink: 0 }}>
                    {(["R$", "%"] as const).map((t) => (
                      <button key={t} type="button"
                        onClick={() => { setTipoDesconto(t); setDesconto(""); }}
                        style={{
                          width: 44, height: 44, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 14,
                          background: tipoDesconto === t ? "#1e3a5f" : "#f9fafb",
                          color:      tipoDesconto === t ? "#fff"    : "#374151",
                        }}>{t}</button>
                    ))}
                  </div>
                  <input
                    type="text" inputMode="decimal"
                    value={desconto}
                    onChange={(e) => setDesconto(e.target.value)}
                    placeholder={tipoDesconto === "%" ? "0,00" : "0,00"}
                    style={{ ...inputModal, fontSize: 18, textAlign: "right", flex: 1 }}
                  />
                </div>
                {descontoVal > 0 && (
                  <div style={{ color: "#15803d", fontSize: 13, marginTop: 4, textAlign: "right" }}>
                    Desconto: − {moedaBR(descontoVal)}
                  </div>
                )}
              </div>
            )}

            {/* Total final */}
            <div style={{
              background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
              padding: "12px 16px", display: "flex", justifyContent: "space-between",
              alignItems: "center", marginBottom: 16,
            }}>
              <span style={{ fontWeight: 700, fontSize: 16, color: "#166534" }}>Total a cobrar</span>
              <span style={{ fontWeight: 900, fontSize: 28, color: "#15803d" }}>{moedaBR(totalFinal)}</span>
            </div>

            {/* Valor recebido + troco — só dinheiro (PIX e Cartão não precisam) */}
            {tipoPagamento === "dinheiro" && (
              <>
                <div style={{ marginBottom: 10 }}>
                  <label style={labelModal}>Valor recebido (R$)</label>
                  <input
                    ref={refValorRecebido}
                    type="text" inputMode="decimal"
                    value={valorRecebido || "0,00"}
                    onFocus={(e) => { if (valorRecebido === "" || valorRecebido === "0,00") { setValorRecebido(""); } e.target.select(); }}
                    onBlur={() => { if (valorRecebido === "") setValorRecebido("0,00"); }}
                    onChange={(e) => setValorRecebido(e.target.value.replace(/[^0-9,\.]/g, ""))}
                    onKeyDown={(e) => { if (e.key === "Enter") confirmarVenda(); }}
                    style={{ ...inputModal, fontSize: 22, fontWeight: 800, textAlign: "right" }}
                  />
                </div>
                {valorRecebidoVal > 0 && (
                  <div style={{
                    background: troco >= 0 ? "#fefce8" : "#fef2f2",
                    border: `1px solid ${troco >= 0 ? "#fde68a" : "#fecaca"}`,
                    borderRadius: 10, padding: "10px 16px",
                    display: "flex", justifyContent: "space-between", marginBottom: 14,
                  }}>
                    <span style={{ fontWeight: 700, color: troco >= 0 ? "#854d0e" : "#991b1b" }}>
                      {troco >= 0 ? "Troco" : "⚠️ Valor insuficiente"}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 20, color: troco >= 0 ? "#854d0e" : "#991b1b" }}>
                      {moedaBR(troco)}
                    </span>
                  </div>
                )}
              </>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button type="button" onClick={() => setModalFinalizar(false)} style={btnCancelarModal}>Voltar (ESC)</button>
              <button type="button" onClick={confirmarVenda}
                disabled={finalizando || (tipoPagamento === "fiado" && !clienteFiado)}
                style={{ ...btnConfirmarModal, background: "#15803d", fontSize: 15,
                  opacity: (tipoPagamento === "fiado" && !clienteFiado) ? 0.5 : 1 }}>
                {finalizando ? "Gravando..." : "✔ Confirmar venda"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL MOTIVO CANCELAMENTO ══════════ */}
      {modalMotivo && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>
              ❌ {modalMotivo.titulo}
            </div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>{modalMotivo.descricao}</div>
            <label style={labelModal}>Motivo do cancelamento</label>
            <input
              ref={refMotivo}
              type="text"
              value={motivoInput}
              onChange={(e) => setMotivoInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { const cb = modalMotivo.onConfirmar; setModalMotivo(null); cb(motivoInput); }
                if (e.key === "Escape") setModalMotivo(null);
              }}
              placeholder="Ex: produto errado, troca, etc."
              style={inputModal}
              maxLength={120}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setModalMotivo(null)} style={btnCancelarModal}>Cancelar (ESC)</button>
              <button type="button" onClick={() => { const cb = modalMotivo.onConfirmar; setModalMotivo(null); cb(motivoInput); }} style={btnConfirmarModal}>
                Continuar (Enter)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL SENHA ADM ══════════ */}
      {modalAdm && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>
              🔒 {modalAdm.titulo}
            </div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>{modalAdm.descricao}</div>
            <input
              ref={refSenhaAdm}
              type="password"
              value={senhaAdmInput}
              onChange={(e) => setSenhaAdmInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmarSenhaAdm(); if (e.key === "Escape") setModalAdm(null); }}
              placeholder="Senha ADM"
              style={inputModal}
            />
            {erroSenhaAdm && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 6 }}>{erroSenhaAdm}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setModalAdm(null)} style={btnCancelarModal}>Cancelar (ESC)</button>
              <button type="button" onClick={confirmarSenhaAdm} disabled={salvandoAdm} style={btnConfirmarModal}>
                {salvandoAdm ? "Verificando..." : "Confirmar (Enter)"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL RECEBER FIADO ══════════ */}
      {modalReceberFiado && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "min(96vw, 480px)" }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", marginBottom: 18 }}>
              📒 Receber Fiado
            </div>

            {!clienteReceberFiado ? (
              <>
                <div style={{ fontSize: 14, color: "#475569", marginBottom: 10 }}>Selecione o cliente:</div>
                <input
                  type="text"
                  placeholder="Filtrar por nome..."
                  value={buscaClienteRec}
                  onChange={(e) => setBuscaClienteRec(e.target.value)}
                  autoFocus
                  style={{ width: "100%", height: 40, borderRadius: 10, border: "1px solid #c7d2fe", padding: "0 12px", fontSize: 14, marginBottom: 10, boxSizing: "border-box" }}
                />
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 10, marginBottom: 16 }}>
                  {listaClientesFiado
                    .filter(c => !buscaClienteRec.trim() || c.nome.toLowerCase().includes(buscaClienteRec.toLowerCase()))
                    .map(c => (
                      <div key={c.id}
                        onClick={() => selecionarClienteParaReceber(c)}
                        style={{ padding: "10px 14px", borderBottom: "1px solid #f1f5f9", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
                        onMouseEnter={e => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={e => (e.currentTarget.style.background = "")}
                      >
                        <span style={{ fontWeight: 700 }}>{c.nome}</span>
                        <span style={{ fontSize: 12, color: "#6366f1" }}>Selecionar →</span>
                      </div>
                    ))
                  }
                  {listaClientesFiado.filter(c => !buscaClienteRec.trim() || c.nome.toLowerCase().includes(buscaClienteRec.toLowerCase())).length === 0 && (
                    <div style={{ padding: 20, textAlign: "center", color: "#94a3b8" }}>Nenhum cliente encontrado</div>
                  )}
                </div>
                <button type="button" onClick={() => setModalReceberFiado(false)} style={btnCancelarModal}>Cancelar</button>
              </>
            ) : (
              <>
                <div style={{ background: "#f8fafc", borderRadius: 12, padding: "14px 16px", marginBottom: 16 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{clienteReceberFiado.nome}</div>
                  <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#64748b", fontSize: 14 }}>Saldo devedor:</span>
                    <span style={{ fontWeight: 900, fontSize: 22, color: saldoDevedor > 0 ? "#dc2626" : "#16a34a" }}>
                      {moedaBR(saldoDevedor)}
                    </span>
                  </div>
                </div>

                {saldoDevedor <= 0 ? (
                  <div style={{ textAlign: "center", color: "#16a34a", fontWeight: 700, fontSize: 16, marginBottom: 16 }}>
                    ✅ Cliente sem débitos em aberto!
                  </div>
                ) : (
                  <>
                    <div style={{ marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Valor recebido (R$)</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        max={saldoDevedor}
                        value={valorPagamento}
                        onChange={(e) => setValorPagamento(e.target.value)}
                        autoFocus
                        placeholder={`Máx: ${moedaBR(saldoDevedor)}`}
                        style={{ width: "100%", height: 44, borderRadius: 10, border: "2px solid #6366f1", padding: "0 12px", fontSize: 18, fontWeight: 700, boxSizing: "border-box" }}
                      />
                    </div>
                    <div style={{ marginBottom: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#374151", display: "block", marginBottom: 4 }}>Observação (opcional)</label>
                      <input
                        type="text"
                        value={obsPagamento}
                        onChange={(e) => setObsPagamento(e.target.value)}
                        placeholder="Ex: pagou com pix, dinheiro..."
                        style={{ width: "100%", height: 38, borderRadius: 10, border: "1px solid #c7d2fe", padding: "0 12px", fontSize: 14, boxSizing: "border-box" }}
                      />
                    </div>
                  </>
                )}

                <div style={{ display: "flex", gap: 10 }}>
                  <button type="button" onClick={() => setClienteReceberFiado(null)} style={btnCancelarModal}>← Voltar</button>
                  {saldoDevedor > 0 && (
                    <button
                      type="button"
                      onClick={confirmarPagamentoFiado}
                      disabled={salvandoPagamento || !valorPagamento}
                      style={{ flex: 1, height: 44, borderRadius: 12, border: "none", background: "#4f46e5", color: "#fff", fontWeight: 800, fontSize: 15, cursor: "pointer" }}
                    >
                      {salvandoPagamento ? "Registrando..." : `✅ Confirmar recebimento`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════ MODAL SANGRIA ══════════ */}
      {modalSangria && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>💵 Registrar Sangria</div>
            <div style={{ color: "#475569", fontSize: 14, marginBottom: 16 }}>
              Informe o valor retirado do caixa.
            </div>
            <label style={labelModal}>Valor retirado (R$)</label>
            <input
              autoFocus
              type="text"
              inputMode="decimal"
              value={valorSangria}
              onChange={(e) => setValorSangria(e.target.value)}
              placeholder="0,00"
              style={{ ...inputModal, fontSize: 22, fontWeight: 800, textAlign: "right" }}
            />
            <label style={{ ...labelModal, marginTop: 12 }}>Observação (opcional)</label>
            <input
              type="text"
              value={obsSangria}
              onChange={(e) => setObsSangria(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") confirmarSangria(); }}
              placeholder="Ex: Enviado para cofre"
              style={inputModal}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}>
              <button type="button" onClick={() => setModalSangria(false)} style={btnCancelarModal}>Cancelar</button>
              <button type="button" onClick={confirmarSangria} disabled={salvandoSangria} style={btnConfirmarModal}>
                {salvandoSangria ? "Salvando..." : "✔ Registrar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════ MODAL FECHAMENTO DE CAIXA ══════════ */}
      {modalFechamento && (
        <div style={overlay}>
          <div style={{ ...modalBox, width: "min(96vw, 500px)" }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: "#0f172a", marginBottom: 20 }}>
              🏦 Fechamento de Caixa
            </div>

            {carregandoFechamento ? (
              <div style={{ color: "#64748b", padding: "24px 0", textAlign: "center" }}>Carregando dados do dia...</div>

            ) : fechamentoData && etapaFechamento === "gaveta" ? (
              /* ── ETAPA 1: quanto tem na gaveta? ── */
              <>
                <div style={{
                  background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 12,
                  padding: "18px 20px", marginBottom: 22, textAlign: "center",
                }}>
                  <div style={{ fontSize: 15, color: "#166534", fontWeight: 700, marginBottom: 8 }}>
                    💰 Quanto de dinheiro tem na gaveta agora?
                  </div>
                  <div style={{ fontSize: 13, color: "#4b7a5e", marginBottom: 16 }}>
                    Conte o dinheiro físico e informe o valor abaixo.
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
                    <span style={{ fontWeight: 700, fontSize: 20, color: "#166534" }}>R$</span>
                    <input
                      ref={refValorGaveta}
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="0,00"
                      value={valorGaveta}
                      onChange={e => setValorGaveta(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter" && valorGaveta) setEtapaFechamento("resumo"); }}
                      style={{
                        width: 180, height: 52, fontSize: 26, fontWeight: 900,
                        textAlign: "center", border: "2px solid #86efac", borderRadius: 10,
                        outline: "none", padding: "0 10px", color: "#15803d",
                        background: "#fff",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button type="button" onClick={() => setModalFechamento(false)} style={btnCancelarModal}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={!valorGaveta}
                    onClick={() => setEtapaFechamento("resumo")}
                    style={{ ...btnConfirmarModal, background: "#15803d", opacity: valorGaveta ? 1 : 0.45 }}
                  >
                    Continuar →
                  </button>
                </div>
              </>

            ) : fechamentoData && etapaFechamento === "resumo" ? (
              /* ── ETAPA 2: resumo + obs + confirmar ── */
              <>
                {/* Cards de resumo do sistema */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                  {[
                    { label: "Vendas realizadas", value: `${fechamentoData.qtdVendas} cupom(ns)`, color: "#1e293b" },
                    { label: "Total de vendas",   value: moedaBR(fechamentoData.totalVendas), color: "#15803d", destaque: true },
                    { label: "💵 Dinheiro",        value: moedaBR(fechamentoData.totalDinheiro), color: "#15803d" },
                    { label: "📱 PIX",             value: moedaBR(fechamentoData.totalPix),      color: "#0369a1" },
                    { label: "💳 Cartão",          value: moedaBR(fechamentoData.totalCartao),   color: "#1d4ed8" },
                    { label: "↓ Sangrias",         value: `− ${moedaBR(fechamentoData.totalSangrias)}`, color: "#dc2626" },
                  ].map(({ label, value, color, destaque }) => (
                    <div key={label} style={{
                      border: `1px solid ${destaque ? "#bbf7d0" : "#e2e8f0"}`,
                      borderRadius: 10, padding: "8px 12px",
                      background: destaque ? "#f0fdf4" : "#f8fafc",
                    }}>
                      <div style={{ fontSize: 11, color: "#64748b", marginBottom: 2 }}>{label}</div>
                      <div style={{ fontWeight: 900, fontSize: 15, color }}>{value}</div>
                    </div>
                  ))}
                </div>

                {/* Gaveta informada × esperado × diferença */}
                <div style={{
                  background: "#fefce8", border: "1px solid #fde68a", borderRadius: 12,
                  padding: "12px 16px", marginBottom: 10,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#854d0e" }}>💰 Esperado na gaveta</span>
                    <span style={{ fontWeight: 900, fontSize: 18, color: "#854d0e" }}>{moedaBR(esperadoGav)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#166534" }}>🗄️ Informado pelo operador</span>
                    <span style={{ fontWeight: 900, fontSize: 18, color: "#166534" }}>{moedaBR(gavetaNum)}</span>
                  </div>
                  <div style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    borderTop: "1px solid #fde68a", paddingTop: 8,
                  }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: difGav < 0 ? "#dc2626" : difGav > 0 ? "#1d4ed8" : "#15803d" }}>
                      {difGav < 0 ? "⚠️ Faltando" : difGav > 0 ? "➕ Sobra" : "✅ Diferença"}
                    </span>
                    <span style={{ fontWeight: 900, fontSize: 18, color: difGav < 0 ? "#dc2626" : difGav > 0 ? "#1d4ed8" : "#15803d" }}>
                      {difGav === 0 ? "R$ 0,00" : (difGav < 0 ? "− " : "+ ") + moedaBR(Math.abs(difGav))}
                    </span>
                  </div>
                </div>

                {/* Observação */}
                <textarea
                  placeholder="Observação (opcional)..."
                  value={obsFechamento}
                  onChange={e => setObsFechamento(e.target.value)}
                  rows={3}
                  style={{
                    width: "100%", borderRadius: 8, border: "1px solid #cbd5e1",
                    padding: "8px 12px", fontSize: 13, resize: "vertical",
                    fontFamily: "inherit", marginBottom: 14, boxSizing: "border-box",
                    outline: "none",
                  }}
                />

                <div style={{ color: "#64748b", fontSize: 12, marginBottom: 14 }}>
                  Ao confirmar, o saldo do caixa será zerado e o fechamento registrado.
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button type="button" onClick={() => setEtapaFechamento("gaveta")} style={btnCancelarModal}>
                    ← Voltar
                  </button>
                  <button type="button" onClick={confirmarFechamento} disabled={fechandoCaixa}
                    style={{ ...btnConfirmarModal, background: "#4c1d95" }}>
                    {fechandoCaixa ? "Fechando..." : "✔ Confirmar Fechamento"}
                  </button>
                </div>
              </>

            ) : null}
          </div>
        </div>
      )}

      {/* ══════════ MODAL RELATÓRIOS ══════════ */}
      {modalRelatorios && (
        <div style={{ ...overlay, alignItems: "flex-start", paddingTop: 30 }}>
          <div style={{ ...modalBox, width: "min(96vw, 900px)", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a" }}>📊 Relatórios</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button type="button" onClick={imprimirRelatorio}
                  style={{ height: 34, padding: "0 14px", background: "#0f766e", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
                  🖨️ Imprimir / PDF
                </button>
                <button type="button" onClick={() => setModalRelatorios(false)} style={{ border: "none", background: "none", fontSize: 22, cursor: "pointer", color: "#475569" }}>×</button>
              </div>
            </div>

            {/* Filtro de data */}
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", marginBottom: 14, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Data início</div>
                <input type="date" value={dataInicioRel} onChange={(e) => setDataInicioRel(e.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 14 }} />
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 }}>Data fim</div>
                <input type="date" value={dataFimRel} onChange={(e) => setDataFimRel(e.target.value)}
                  style={{ border: "1px solid #d1d5db", borderRadius: 8, padding: "6px 10px", fontSize: 14 }} />
              </div>
              <button type="button" onClick={() => buscarRelatorios(dataInicioRel, dataFimRel)}
                style={{ height: 36, padding: "0 18px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>
                🔍 Buscar
              </button>
            </div>

            {erroRelatorio && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: "#dc2626", fontFamily: "monospace" }}>
                ⚠️ Erro ao buscar dados: {erroRelatorio}
              </div>
            )}

            {/* Abas */}
            <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
              {(["vendas", "itens", "cupons", "sangrias", "ranking", "fiado"] as const).map((aba) => (
                <button key={aba} type="button" onClick={() => setAbaRelatorio(aba)}
                  style={{ height: 34, padding: "0 14px", borderRadius: 8, border: "none", fontWeight: 700, fontSize: 13, cursor: "pointer",
                    background: abaRelatorio === aba ? "#1e3a5f" : "#f1f5f9",
                    color: abaRelatorio === aba ? "#fff" : "#374151",
                  }}>
                  { aba === "vendas"   ? "Vendas"
                  : aba === "itens"   ? "Itens Cancelados"
                  : aba === "cupons"  ? "Cupons Cancelados"
                  : aba === "sangrias" ? "Sangrias"
                  : aba === "ranking" ? "🏆 Mais Vendidos"
                  : "📒 Fiado" }
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: "auto" }}>
              {carregandoRel ? (
                <div style={{ color: "#64748b", padding: 20 }}>Carregando...</div>
              ) : abaRelatorio === "vendas" ? (
                <TabelaRelatorio
                  dados={relVendas}
                  colunas={["Cupom", "Data/Hora", "Pagamento", "Cliente", "Total"]}
                  renderLinha={(r) => [
                    "#" + String(r.id).slice(0, 8).toUpperCase(),
                    fmtHora(r.created_at),
                    r.tipo_pagamento || "—",
                    r.cliente_cpf ? r.cliente_cpf : "—",
                    moedaBR(r.total || 0),
                  ]}
                  vazio="Nenhuma venda no período."
                />
              ) : abaRelatorio === "cupons" ? (
                <TabelaRelatorio
                  dados={relCupons}
                  colunas={["Data/Hora", "Operador", "Total", "Motivo"]}
                  renderLinha={(r) => [fmtHora(r.created_at), r.operador || "—", moedaBR(r.total || 0), r.motivo || "—"]}
                  vazio="Nenhum cupom cancelado."
                />
              ) : abaRelatorio === "itens" ? (
                <TabelaRelatorio
                  dados={relItens}
                  colunas={["Data/Hora", "Operador", "Produto", "Qtd", "Total"]}
                  renderLinha={(r) => {
                    const precoUnit = r.preco ?? r.valor ?? 0;
                    const total = (r.quantidade ?? 0) * precoUnit;
                    return [fmtHora(r.created_at), r.operador || "—", r.produto_nome || "—", String(r.quantidade ?? "—"), total > 0 ? moedaBR(total) : "—"];
                  }}
                  vazio="Nenhum item cancelado."
                />
              ) : abaRelatorio === "sangrias" ? (
                <TabelaRelatorio
                  dados={relSangrias}
                  colunas={["Data/Hora", "Operador", "Valor", "Observação"]}
                  renderLinha={(r) => [fmtHora(r.created_at), r.operador || "—", moedaBR(r.valor || 0), r.observacao || "—"]}
                  vazio="Nenhuma sangria registrada."
                />
              ) : abaRelatorio === "fiado" ? (
                (() => {
                  const termo = filtroFiado.toLowerCase().trim();
                  const fiadoFiltrado = termo
                    ? relFiado.filter((r) => (r.cliente_nome || "").toLowerCase().includes(termo))
                    : relFiado;
                  // Agrupa por cliente
                  const porCliente: Record<string, { nome: string; total: number; cupons: any[] }> = {};
                  for (const r of fiadoFiltrado) {
                    const nome = r.cliente_nome || "Sem nome";
                    if (!porCliente[nome]) porCliente[nome] = { nome, total: 0, cupons: [] };
                    porCliente[nome].total += Number(r.total || 0);
                    porCliente[nome].cupons.push(r);
                  }
                  const clientes = Object.values(porCliente).sort((a, b) => a.nome.localeCompare(b.nome));
                  return (
                    <div>
                      <div style={{ marginBottom: 12 }}>
                        <input
                          type="text"
                          placeholder="🔍 Buscar por nome do cliente..."
                          value={filtroFiado}
                          onChange={(e) => setFiltroFiado(e.target.value)}
                          style={{ width: "100%", height: 36, padding: "0 12px", border: "1px solid #cbd5e1", borderRadius: 8, fontSize: 14, outline: "none" }}
                        />
                      </div>
                      {clientes.length === 0 ? (
                        <div style={{ padding: 24, color: "#66758a", textAlign: "center" }}>Nenhum lançamento de fiado no período.</div>
                      ) : clientes.map((cli) => (
                        <div key={cli.nome} style={{ marginBottom: 16, border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                          <div style={{ background: "#1e3a5f", color: "#fff", padding: "8px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontWeight: 800, fontSize: 15 }}>👤 {cli.nome}</span>
                            <span style={{ fontWeight: 700, fontSize: 15 }}>{moedaBR(cli.total)}</span>
                          </div>
                          <div style={{ background: "#f8fafc" }}>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 14px", fontWeight: 700, fontSize: 12, color: "#64748b", borderBottom: "1px solid #e2e8f0" }}>
                              <div>Cupom</div><div>Data/Hora</div><div style={{ textAlign: "right" }}>Valor</div>
                            </div>
                            {cli.cupons.map((r: any) => (
                              <div key={r.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 0, padding: "6px 14px", fontSize: 13, borderBottom: "1px solid #f1f5f9" }}>
                                <div style={{ fontFamily: "monospace", color: "#1e3a5f", fontWeight: 700 }}>#{String(r.id).slice(0, 8).toUpperCase()}</div>
                                <div style={{ color: "#475569" }}>{fmtHora(r.created_at)}</div>
                                <div style={{ textAlign: "right", fontWeight: 700, color: "#dc2626" }}>{moedaBR(r.total || 0)}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                      {clientes.length > 0 && (
                        <div style={{ fontWeight: 800, fontSize: 15, textAlign: "right", padding: "10px 4px", borderTop: "2px solid #1e3a5f", color: "#1e3a5f" }}>
                          Total geral: {moedaBR(fiadoFiltrado.reduce((s: number, r: any) => s + Number(r.total || 0), 0))}
                        </div>
                      )}
                    </div>
                  );
                })()
              ) : (
                carregandoRankingRel ? (
                  <div style={{ color: "#64748b", padding: 20 }}>Carregando ranking...</div>
                ) : relRanking.length === 0 ? (
                  <div style={{ padding: 24, color: "#66758a", textAlign: "center" }}>Nenhuma venda no período.</div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <div style={{ minWidth: 400 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr .7fr .9fr", gap: 12, padding: "10px 12px", fontWeight: 800, fontSize: 14, color: "#25354b", background: "#f8fafc", borderBottom: "1px solid #e5eaf0" }}>
                        <div>#</div><div>Produto</div><div style={{ textAlign: "right" }}>Qtd.</div><div style={{ textAlign: "right" }}>Receita</div>
                      </div>
                      {relRanking.map((item, idx) => {
                        const medalha = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : String(idx + 1);
                        return (
                          <div key={item.nome} style={{ display: "grid", gridTemplateColumns: "40px 1fr .7fr .9fr", gap: 12, padding: "12px 12px", alignItems: "center", borderTop: "1px solid #edf1f5", fontSize: 14, background: idx < 3 ? (idx === 0 ? "#fffbeb" : "#fafafa") : "#fff" }}>
                            <div style={{ fontWeight: 900, fontSize: 16 }}>{medalha}</div>
                            <div style={{ fontWeight: idx < 3 ? 800 : 600, color: "#11243d" }}>{item.nome}</div>
                            <div style={{ textAlign: "right", fontWeight: 800, color: "#1a7b39" }}>
                              {item.totalQtd % 1 === 0 ? item.totalQtd.toLocaleString("pt-BR") : item.totalQtd.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 3 })}
                            </div>
                            <div style={{ textAlign: "right", fontWeight: 700, color: "#1d3049" }}>{moedaBR(item.totalReceita)}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
      {/* ══════════ TRAVA DE CAIXA ALTO ══════════ */}
      {travaCaixa && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9998,
          background: "rgba(0,0,0,0.82)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            background: "#1c0a00", border: "2px solid #f97316",
            borderRadius: 20, padding: "36px 40px",
            width: "min(94vw, 460px)", textAlign: "center",
            boxShadow: "0 0 60px rgba(249,115,22,0.4)",
          }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#fed7aa", marginBottom: 10 }}>
              Caixa acima do limite!
            </div>
            <div style={{ color: "#fdba74", fontSize: 16, marginBottom: 6 }}>
              Valor em caixa: <strong style={{ fontSize: 20 }}>{moedaBR(totalCaixa)}</strong>
            </div>
            <div style={{ color: "#9a3412", background: "#431407", borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 24, fontWeight: 600 }}>
              Chame o gerente para realizar uma sangria antes de continuar.
            </div>
            <button
              onClick={abrirSangria}
              style={{
                background: "#ea580c", color: "#fff", border: "none",
                borderRadius: 12, padding: "14px 32px",
                fontWeight: 800, fontSize: 16, cursor: "pointer", width: "100%",
              }}>
              💰 Fazer Sangria (F7)
            </button>
          </div>
        </div>
      )}

      {/* ══════════ MODAL ABERTURA DE CAIXA ══════════ */}
      {modalAbrirCaixa && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)",
          display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999,
        }}>
          <div style={{
            background: "#fff", borderRadius: 20, padding: 36,
            width: "min(94vw, 420px)", boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
            textAlign: "center",
          }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🏪</div>
            <div style={{ fontWeight: 900, fontSize: 22, color: "#0f172a", marginBottom: 8 }}>
              Caixa fechado
            </div>
            <div style={{ color: "#475569", fontSize: 15, marginBottom: 24 }}>
              Deseja abrir o caixa agora?
            </div>

            <div style={{ marginBottom: 20, textAlign: "left" }}>
              <label style={{ fontWeight: 700, fontSize: 13, color: "#374151", display: "block", marginBottom: 6 }}>
                💰 Valor em dinheiro na gaveta (fundo de caixa)
              </label>
              <input
                ref={refValorAbertura}
                type="text"
                inputMode="decimal"
                placeholder="0,00"
                value={valorAbertura}
                onChange={e => setValorAbertura(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") abrirCaixa();
                }}
                style={{
                  width: "100%", padding: "12px 14px", fontSize: 18, fontWeight: 700,
                  border: "2px solid #d1d5db", borderRadius: 10, outline: "none",
                  boxSizing: "border-box", textAlign: "right",
                }}
              />
              <div style={{ fontSize: 12, color: "#6b7280", marginTop: 6 }}>
                Deixe em branco (ou zero) se não houver troco na gaveta
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={abrirCaixa}
                style={{
                  flex: 1, padding: "14px 0", background: "#15803d", color: "#fff",
                  border: "none", borderRadius: 12, fontWeight: 800, fontSize: 16, cursor: "pointer",
                }}>
                ✅ Abrir caixa
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}

/* ── Subcomponentes ── */

function Relogio() {
  // null no primeiro render (SSR) para evitar hydration mismatch com new Date()
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!agora) return <div style={{ width: 120, height: 42 }} />;
  const hora = agora.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const data = agora.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
  return (
    <div style={{ textAlign: "right", fontFamily: "monospace" }}>
      <div style={{ fontSize: 28, fontWeight: 900, color: "#1faa4a", letterSpacing: 2, lineHeight: 1 }}>
        {hora}
      </div>
      <div style={{ fontSize: 12, color: "rgba(255,255,255,.45)", marginTop: 3, letterSpacing: 1 }}>
        {data.toUpperCase()}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 7 }}>
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 700, marginBottom: 4 }}>
        {label}
      </div>
      {children}
    </div>
  );
}

function BotaoAtalho({ tecla, texto, onClick, cor, badge }: {
  tecla: string; texto: string; onClick?: () => void;
  cor?: string; badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 40,
        border: "none",
        borderRadius: 10,
        background: cor || "#0f7686",
        color: "#e0f2fe",
        fontWeight: 800,
        fontSize: 14,
        display: "grid",
        gridTemplateColumns: tecla === "ESC" || tecla === "Enter" ? "60px 1fr auto" : "42px 1fr auto",
        alignItems: "center",
        gap: 6,
        padding: "0 10px",
        cursor: "pointer",
        position: "relative",
      }}
    >
      <span style={{ height: 28, borderRadius: 7, background: "rgba(255,255,255,.25)", display: "inline-flex", alignItems: "center", justifyContent: "center", fontWeight: 900, color: "#e0f2fe", fontSize: 12 }}>
        {tecla}
      </span>
      <span style={{ textAlign: "left", fontSize: 13 }}>{texto}</span>
      {badge && (
        <span style={{ background: "#ef4444", color: "#fff", borderRadius: 999, padding: "2px 7px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
          {badge}
        </span>
      )}
    </button>
  );
}

function TabelaRelatorio({ dados, colunas, renderLinha, vazio }: {
  dados: any[]; colunas: string[];
  renderLinha: (r: any) => string[];
  vazio: string;
}) {
  if (dados.length === 0) return <div style={{ color: "#64748b", padding: 16 }}>{vazio}</div>;
  return (
    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
      <thead>
        <tr style={{ background: "#f1f5f9" }}>
          {colunas.map((c) => (
            <th key={c} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 700, color: "#374151", borderBottom: "1px solid #e2e8f0" }}>{c}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {dados.map((r, i) => (
          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
            {renderLinha(r).map((cell, j) => (
              <td key={j} style={{ padding: "7px 10px", borderBottom: "1px solid #f1f5f9", color: "#1e293b" }}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function fmtHora(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/* ── Estilos ── */

const colPanel: React.CSSProperties = {
  background: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: 14,
  padding: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,.06)",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const inputGrande: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 12,
  border: "1px solid #cbd5e1",
  background: "#ffffff",
  color: "#0f172a",
  padding: "0 14px",
  fontSize: 17,
  outline: "none",
};

/* ── Modais ── */
const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,.65)",
  zIndex: 10000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 16,
};

const modalBox: React.CSSProperties = {
  background: "#fff",
  borderRadius: 18,
  boxShadow: "0 20px 50px rgba(0,0,0,.45)",
  padding: 24,
  width: "min(96vw, 420px)",
};

const inputModal: React.CSSProperties = {
  width: "100%",
  height: 44,
  borderRadius: 10,
  border: "1px solid #d1d5db",
  padding: "0 14px",
  fontSize: 16,
  color: "#111827",
  outline: "none",
};

const labelModal: React.CSSProperties = {
  display: "block",
  fontWeight: 700,
  fontSize: 13,
  color: "#374151",
  marginBottom: 6,
};

const btnCancelarModal: React.CSSProperties = {
  height: 40,
  border: "1px solid #d1d5db",
  borderRadius: 10,
  background: "#f9fafb",
  color: "#374151",
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
};

const btnConfirmarModal: React.CSSProperties = {
  height: 40,
  border: "none",
  borderRadius: 10,
  background: "#1e3a5f",
  color: "#fff",
  fontWeight: 800,
  fontSize: 14,
  cursor: "pointer",
};
