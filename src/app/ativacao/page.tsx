"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { masterSupabase, db, salvarEmpresaId } from "@/lib/supabaseClient";

type Passo = 1 | 2 | 3 | 4;

function mascararCNPJ(v: string) {
  return v.replace(/\D/g, "").slice(0, 14)
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1.$2")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/\/(\d{4})(\d)/, "/$1-$2");
}
function mascararTel(v: string) {
  return v.replace(/\D/g, "").slice(0, 11)
    .replace(/^(\d{2})(\d)/, "($1) $2")
    .replace(/\) (\d{5})(\d)/, ") $1-$2");
}

export default function AtivacaoPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [passo, setPasso]   = useState<Passo>(1);
  const [codigo, setCodigo] = useState("");
  const [testando, setTestando]       = useState(false);
  const [erroConexao, setErroConexao] = useState("");
  const [nomeCliente, setNomeCliente] = useState("");

  const [nomeFant, setNomeFant]   = useState("");
  const [cnpj, setCnpj]           = useState("");
  const [telefone, setTelefone]   = useState("");
  const [endereco, setEndereco]   = useState("");
  const [larguraCupom, setLarguraCupom] = useState<58 | 80>(80);

  const [adminUser, setAdminUser] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [admSenha, setAdmSenha]   = useState("");
  const [admSenha2, setAdmSenha2] = useState("");

  const [salvando, setSalvando]   = useState(false);
  const [erroSalvar, setErroSalvar] = useState("");
  const [concluido, setConcluido] = useState(false);

  const refCodigo = useRef<HTMLInputElement>(null);

  // Pré-preenche o código se vier na URL (?codigo=JOAO2025)
  useEffect(() => {
    const cod = searchParams.get("codigo") || searchParams.get("code") || "";
    if (cod) setCodigo(cod.toUpperCase());
    setTimeout(() => refCodigo.current?.focus(), 200);
  }, [searchParams]);

  async function ativarCodigo() {
    const cod = codigo.trim().toUpperCase();
    if (!cod) { setErroConexao("Informe o código de ativação."); return; }
    setTestando(true); setErroConexao("");
    try {
      const { data, error } = await masterSupabase
        .from("clientes_licenciados")
        .select("empresa_id, nome_cliente, ativo, cadastro_em")
        .eq("codigo", cod)
        .maybeSingle();

      if (error) throw new Error(error.message);
      if (!data) { setErroConexao("Código não encontrado. Verifique e tente novamente."); setTestando(false); return; }

      if (!data.ativo && data.cadastro_em) {
        setErroConexao("Este código foi desativado. Entre em contato com o suporte.");
        setTestando(false);
        return;
      }

      salvarEmpresaId(data.empresa_id);
      setNomeCliente((data as any).nome_cliente || "");

      // Já configurado antes → vai direto para login
      if (data.cadastro_em) {
        const { data: emp } = await masterSupabase
          .from("empresa")
          .select("nome_fantasia")
          .eq("empresa_id", data.empresa_id)
          .not("nome_fantasia", "is", null)
          .maybeSingle();
        if (emp?.nome_fantasia) {
          router.push("/login");
          return;
        }
      }

      // Primeira vez → inicia wizard
      setPasso(2);
    } catch (e: unknown) {
      setErroConexao(e instanceof Error ? e.message : String(e));
    } finally { setTestando(false); }
  }

  function validarPasso3(): string {
    if (!adminUser.trim()) return "Informe o usuário ADM.";
    if (!adminNome.trim()) return "Informe o nome do responsável.";
    if (admSenha.length < 4) return "Senha mínima de 4 caracteres.";
    if (admSenha !== admSenha2) return "As senhas não coincidem.";
    return "";
  }

  async function salvarTudo() {
    const errV = validarPasso3();
    if (errV) { setErroSalvar(errV); return; }
    if (!nomeFant.trim()) { setErroSalvar("Informe o nome da empresa."); return; }
    setSalvando(true); setErroSalvar("");
    try {
      const { data: empExist } = await db("empresa").select("empresa_id").maybeSingle();
      if (empExist) {
        await db("empresa").update({
          nome_fantasia: nomeFant.trim(),
          cnpj:          cnpj.replace(/\D/g, "") || null,
          telefone:      telefone.replace(/\D/g, "") || null,
          endereco:      endereco.trim() || null,
          cupom_largura: larguraCupom,
        });
      } else {
        const { error: eEmp } = await db("empresa").insert([{
          nome_fantasia: nomeFant.trim(),
          cnpj:          cnpj.replace(/\D/g, "") || null,
          telefone:      telefone.replace(/\D/g, "") || null,
          endereco:      endereco.trim() || null,
          cupom_largura: larguraCupom,
        }]);
        if (eEmp) throw new Error(eEmp.message);
      }

      const { data: senhaExist } = await db("senhas_operacionais").select("id").maybeSingle();
      if (senhaExist) {
        await db("senhas_operacionais").update({ adm_password: admSenha });
      } else {
        await db("senhas_operacionais").insert([{ adm_password: admSenha }]);
      }

      const { error: eOp } = await db("operadores").insert([{
        username: adminUser.trim().toLowerCase(),
        nome:     adminNome.trim(),
        password: admSenha,
        blocked:  false,
        perm_finalizar: true, perm_cancelar_item: true, perm_cancelar_venda: true,
        perm_sangria: true, perm_relatorios: true, perm_desconto: true, perm_buscar_cupons: true,
      }]);
      if (eOp && !eOp.message.includes("duplicate")) throw new Error(eOp.message);

      const cod = codigo.trim().toUpperCase();
      if (cod) {
        await masterSupabase
          .from("clientes_licenciados")
          .update({ ativo: true, cadastro_em: new Date().toISOString() })
          .eq("codigo", cod);
      }

      setConcluido(true);
    } catch (e: unknown) {
      setErroSalvar(e instanceof Error ? e.message : String(e));
    } finally { setSalvando(false); }
  }

  const inp: React.CSSProperties = {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    border: "1px solid #d1fae5", background: "#f0fdf4",
    color: "#14532d", fontSize: 15, boxSizing: "border-box", outline: "none",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontWeight: 700, color: "#166534", fontSize: 13, marginBottom: 6,
  };
  const btnVerde: React.CSSProperties = {
    width: "100%", padding: "14px", borderRadius: 12, background: "#16a34a",
    border: "none", color: "#fff", fontWeight: 800, fontSize: 16, cursor: "pointer",
  };

  // ── Tela de sucesso ──────────────────────────────────────────────────────────
  if (concluido) return (
    <main style={{ minHeight: "100vh", background: "#f0fdf4", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Segoe UI, sans-serif" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "48px 40px", maxWidth: 440, width: "90%", textAlign: "center", boxShadow: "0 8px 40px rgba(21,128,61,.12)" }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
        <div style={{ fontWeight: 900, fontSize: 24, color: "#14532d", marginBottom: 8 }}>Tudo pronto!</div>
        <div style={{ color: "#166534", fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
          Seu sistema foi configurado com sucesso.<br />
          Agora é só entrar e começar a usar!
        </div>
        <button onClick={() => router.push("/login")} style={btnVerde}>
          🚀 Ir para o login
        </button>
      </div>
    </main>
  );

  return (
    <main style={{ minHeight: "100vh", background: "linear-gradient(135deg,#052e16 0%,#14532d 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Segoe UI, sans-serif", padding: "24px 16px" }}>
      <div style={{ background: "#fff", borderRadius: 20, padding: "40px 36px", maxWidth: 480, width: "100%", boxShadow: "0 20px 60px rgba(0,0,0,.25)" }}>

        {/* Cabeçalho */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>☂️</div>
          <div style={{ fontWeight: 900, fontSize: 22, color: "#14532d" }}>Umbrela Gestão</div>
          <div style={{ color: "#4b7a5e", fontSize: 14, marginTop: 4 }}>
            {passo === 1 && "Ativação do sistema"}
            {passo === 2 && "Dados da empresa"}
            {passo === 3 && "Criar acesso ADM"}
            {passo === 4 && "Confirmação"}
          </div>
        </div>

        {/* Indicador de passos */}
        {passo > 1 && (
          <div style={{ display: "flex", gap: 6, marginBottom: 28 }}>
            {[2, 3].map(p => (
              <div key={p} style={{
                flex: 1, height: 4, borderRadius: 2,
                background: passo >= p ? "#16a34a" : "#d1fae5",
                transition: "background .3s",
              }} />
            ))}
          </div>
        )}

        {/* ── PASSO 1: Código de ativação ── */}
        {passo === 1 && (
          <div>
            {nomeCliente && (
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 10, padding: "12px 16px", marginBottom: 20, color: "#166534", fontWeight: 700, textAlign: "center" }}>
                👋 Olá, {nomeCliente}!
              </div>
            )}
            <label style={lbl}>Código de ativação</label>
            <input
              ref={refCodigo}
              value={codigo}
              onChange={e => { setCodigo(e.target.value.toUpperCase()); setErroConexao(""); }}
              onKeyDown={e => e.key === "Enter" && ativarCodigo()}
              placeholder="Ex: JOAO2025"
              style={{ ...inp, letterSpacing: 3, fontWeight: 800, fontSize: 18, textAlign: "center" }}
            />
            {erroConexao && (
              <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8, textAlign: "center" }}>{erroConexao}</div>
            )}
            <button onClick={ativarCodigo} disabled={testando} style={{ ...btnVerde, marginTop: 20 }}>
              {testando ? "Verificando..." : "✔ Ativar"}
            </button>
            <div style={{ textAlign: "center", marginTop: 16 }}>
              <span style={{ color: "#4b7a5e", fontSize: 13 }}>Já tem acesso? </span>
              <button onClick={() => router.push("/login")} style={{ background: "none", border: "none", color: "#16a34a", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>
                Ir para o login →
              </button>
            </div>
          </div>
        )}

        {/* ── PASSO 2: Dados da empresa ── */}
        {passo === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={lbl}>Nome do estabelecimento *</label>
              <input value={nomeFant} onChange={e => setNomeFant(e.target.value)} placeholder="Ex: Mercadinho do João" style={inp} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>CNPJ ou CPF</label>
                <input value={cnpj} onChange={e => setCnpj(mascararCNPJ(e.target.value))} placeholder="00.000.000/0000-00" style={inp} inputMode="numeric" />
              </div>
              <div>
                <label style={lbl}>Telefone</label>
                <input value={telefone} onChange={e => setTelefone(mascararTel(e.target.value))} placeholder="(11) 99999-9999" style={inp} inputMode="tel" />
              </div>
            </div>
            <div>
              <label style={lbl}>Endereço</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" style={inp} />
            </div>
            <div>
              <label style={lbl}>Largura do cupom</label>
              <div style={{ display: "flex", gap: 10 }}>
                {([58, 80] as const).map(w => (
                  <button key={w} type="button" onClick={() => setLarguraCupom(w)} style={{
                    flex: 1, padding: "10px", borderRadius: 10, fontWeight: 700, fontSize: 14,
                    border: `2px solid ${larguraCupom === w ? "#16a34a" : "#d1fae5"}`,
                    background: larguraCupom === w ? "#f0fdf4" : "#fff",
                    color: larguraCupom === w ? "#15803d" : "#6b7280", cursor: "pointer",
                  }}>{w}mm</button>
                ))}
              </div>
            </div>
            <button onClick={() => { if (!nomeFant.trim()) return; setPasso(3); }} style={{ ...btnVerde, marginTop: 6 }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── PASSO 3: Credenciais ADM ── */}
        {passo === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "#f0fdf4", borderRadius: 10, padding: "12px 16px", color: "#166534", fontSize: 13, lineHeight: 1.6 }}>
              Crie o acesso do <strong>administrador</strong> do sistema. Esse usuário terá acesso total ao painel ADM.
            </div>
            <div>
              <label style={lbl}>Usuário (login) *</label>
              <input value={adminUser} onChange={e => setAdminUser(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="Ex: joao" style={inp} autoFocus />
            </div>
            <div>
              <label style={lbl}>Nome completo *</label>
              <input value={adminNome} onChange={e => setAdminNome(e.target.value)} placeholder="Ex: João da Silva" style={inp} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <label style={lbl}>Senha *</label>
                <input type="password" value={admSenha} onChange={e => setAdmSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={inp} />
              </div>
              <div>
                <label style={lbl}>Confirmar senha *</label>
                <input type="password" value={admSenha2} onChange={e => setAdmSenha2(e.target.value)} placeholder="Repita a senha" style={inp} />
              </div>
            </div>
            {erroSalvar && <div style={{ color: "#dc2626", fontSize: 13, textAlign: "center" }}>{erroSalvar}</div>}
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setErroSalvar(""); setPasso(2); }} style={{ flex: 1, padding: "13px", borderRadius: 12, border: "2px solid #d1fae5", background: "#fff", color: "#4b7a5e", fontWeight: 700, fontSize: 15, cursor: "pointer" }}>
                ← Voltar
              </button>
              <button onClick={salvarTudo} disabled={salvando} style={{ ...btnVerde, flex: 2 }}>
                {salvando ? "Salvando..." : "✔ Concluir ativação"}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
