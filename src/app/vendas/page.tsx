"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import SupervisorModal from "@/components/SupervisorModal";
import { canCancelSale } from "@/lib/permissions";
import { registrarAuditoria } from "@/lib/auditoria";

type Usuario = { login: string; senha: string; perfil: string; };
type MovimentoCaixa = { id: string; tipo: "ABERTURA" | "VENDA" | "SANGRIA" | "SUPRIMENTO" | "FECHAMENTO"; valor: number; motivo: string; dataHora: string; };
type CaixaAberto = { id: string; operador: string; perfil: string; abertoEm: string; valorAbertura: number; status: "ABERTO" | "FECHADO"; movimentos: MovimentoCaixa[]; };
type Produto = { id: string; codigo: string; descricao: string; categoria: string; unidade: string; preco: number; estoque: number; ativo: boolean; criadoEm: string; };
type Cliente = { id: string; nome: string; telefone: string; documento: string; endereco: string; limiteFiado: number; saldoFiado: number; ativo: boolean; criadoEm: string; };
type LancamentoFiado = { id: string; clienteId: string; clienteNome: string; tipo: "LANCAMENTO" | "PAGAMENTO"; valor: number; observacao: string; usuario: string; dataHora: string; };
type ItemVenda = { id: string; produtoId?: string; codigo: string; descricao: string; quantidade: number; precoUnitario: number; total: number; descontoItem?: number; };
type VendaFinalizada = { id: string; numero: number; operador: string; caixaId: string; dataHora: string; itens: ItemVenda[]; subtotal: number; desconto: number; total: number; formaPagamento: "DINHEIRO" | "PIX" | "CARTAO" | "FIADO"; clienteId?: string; clienteNome?: string; cancelada?: boolean; canceladaPor?: string; };
type MovimentoEstoque = { id: string; produtoId: string; produtoCodigo: string; produtoDescricao: string; tipo: "ENTRADA" | "AJUSTE" | "PERDA" | "QUEBRA" | "SAIDA_VENDA"; quantidade: number; estoqueAnterior: number; estoqueAtual: number; motivo: string; usuario: string; dataHora: string; };
type UsuarioSistema = { login: string; senha: string; perfil: string; };

const STORAGE_USER="umbrela_usuario"; const STORAGE_CAIXA="umbrela_caixa_atual"; const STORAGE_VENDAS="umbrela_vendas"; const STORAGE_PRODUTOS="umbrela_produtos"; const STORAGE_ESTOQUE_MOVIMENTOS="umbrela_estoque_movimentos"; const STORAGE_CLIENTES="umbrela_clientes"; const STORAGE_FIADO="umbrela_fiado_lancamentos";
function gerarId(){ return `${Date.now()}-${Math.random().toString(36).slice(2,10)}`; }
function formatMoney(value:number){ return new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(value); }

export default function VendasPage(){
  const router=useRouter();
  const [usuario,setUsuario]=useState<Usuario|null>(null);
  const [caixa,setCaixa]=useState<CaixaAberto|null>(null);
  const [vendas,setVendas]=useState<VendaFinalizada[]>([]);
  const [produtos,setProdutos]=useState<Produto[]>([]);
  const [clientes,setClientes]=useState<Cliente[]>([]);
  const [codigo,setCodigo]=useState(""); const [descricao,setDescricao]=useState(""); const [quantidade,setQuantidade]=useState("1"); const [precoUnitario,setPrecoUnitario]=useState(""); const [descontoItem,setDescontoItem]=useState("0"); const [desconto,setDesconto]=useState("0");
  const [formaPagamento,setFormaPagamento]=useState<"DINHEIRO"|"PIX"|"CARTAO"|"FIADO">("DINHEIRO"); const [clienteFiadoId,setClienteFiadoId]=useState("");
  const [itens,setItens]=useState<ItemVenda[]>([]); const [mensagem,setMensagem]=useState(""); const [erro,setErro]=useState(""); const [vendaParaCancelar,setVendaParaCancelar]=useState<VendaFinalizada|null>(null);
  const [filtroRapido,setFiltroRapido]=useState("");

  useEffect(()=>{ const u=localStorage.getItem(STORAGE_USER); if(!u){router.push("/login"); return;} try{setUsuario(JSON.parse(u) as Usuario);}catch{localStorage.removeItem(STORAGE_USER); router.push("/login"); return;}
    const c=localStorage.getItem(STORAGE_CAIXA); if(c) try{setCaixa(JSON.parse(c) as CaixaAberto);}catch{}
    const v=localStorage.getItem(STORAGE_VENDAS); if(v) try{setVendas(JSON.parse(v) as VendaFinalizada[]);}catch{}
    const p=localStorage.getItem(STORAGE_PRODUTOS); if(p) try{setProdutos(JSON.parse(p) as Produto[]);}catch{}
    const cli=localStorage.getItem(STORAGE_CLIENTES); if(cli) try{setClientes(JSON.parse(cli) as Cliente[]);}catch{}
  },[router]);

  const caixaAberto=!!caixa&&caixa.status==="ABERTO";
  const subtotal=useMemo(()=>itens.reduce((acc,item)=>acc+item.total,0),[itens]);
  const descontoValor=useMemo(()=>{ const v=Number(desconto.replace(",", ".")); return Number.isNaN(v)||v<0?0:v; },[desconto]);
  const total=useMemo(()=>Math.max(0, subtotal-descontoValor),[subtotal,descontoValor]);
  const clienteSelecionadoFiado = useMemo(() => clientes.find((c) => c.id===clienteFiadoId) ?? null, [clienteFiadoId, clientes]);
  const produtosSugestoes = useMemo(() => {
    const termo = filtroRapido.trim().toLowerCase();
    if (!termo) return [];
    return produtos.filter((p) => p.ativo && (p.codigo.toLowerCase().includes(termo) || p.descricao.toLowerCase().includes(termo))).slice(0,8);
  }, [filtroRapido, produtos]);

  function salvarProdutos(lista: Produto[]){ setProdutos(lista); localStorage.setItem(STORAGE_PRODUTOS, JSON.stringify(lista)); }
  function salvarVendas(lista: VendaFinalizada[]){ setVendas(lista); localStorage.setItem(STORAGE_VENDAS, JSON.stringify(lista)); }
  function salvarClientes(lista: Cliente[]){ setClientes(lista); localStorage.setItem(STORAGE_CLIENTES, JSON.stringify(lista)); }
  function salvarCaixa(novoCaixa: CaixaAberto | null){ setCaixa(novoCaixa); if(novoCaixa) localStorage.setItem(STORAGE_CAIXA, JSON.stringify(novoCaixa)); else localStorage.removeItem(STORAGE_CAIXA); }
  function limparFormularioItem(){ setCodigo(""); setDescricao(""); setQuantidade("1"); setPrecoUnitario(""); setDescontoItem("0"); setFiltroRapido(""); }
  function limparVenda(){ setItens([]); setDesconto("0"); setFormaPagamento("DINHEIRO"); setClienteFiadoId(""); limparFormularioItem(); }

  function buscarProdutoPorCodigo(){
    setErro(""); setMensagem("");
    const termo = codigo.trim() || filtroRapido.trim();
    if(!termo){ setErro("Informe o código ou pesquisa rápida."); return; }
    const produto = produtos.find((item)=>item.ativo && (item.codigo.toLowerCase()===termo.toLowerCase() || item.descricao.toLowerCase()===termo.toLowerCase()));
    if(!produto){ setErro("Produto não encontrado ou inativo."); return; }
    setCodigo(produto.codigo); setDescricao(produto.descricao); setPrecoUnitario(String(produto.preco)); setMensagem("Produto localizado com sucesso.");
  }

  function selecionarProduto(produto: Produto) {
    setCodigo(produto.codigo); setDescricao(produto.descricao); setPrecoUnitario(String(produto.preco)); setFiltroRapido(produto.descricao);
  }

  function adicionarItem(){
    setErro(""); setMensagem("");
    if(!caixaAberto){ setErro("Não é possível vender sem caixa aberto."); return; }
    if(!descricao.trim()){ setErro("Informe a descrição do item."); return; }
    const qtd=Number(quantidade.replace(",", ".")); const preco=Number(precoUnitario.replace(",", ".")); const descItem=Number(descontoItem.replace(",", "."));
    if(Number.isNaN(qtd)||qtd<=0){ setErro("Informe uma quantidade válida."); return; }
    if(Number.isNaN(preco)||preco<=0){ setErro("Informe um preço unitário válido."); return; }
    if(Number.isNaN(descItem)||descItem<0){ setErro("Informe desconto do item válido."); return; }
    const produtoEncontrado=produtos.find((item)=> item.codigo.toLowerCase()===codigo.trim().toLowerCase() && item.ativo);
    if(produtoEncontrado && qtd>produtoEncontrado.estoque){ setErro(`Estoque insuficiente. Saldo atual de ${produtoEncontrado.descricao}: ${produtoEncontrado.estoque}.`); return; }
    const totalItem = Math.max(0, qtd*preco - descItem);
    const item: ItemVenda = { id: gerarId(), produtoId: produtoEncontrado?.id, codigo: codigo.trim(), descricao: descricao.trim(), quantidade:qtd, precoUnitario:preco, total: totalItem, descontoItem: descItem };
    setItens((estadoAtual)=>[...estadoAtual,item]); limparFormularioItem(); setMensagem("Item adicionado à venda.");
  }

  function solicitarRemocaoItem(itemId: string) {
    if (!usuario) return;
    if (canCancelSale(usuario.perfil)) {
      setItens((estadoAtual)=>estadoAtual.filter((item)=>item.id!==itemId));
      setMensagem("Item removido da venda.");
      return;
    }
    setErro("Cancelamento de item exige supervisor no fluxo atual. Use um supervisor para cancelar venda finalizada.");
  }

  function cancelarVendaAtual(){ setErro(""); setMensagem(""); limparVenda(); setMensagem("Venda atual cancelada."); }

  function validarEstoqueAntesDeFinalizar(){
    for(const item of itens){ if(!item.produtoId) continue; const produto=produtos.find((p)=>p.id===item.produtoId); if(!produto){ setErro(`Produto ${item.descricao} não encontrado no cadastro.`); return false; } if(!produto.ativo){ setErro(`Produto ${item.descricao} está inativo.`); return false; } if(item.quantidade > produto.estoque){ setErro(`Estoque insuficiente para ${produto.descricao}. Saldo: ${produto.estoque}.`); return false; } }
    return true;
  }
  function validarFiadoAntesDeFinalizar(){
    if(formaPagamento!=="FIADO") return true;
    if(!clienteFiadoId){ setErro("Selecione um cliente para finalizar em fiado."); return false; }
    const cliente=clientes.find((item)=>item.id===clienteFiadoId); if(!cliente){ setErro("Cliente do fiado não encontrado."); return false; } if(!cliente.ativo){ setErro("Cliente inativo."); return false; }
    const novoSaldo=cliente.saldoFiado+total; if(novoSaldo>cliente.limiteFiado){ setErro(`Limite de fiado excedido. Limite: ${formatMoney(cliente.limiteFiado)}. Saldo atual: ${formatMoney(cliente.saldoFiado)}.`); return false; }
    return true;
  }
  function registrarEntradaNoCaixa(numeroVenda:number,totalVenda:number,forma:"DINHEIRO"|"PIX"|"CARTAO"){ if(!caixa||caixa.status!=="ABERTO") return; const movimentoVenda:MovimentoCaixa={ id:gerarId(), tipo:"VENDA", valor:totalVenda, motivo:`Venda #${numeroVenda} - ${forma}`, dataHora:new Date().toISOString() }; salvarCaixa({ ...caixa, movimentos:[...caixa.movimentos, movimentoVenda] }); }

  function finalizarVenda(){
    setErro(""); setMensagem("");
    if(!usuario){ setErro("Usuário não identificado."); return; }
    if(!caixa||caixa.status!=="ABERTO"){ setErro("Não há caixa aberto."); return; }
    if(itens.length===0){ setErro("Adicione ao menos um item para finalizar a venda."); return; }
    if(!validarEstoqueAntesDeFinalizar() || !validarFiadoAntesDeFinalizar()) return;
    const proximoNumero = vendas.length>0 ? Math.max(...vendas.map((v)=>v.numero))+1 : 1;
    const novaVenda:VendaFinalizada = { id:gerarId(), numero:proximoNumero, operador:usuario.login, caixaId:caixa.id, dataHora:new Date().toISOString(), itens, subtotal, desconto:descontoValor, total, formaPagamento, clienteId: formaPagamento==="FIADO" ? clienteFiadoId : undefined, clienteNome: formaPagamento==="FIADO" ? clienteSelecionadoFiado?.nome : undefined, cancelada:false };
    salvarVendas([...vendas,novaVenda]);

    const movimentosSalvos=localStorage.getItem(STORAGE_ESTOQUE_MOVIMENTOS); let movimentosEstoque:MovimentoEstoque[]=[]; if(movimentosSalvos) try{movimentosEstoque=JSON.parse(movimentosSalvos) as MovimentoEstoque[];}catch{}
    const produtosAtualizados=[...produtos]; const novosMovimentos:MovimentoEstoque[]=[];
    for(const item of itens){ if(!item.produtoId) continue; const produto=produtosAtualizados.find((p)=>p.id===item.produtoId); if(!produto) continue; const estoqueAnterior=produto.estoque; const estoqueAtual=estoqueAnterior-item.quantidade; produto.estoque=estoqueAtual; novosMovimentos.push({ id:gerarId(), produtoId:produto.id, produtoCodigo:produto.codigo, produtoDescricao:produto.descricao, tipo:"SAIDA_VENDA", quantidade:item.quantidade, estoqueAnterior, estoqueAtual, motivo:`Baixa automática pela venda #${proximoNumero}`, usuario:usuario.login, dataHora:new Date().toISOString() }); }
    salvarProdutos([...produtosAtualizados]); localStorage.setItem(STORAGE_ESTOQUE_MOVIMENTOS, JSON.stringify([...movimentosEstoque,...novosMovimentos]));

    if(formaPagamento==="DINHEIRO"||formaPagamento==="PIX"||formaPagamento==="CARTAO"){ registrarEntradaNoCaixa(proximoNumero,total,formaPagamento); }

    if(formaPagamento==="FIADO"&&clienteSelecionadoFiado){
      const clientesAtualizados=clientes.map((cliente)=>cliente.id===clienteSelecionadoFiado.id?{...cliente,saldoFiado:cliente.saldoFiado+total}:cliente);
      salvarClientes(clientesAtualizados);
      const fiadoSalvo=localStorage.getItem(STORAGE_FIADO); let lancamentosFiado:LancamentoFiado[]=[]; if(fiadoSalvo) try{lancamentosFiado=JSON.parse(fiadoSalvo) as LancamentoFiado[];}catch{}
      const novoLancamentoFiado:LancamentoFiado={ id:gerarId(), clienteId:clienteSelecionadoFiado.id, clienteNome:clienteSelecionadoFiado.nome, tipo:"LANCAMENTO", valor:total, observacao:`Venda fiado #${proximoNumero}`, usuario:usuario.login, dataHora:new Date().toISOString() };
      localStorage.setItem(STORAGE_FIADO, JSON.stringify([...lancamentosFiado, novoLancamentoFiado]));
    }

    registrarAuditoria({ usuario:usuario.login, perfil:usuario.perfil, acao:"FINALIZACAO_VENDA", descricao: formaPagamento==="FIADO" ? `Venda #${proximoNumero} finalizada em fiado para ${clienteSelecionadoFiado?.nome ?? "cliente"} no total de ${total.toFixed(2)}.` : `Venda #${proximoNumero} finalizada em ${formaPagamento} com total ${total.toFixed(2)}.`, referencia:String(proximoNumero) });
    limparVenda(); setMensagem(formaPagamento==="FIADO" ? `Venda #${proximoNumero} finalizada em fiado com sucesso.` : `Venda #${proximoNumero} finalizada com sucesso e lançada no caixa.`);
  }

  function solicitarCancelamento(venda:VendaFinalizada){ if(!usuario) return; setErro(""); setMensagem(""); if(venda.cancelada){ setErro("Esta venda já foi cancelada."); return; } if(canCancelSale(usuario.perfil)){ executarCancelamento(venda, usuario.login); return; } setVendaParaCancelar(venda); }
  function executarCancelamento(venda:VendaFinalizada,autorizadoPor:string){ if(!usuario) return; salvarVendas(vendas.map((item)=>item.id===venda.id?{...item,cancelada:true,canceladaPor:autorizadoPor}:item)); registrarAuditoria({ usuario:usuario.login, perfil:usuario.perfil, acao:"CANCELAMENTO_VENDA", descricao:`Venda #${venda.numero} cancelada.`, referencia:String(venda.numero), autorizadoPor }); setVendaParaCancelar(null); setMensagem(`Venda #${venda.numero} cancelada com sucesso.`); }
  function aoAutorizarSupervisor(supervisor:UsuarioSistema){ if(!usuario||!vendaParaCancelar) return; registrarAuditoria({ usuario:usuario.login, perfil:usuario.perfil, acao:"AUTORIZACAO_SUPERVISOR", descricao:`Autorização de supervisor concedida por ${supervisor.login} para cancelamento de venda.`, autorizadoPor:supervisor.login, referencia:String(vendaParaCancelar.numero) }); executarCancelamento(vendaParaCancelar, supervisor.login); }

  if(!usuario) return <main className="app-shell"><div className="container"><div className="card"><h1 className="card-title">Carregando...</h1></div></div></main>;
  return <>
    <SupervisorModal aberto={!!vendaParaCancelar} titulo="Autorização de supervisor" descricao="O cancelamento da venda exige autorização de supervisor." onFechar={() => setVendaParaCancelar(null)} onAutorizado={aoAutorizarSupervisor} />
    <main className="app-shell"><div className="container">
      <header className="topbar"><div className="brand"><div className="brand-badge">🛒</div><div><h1 className="brand-title">PDV / Vendas</h1><p className="brand-subtitle">Operador: <strong>{usuario.login}</strong> ({usuario.perfil})</p></div></div><div className="actions-row"><button onClick={() => router.push("/dashboard")} className="btn btn-secondary">Voltar</button></div></header>
      <div style={{ height: 20 }} />
      {mensagem ? <div className="alert alert-success">{mensagem}</div> : null}
      {erro ? <div className="alert alert-error" style={{ marginTop: mensagem ? 12 : 0 }}>{erro}</div> : null}
      <div style={{ height: mensagem || erro ? 20 : 0 }} />
      <section className="grid grid-4">
        <div className="card"><div className="stats-label">Status do caixa</div><div className="stats-value">{caixaAberto ? "Aberto":"Fechado"}</div><span className="kpi-chip">Regra operacional</span></div>
        <div className="card"><div className="stats-label">Itens na venda</div><div className="stats-value">{itens.length}</div><span className="kpi-chip">Carrinho atual</span></div>
        <div className="card"><div className="stats-label">Subtotal</div><div className="stats-value">{formatMoney(subtotal)}</div><span className="kpi-chip">Antes do desconto</span></div>
        <div className="card"><div className="stats-label">Total</div><div className="stats-value">{formatMoney(total)}</div><span className="kpi-chip">Venda atual</span></div>
      </section>
      <div style={{ height:20 }} />
      {!caixaAberto ? <section className="card"><h3 className="card-title">Venda bloqueada</h3><p className="card-text" style={{ marginBottom: 16 }}>Para realizar vendas, primeiro abra o caixa.</p><button onClick={() => router.push("/caixa")} className="btn btn-primary">Ir para o caixa</button></section> : <>
        <section className="grid grid-2">
          <div className="card">
            <h3 className="card-title">Adicionar item</h3>
            <label className="label">Pesquisa rápida</label><input className="input" value={filtroRapido} onChange={(e)=>setFiltroRapido(e.target.value)} placeholder="Código ou descrição" />
            {produtosSugestoes.length > 0 ? <div style={{ marginTop: 10, display: "grid", gap: 8 }}>{produtosSugestoes.map((produto)=><button key={produto.id} className="btn btn-secondary" onClick={()=>selecionarProduto(produto)} style={{ textAlign: "left" }}>{produto.codigo} - {produto.descricao}</button>)}</div> : null}
            <div style={{ height:12 }} />
            <label className="label">Código</label><div className="actions-row"><input className="input" value={codigo} onChange={(e)=>setCodigo(e.target.value)} style={{ flex:1 }} /><button onClick={buscarProdutoPorCodigo} className="btn btn-secondary">Buscar</button></div>
            <div style={{ height:12 }} />
            <label className="label">Descrição</label><input className="input" value={descricao} onChange={(e)=>setDescricao(e.target.value)} />
            <div style={{ height:12 }} />
            <div className="grid grid-2">
              <div><label className="label">Quantidade</label><input className="input" type="number" step="0.001" value={quantidade} onChange={(e)=>setQuantidade(e.target.value)} /></div>
              <div><label className="label">Preço unitário</label><input className="input" type="number" step="0.01" value={precoUnitario} onChange={(e)=>setPrecoUnitario(e.target.value)} /></div>
            </div>
            <div style={{ height:12 }} />
            <label className="label">Desconto do item</label><input className="input" type="number" step="0.01" value={descontoItem} onChange={(e)=>setDescontoItem(e.target.value)} />
            <div style={{ height:16 }} />
            <button onClick={adicionarItem} className="btn btn-primary">Adicionar item</button>
          </div>

          <div className="card">
            <h3 className="card-title">Resumo da venda</h3>
            <label className="label">Desconto geral da venda</label><input className="input" type="number" step="0.01" value={desconto} onChange={(e)=>setDesconto(e.target.value)} />
            <div style={{ height:12 }} />
            <label className="label">Forma de pagamento</label>
            <select className="select" value={formaPagamento} onChange={(e)=>setFormaPagamento(e.target.value as "DINHEIRO"|"PIX"|"CARTAO"|"FIADO")}>
              <option value="DINHEIRO">Dinheiro</option><option value="PIX">PIX</option><option value="CARTAO">Cartão</option><option value="FIADO">Fiado</option>
            </select>
            {formaPagamento==="FIADO" ? <>
              <div style={{ height:12 }} />
              <label className="label">Cliente do fiado</label>
              <select className="select" value={clienteFiadoId} onChange={(e)=>setClienteFiadoId(e.target.value)}>
                <option value="">Selecione</option>
                {clientes.filter((cliente)=>cliente.ativo).map((cliente)=><option key={cliente.id} value={cliente.id}>{cliente.nome} - Saldo: {formatMoney(cliente.saldoFiado)} - Limite: {formatMoney(cliente.limiteFiado)}</option>)}
              </select>
            </> : null}
            <div style={{ height:18 }} />
            <div style={{ display:"grid", gap:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:12, borderRadius:12, background:"#f8faf8", border:"1px solid var(--border)" }}><strong>Subtotal</strong><span>{formatMoney(subtotal)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:12, borderRadius:12, background:"#fff8eb", border:"1px solid #f5deb3" }}><strong>Desconto</strong><span>{formatMoney(descontoValor)}</span></div>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:14, borderRadius:14, background:"linear-gradient(135deg, #2f855a, #276749)", color:"#fff" }}><strong>Total</strong><strong style={{ fontSize:22 }}>{formatMoney(total)}</strong></div>
            </div>
            <div style={{ height:18 }} />
            <div className="actions-row"><button onClick={cancelarVendaAtual} className="btn btn-danger">Cancelar venda atual</button><button onClick={finalizarVenda} className="btn btn-dark">Finalizar venda</button></div>
          </div>
        </section>
        <div style={{ height:20 }} />
        <section className="card"><h3 className="card-title">Itens da venda atual</h3>{itens.length===0 ? <p className="card-text">Nenhum item adicionado.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Código</th><th>Descrição</th><th>Qtd.</th><th>Preço unit.</th><th>Total</th><th>Ação</th></tr></thead><tbody>{itens.map((item)=>{ const produto=item.produtoId ? produtos.find((p)=>p.id===item.produtoId) : null; return <tr key={item.id}><td>{item.codigo || "-"}</td><td>{item.descricao}</td><td>{item.quantidade}</td><td>{formatMoney(item.precoUnitario)}</td><td>{formatMoney(item.total)}</td><td><div style={{ display:"grid", gap:6 }}><button onClick={() => solicitarRemocaoItem(item.id)} className="btn btn-secondary" style={{ padding:"8px 12px" }}>Remover</button>{produto ? <small className="muted">Saldo: {produto.estoque}</small> : null}</div></td></tr>; })}</tbody></table></div>}</section>
        <div style={{ height:20 }} />
        <section className="card"><h3 className="card-title">Últimas vendas finalizadas</h3>{vendas.length===0 ? <p className="card-text">Nenhuma venda finalizada ainda.</p> : <div className="table-wrap"><table className="table"><thead><tr><th>Nº</th><th>Data/Hora</th><th>Operador</th><th>Pagamento</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Ação</th></tr></thead><tbody>{vendas.slice().reverse().slice(0,10).map((venda)=><tr key={venda.id}><td>{venda.numero}</td><td>{new Date(venda.dataHora).toLocaleString("pt-BR")}</td><td>{venda.operador}</td><td>{venda.formaPagamento}</td><td>{venda.clienteNome || "-"}</td><td>{venda.itens.length}</td><td>{formatMoney(venda.total)}</td><td>{venda.cancelada ? "Cancelada" : "Ativa"}</td><td><button onClick={() => solicitarCancelamento(venda)} className="btn btn-secondary" style={{ padding:"8px 12px", opacity: venda.cancelada ? 0.5 : 1 }} disabled={!!venda.cancelada}>Cancelar</button></td></tr>)}</tbody></table></div>}</section>
      </>}
    </div></main>
  </>;
}
