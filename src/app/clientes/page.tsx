'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import HeaderCebolao from "@/components/HeaderCebolao";
import { supabase, db } from "@/lib/supabaseClient";
import { useIsMobile } from "@/hooks/useIsMobile";

type Cliente = {
  id: string;
  nome: string;
  telefone: string | null;
  saldo: number | null;
  limite: number | null;
  cidade?: string | null;
  cpf?: string | null;
  whatsapp?: string | null;
  cep?: string | null;
  endereco?: string | null;
  bairro?: string | null;
  status?: string | null;
  numero?: string | null;
  complemento?: string | null;
};

function moeda(v: number | null | undefined) {
  return `R$ ${Number(v || 0).toFixed(2).replace(".", ",")}`;
}

function somenteDigitos(valor: string) {
  return (valor || "").replace(/\D/g, "");
}

function formatarCEP(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 8);
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatarCPF(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 11);
  return digits
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function formatarTelefone(valor: string) {
  const digits = somenteDigitos(valor).slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  return digits.replace(/^(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d)/, "$1-$2");
}

function formatarDinheiroInput(valor: string) {
  const digits = String(valor || "").replace(/\D/g, "");
  const numero = Number(digits || "0") / 100;
  return numero.toFixed(2).replace(".", ",");
}

export default function ClientesPage() {
  const isMobile = useIsMobile();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [mensagem, setMensagem] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [nome, setNome] = useState("");
  const [cpf, setCpf] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [cep, setCep] = useState("");
  const [endereco, setEndereco] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [limite, setLimite] = useState("0,00");
  const [saldo, setSaldo] = useState("0,00");

  const carregarClientes = useCallback(async () => {
    const { data } = await db("clientes")
      .select("id, nome, telefone, limite, saldo, cpf, whatsapp, cep, endereco, bairro, cidade, status, numero, complemento")
      .order("nome", { ascending: true });

    const lista = (data || []).map((item: Record<string, unknown>) => ({
      ...item,
      cidade: (item.cidade as string) ?? "Campinas",
      cpf: (item.cpf as string) ?? "",
      whatsapp: (item.whatsapp as string) ?? (item.telefone as string) ?? "",
      cep: (item.cep as string) ?? "",
      endereco: (item.endereco as string) ?? "",
      bairro: (item.bairro as string) ?? "",
      status: (item.status as string) ?? "Ativo",
      numero: (item.numero as string) ?? "",
      complemento: (item.complemento as string) ?? "",
    }));

    setClientes(lista as Cliente[]);
  }, []);

  useEffect(() => {
    carregarClientes();

    const channel = supabase
      .channel("clientes-layout-lista-final")
      .on("postgres_changes", { event: "*", schema: "public", table: "clientes" }, () => {
        carregarClientes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [carregarClientes]);

  useEffect(() => {
    const cepDigits = somenteDigitos(cep);
    if (cepDigits.length !== 8) return;

    let ativo = true;

    async function autoBuscarCEP() {
      try {
        setBuscandoCEP(true);
        const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await response.json();
        if (!ativo || data.erro) return;

        setEndereco(data.logradouro || "");
        setBairro(data.bairro || "");
        setCidade(data.localidade || "");
      } catch {
      } finally {
        if (ativo) setBuscandoCEP(false);
      }
    }

    autoBuscarCEP();
    return () => {
      ativo = false;
    };
  }, [cep]);

  function parseBRL(value: string) {
    return Number((value || "0").replace(/\./g, "").replace(",", "."));
  }

  function limparFormulario() {
    setEditandoId(null);
    setNome("");
    setCpf("");
    setTelefone("");
    setWhatsapp("");
    setCep("");
    setEndereco("");
    setBairro("");
    setCidade("");
    setNumero("");
    setComplemento("");
    setLimite("0,00");
    setSaldo("0,00");
  }

  async function salvarCliente(e: React.FormEvent) {
    e.preventDefault();
    setMensagem("");
    setSalvando(true);

    const payload = {
      nome: nome.trim(),
      telefone: telefone.trim() || null,
      limite: parseBRL(limite),
      saldo: parseBRL(saldo),
      cpf: cpf.trim() || null,
      whatsapp: whatsapp.trim() || null,
      cep: cep.trim() || null,
      endereco: endereco.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      status: "Ativo",
    };

    let error: { message: string } | null = null;

    if (editandoId) {
      const result = await db("clientes").update(payload).eq("id", editandoId);
      error = result.error;
    } else {
      const result = await db("clientes").insert([payload]);
      error = result.error;
    }

    if (error) {
      setMensagem("Erro ao salvar cliente: " + error.message);
    } else {
      setMensagem(editandoId ? "Cliente atualizado com sucesso." : "Cliente salvo com sucesso.");
      limparFormulario();
      carregarClientes();
    }

    setSalvando(false);
  }

  async function buscarCEP() {
    const cepDigits = somenteDigitos(cep);
    if (cepDigits.length !== 8) {
      setMensagem("Informe um CEP válido com 8 números.");
      return;
    }

    try {
      setBuscandoCEP(true);
      const response = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
      const data = await response.json();

      if (data.erro) {
        setMensagem("CEP não encontrado.");
        return;
      }

      setEndereco(data.logradouro || "");
      setBairro(data.bairro || "");
      setCidade(data.localidade || "");
      setMensagem("CEP encontrado e preenchido automaticamente.");
    } catch {
      setMensagem("Não foi possível consultar o CEP agora.");
    } finally {
      setBuscandoCEP(false);
    }
  }

  function abrirEdicao(cliente: Cliente) {
    setEditandoId(cliente.id);
    setNome(cliente.nome || "");
    setCpf(cliente.cpf || "");
    setTelefone(cliente.telefone || "");
    setWhatsapp(cliente.whatsapp || "");
    setCep(cliente.cep || "");
    setEndereco(cliente.endereco || "");
    setBairro(cliente.bairro || "");
    setCidade(cliente.cidade || "");
    setNumero(cliente.numero || "");
    setComplemento(cliente.complemento || "");
    setLimite(formatarDinheiroInput(String(Math.round(Number(cliente.limite || 0) * 100))));
    setSaldo(formatarDinheiroInput(String(Math.round(Number(cliente.saldo || 0) * 100))));
    setMensagem(`Editando cliente: ${cliente.nome}`);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function excluirCliente(id: string) {
    const { error } = await db("clientes").delete().eq("id", id);
    if (error) {
      setMensagem("Erro ao excluir cliente: " + error.message);
      return;
    }
    setMensagem("Cliente excluído com sucesso.");
    if (editandoId === id) limparFormulario();
    carregarClientes();
  }

  const totalClientes = useMemo(() => clientes.length, [clientes]);

  return (
    <main style={{ minHeight: "100vh", background: "#f3f5f7", padding: 12 }}>
      <div style={{ maxWidth: 1460, margin: "0 auto" }}>
        <HeaderCebolao />

        {mensagem ? <div style={msgBox}>{mensagem}</div> : null}

        <div style={{ ...contentGrid, gridTemplateColumns: isMobile ? "1fr" : "540px 1fr" }}>
          <section style={cardLeft}>
            <div style={title}>{editandoId ? "Editar cliente" : "Novo cliente"}</div>
            <div style={subtitle}>Cadastro para vendas à vista e controle de fiado.</div>

            <form onSubmit={salvarCliente}>
              <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
                <Field label="Nome do cliente">
                  <input style={input} value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" required />
                </Field>

                <Field label="CPF">
                  <input style={input} value={cpf} onChange={(e) => setCpf(formatarCPF(e.target.value))} placeholder="000.000.000-00" />
                </Field>

                <Field label="Telefone">
                  <input style={input} value={telefone} onChange={(e) => setTelefone(formatarTelefone(e.target.value))} placeholder="(00) 00000-0000" />
                </Field>

                <Field label="WhatsApp">
                  <input style={input} value={whatsapp} onChange={(e) => setWhatsapp(formatarTelefone(e.target.value))} placeholder="(00) 00000-0000" />
                </Field>

                <Field label="CEP">
                  <input style={input} value={cep} onChange={(e) => setCep(formatarCEP(e.target.value))} placeholder="00000-000" />
                </Field>

                <div style={{ display: "flex", alignItems: "end" }}>
                  <button type="button" onClick={buscarCEP} style={blueButton}>
                    {buscandoCEP ? "Buscando..." : "Buscar CEP manualmente"}
                  </button>
                </div>

                <Field label="Endereço">
                  <input style={input} value={endereco} onChange={(e) => setEndereco(e.target.value)} placeholder="Rua, avenida" />
                </Field>

                <Field label="Número">
                  <input style={input} value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Número" />
                </Field>

                <Field label="Complemento">
                  <input style={input} value={complemento} onChange={(e) => setComplemento(e.target.value)} placeholder="Complemento" />
                </Field>

                <Field label="Bairro">
                  <input style={input} value={bairro} onChange={(e) => setBairro(e.target.value)} placeholder="Bairro" />
                </Field>

                <Field label="Cidade">
                  <input style={input} value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Cidade" />
                </Field>

                <div></div>
              </div>

              <div style={miniBox}>
                <div style={{ ...grid2, gridTemplateColumns: isMobile ? "1fr" : "repeat(2, minmax(0,1fr))" }}>
                  <Field label="Limite de fiado">
                    <input style={input} value={limite} onChange={(e) => setLimite(formatarDinheiroInput(e.target.value))} placeholder="0,00" inputMode="numeric" />
                  </Field>

                  <Field label="Saldo disponível">
                    <input style={input} value={saldo} onChange={(e) => setSaldo(formatarDinheiroInput(e.target.value))} placeholder="0,00" inputMode="numeric" />
                  </Field>
                </div>
              </div>

              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button type="submit" disabled={salvando} style={saveButton}>
                  {salvando ? "Salvando..." : editandoId ? "Salvar edição" : "Salvar cliente"}
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
                <div style={title}>Clientes cadastrados</div>
                <div style={subtitle}>Controle de cadastro, crédito e status do cliente.</div>
              </div>

              <div style={greenCounter}>{totalClientes} clientes</div>
            </div>

            <div style={{ overflowX: "auto" }}>
            <div style={{ ...tableWrap, minWidth: 580 }}>
              <div style={thead}>
                <div>Cliente</div>
                <div>Telefone</div>
                <div>Cidade</div>
                <div>Limite</div>
                <div>Saldo</div>
                <div>Status</div>
                <div>Ações</div>
              </div>

              {clientes.length === 0 ? (
                <div style={{ padding: 16, color: "#66758a" }}>Nenhum cliente cadastrado.</div>
              ) : (
                clientes.map((cliente) => (
                  <div key={cliente.id} style={trow}>
                    <div>
                      <div style={{ fontWeight: 900, fontSize: 18, color: "#10243d", lineHeight: 1.05 }}>{cliente.nome}</div>
                      <div style={{ color: "#66758a", marginTop: 2 }}>{cliente.cpf || "Sem CPF"}</div>
                    </div>
                    <div>{cliente.telefone || "-"}</div>
                    <div>{cliente.cidade || "-"}</div>
                    <div>{moeda(cliente.limite)}</div>
                    <div>{moeda(cliente.saldo)}</div>
                    <div><span style={statusPill}>{cliente.status || "Ativo"}</span></div>
                    <div style={{ display: "grid", gap: 10 }}>
                      <button onClick={() => abrirEdicao(cliente)} style={editButton}>Editar</button>
                      <button onClick={() => excluirCliente(cliente.id)} style={deleteButton}>Excluir</button>
                    </div>
                  </div>
                ))
              )}
            </div>
            </div>
          </section>
        </div>
      </div>
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
  gridTemplateColumns: "540px 1fr",
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
  marginBottom: 18,
};

const headerList: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "start",
  marginBottom: 18,
};

const labelStyle: React.CSSProperties = {
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

const input: React.CSSProperties = {
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

const miniBox: React.CSSProperties = {
  marginTop: 18,
  border: "1px solid #e3e9ef",
  borderRadius: 20,
  padding: 16,
  background: "#fbfcfd",
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

const cancelButton: React.CSSProperties = {
  marginTop: 20,
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

const blueButton: React.CSSProperties = {
  width: "100%",
  border: "none",
  background: "#2f66e4",
  color: "#fff",
  height: 46,
  borderRadius: 14,
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
  gridTemplateColumns: "1.5fr 1fr 1fr .9fr .9fr .8fr .9fr",
  gap: 14,
  padding: "14px 12px",
  color: "#25354b",
  fontWeight: 800,
  fontSize: 15,
};

const trow: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.5fr 1fr 1fr .9fr .9fr .8fr .9fr",
  gap: 14,
  padding: "14px 12px",
  alignItems: "center",
  borderTop: "1px solid #edf1f5",
  color: "#1f2937",
  fontSize: 16,
};

const statusPill: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 60,
  height: 34,
  padding: "0 14px",
  borderRadius: 999,
  border: "1px solid #b7edc5",
  background: "#edfdf0",
  color: "#1a7b39",
  fontWeight: 800,
};

const editButton: React.CSSProperties = {
  border: "1px solid #bfd8ff",
  background: "#eef5ff",
  color: "#2563eb",
  borderRadius: 999,
  height: 40,
  fontWeight: 800,
  cursor: "pointer",
};

const deleteButton: React.CSSProperties = {
  border: "none",
  background: "#ef2b2b",
  color: "#fff",
  borderRadius: 12,
  height: 40,
  fontWeight: 900,
  cursor: "pointer",
};
