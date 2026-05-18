"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { masterSupabase, db } from "@/lib/supabaseClient";
import { salvarEmpresaId, isConfigurado } from "@/lib/supabaseClient";

/* ── Tipos ── */
type Tela = "verificando" | "setup" | "login";
type Passo = 1 | 2 | 3 | 4;

/* ── Helpers ── */
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

/* ══════════════════════════════════════════════════════════ */
export default function LoginPage() {
  const router = useRouter();

  /* ── Controle de tela ── */
  const [tela, setTela] = useState<Tela>("verificando");

  /* ── Passo 1: Código de ativação ── */
  const [passo, setPasso]   = useState<Passo>(1);
  const [codigo, setCodigo] = useState("");
  const [testando, setTestando]       = useState(false);
  const [erroConexao, setErroConexao] = useState("");
  const refSbUrl = useRef<HTMLInputElement>(null);

  /* ── Passo 2: Dados da empresa ── */
  const [nomeFant, setNomeFant]       = useState("");
  const [cnpj, setCnpj]               = useState("");
  const [telefone, setTelefone]       = useState("");
  const [endereco, setEndereco]       = useState("");
  const [larguraCupom, setLarguraCupom] = useState<58 | 80>(80);

  /* ── Passo 3: Credenciais ADM ── */
  const [adminUser, setAdminUser]     = useState("");
  const [adminNome, setAdminNome]     = useState("");
  const [admSenha, setAdmSenha]       = useState("");
  const [admSenha2, setAdmSenha2]     = useState("");

  /* ── Passo 4: Salvando ── */
  const [salvando, setSalvando]       = useState(false);
  const [erroSalvar, setErroSalvar]   = useState("");
  const [concluido, setConcluido]     = useState(false);

  /* ── Login normal ── */
  const [username, setUsername]       = useState("");
  const [senha, setSenha]             = useState("");
  const [erroLogin, setErroLogin]     = useState("");
  const [showSenha, setShowSenha]     = useState(false);
  const [entrando, setEntrando]       = useState(false);

  /* ── Esqueci minha senha ── */
  type EsqueciEtapa = "fechado" | "usuario" | "nova_senha";
  const [esqueciEtapa, setEsqueciEtapa]   = useState<EsqueciEtapa>("fechado");
  const [esqueciUser, setEsqueciUser]     = useState("");
  const [esqueciNovaSenha, setEsqueciNovaSenha]   = useState("");
  const [esqueciConfirma, setEsqueciConfirma]     = useState("");
  const [esqueciErro, setEsqueciErro]     = useState("");
  const [esqueciOk, setEsqueciOk]         = useState(false);
  const [esqueciCarreg, setEsqueciCarreg] = useState(false);

  async function buscarUsuario() {
    if (!esqueciUser.trim()) { setEsqueciErro("Informe o usuário."); return; }
    setEsqueciCarreg(true); setEsqueciErro("");
    const { data } = await db("operadores").select("id").eq("username", esqueciUser.trim().toLowerCase()).maybeSingle();
    setEsqueciCarreg(false);
    if (!data) { setEsqueciErro("Usuário não encontrado."); return; }
    setEsqueciEtapa("nova_senha");
  }

  async function salvarNovaSenha() {
    if (esqueciNovaSenha.length < 4) { setEsqueciErro("Mínimo 4 caracteres."); return; }
    if (esqueciNovaSenha !== esqueciConfirma) { setEsqueciErro("As senhas não coincidem."); return; }
    setEsqueciCarreg(true); setEsqueciErro("");
    const { error } = await db("operadores").update({ password: esqueciNovaSenha }).eq("username", esqueciUser.trim().toLowerCase());
    setEsqueciCarreg(false);
    if (error) { setEsqueciErro("Erro ao salvar: " + error.message); return; }
    setEsqueciOk(true);
  }

  function fecharEsqueci() {
    setEsqueciEtapa("fechado");
    setEsqueciUser(""); setEsqueciNovaSenha(""); setEsqueciConfirma("");
    setEsqueciErro(""); setEsqueciOk(false); setEsqueciCarreg(false);
  }

  /* ── Detecta se precisa de setup na montagem ── */
  useEffect(() => {
    async function detectar() {
      if (!isConfigurado()) {
        setTela("setup");
        setTimeout(() => refSbUrl.current?.focus(), 200);
        return;
      }
      const { data } = await db("empresa").select("empresa_id").maybeSingle();
      setTela(data?.empresa_id ? "login" : "setup");
    }
    detectar();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Login normal ── */
  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setErroLogin("");
    setEntrando(true);
    const { data, error } = await db("operadores")
      .select("id, nome, username, blocked")
      .eq("username", username)
      .eq("password", senha)
      .limit(1)
      .maybeSingle();
    if (error || !data) {
      setErroLogin("Usuário ou senha inválidos.");
      setEntrando(false);
      return;
    }
    if ((data as { blocked?: boolean }).blocked) {
      setErroLogin("Operador bloqueado.");
      setEntrando(false);
      return;
    }
    window.sessionStorage.setItem("operador_logado", JSON.stringify(data));
    router.push("/pdv");
  }

  /* ── Setup: valida código de ativação ── */
  async function ativarCodigo() {
    const cod = codigo.trim().toUpperCase();
    if (!cod) { setErroConexao("Informe o código de ativação."); return; }
    setTestando(true); setErroConexao("");
    try {
      const { data, error } = await masterSupabase
        .from("clientes_licenciados")
        .select("empresa_id, nome_cliente")
        .eq("codigo", cod)
        .eq("ativo", true)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) { setErroConexao("Código não encontrado ou inativo."); setTestando(false); return; }
      salvarEmpresaId(data.empresa_id);
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
      // Empresa: atualiza se já existe, insere se não
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

      // Senhas: atualiza se já existe, insere se não
      const { data: senhaExist } = await db("senhas_operacionais").select("id").maybeSingle();
      if (senhaExist) {
        await db("senhas_operacionais").update({ adm_password: admSenha });
      } else {
        await db("senhas_operacionais").insert([{ adm_password: admSenha }]);
      }

      // Operador ADM: insere se não existir
      const { error: eOp } = await db("operadores").insert([{
        username: adminUser.trim().toLowerCase(),
        nome:     adminNome.trim(),
        password: admSenha,
        blocked:  false,
        perm_finalizar: true, perm_cancelar_item: true, perm_cancelar_venda: true,
        perm_sangria: true, perm_relatorios: true, perm_desconto: true, perm_buscar_cupons: true,
      }]);
      if (eOp && !eOp.message.includes("duplicate")) throw new Error(eOp.message);
      setConcluido(true);
    } catch (e: unknown) {
      setErroSalvar(e instanceof Error ? e.message : String(e));
    } finally { setSalvando(false); }
  }

  /* ── Estilos comuns ── */
  const inp: React.CSSProperties = {
    width: "100%", height: 44, borderRadius: 10, border: "1px solid #d1d5db",
    padding: "0 14px", fontSize: 15, outline: "none", color: "#111827", background: "#fff",
  };
  const lbl: React.CSSProperties = {
    display: "block", fontWeight: 700, fontSize: 13, color: "#374151", marginBottom: 5,
  };
  const btnP: React.CSSProperties = {
    width: "100%", height: 48, border: "none", borderRadius: 12,
    background: "#15803d", color: "#fff", fontWeight: 900, fontSize: 16, cursor: "pointer",
  };
  const btnS: React.CSSProperties = {
    width: "100%", height: 48, border: "1px solid #d1d5db", borderRadius: 12,
    background: "#f9fafb", color: "#374151", fontWeight: 700, fontSize: 15, cursor: "pointer",
  };
  const indicador = (n: number) => ({
    width: 32, height: 32, borderRadius: "50%",
    display: "flex" as const, alignItems: "center" as const, justifyContent: "center" as const,
    fontWeight: 900, fontSize: 14,
    background: passo > n ? "#15803d" : passo === n ? "#1fb14e" : "#e5e7eb",
    color: passo >= n ? "#fff" : "#9ca3af",
  });

  /* ── Tela de verificação ── */
  if (tela === "verificando") {
    return (
      <main style={{ minHeight: "100vh", background: "#0c121a", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#1faa4a", fontSize: 22, fontFamily: "Segoe UI, sans-serif", fontWeight: 900 }}>
          HORTI GESTÃO…
        </div>
      </main>
    );
  }

  /* ── Tela de login normal ── */
  if (tela === "login") {
    return (
      <main style={{ minHeight: "100vh", background: "#f3f5f7", display: "grid", placeItems: "center", padding: 20 }}>
        <div style={{ width: "100%", maxWidth: 460, background: "#fff", border: "1px solid #dde3ea", borderRadius: 28, padding: 28, boxShadow: "0 12px 30px rgba(15,23,42,.06)" }}>
          <img src="/logo.svg" alt="logo" style={{ width: 56, height: 56, marginBottom: 12 }} />
          <div style={{ fontSize: 32, fontWeight: 900, color: "#11243d", marginTop: 4 }}>Entrar no PDV</div>
          <div style={{ color: "#66758a", marginTop: 6, marginBottom: 18 }}>Informe suas credenciais de operador.</div>
          <form onSubmit={entrar}>
            <label style={{ display: "block", fontWeight: 800, color: "#1d3049", fontSize: 15, marginBottom: 6 }}>Usuário</label>
            <input style={{ ...inp, marginBottom: 14 }} value={username} onChange={e => setUsername(e.target.value)} placeholder="usuário" autoFocus autoComplete="username" />
            <label style={{ display: "block", fontWeight: 800, color: "#1d3049", fontSize: 15, marginBottom: 6 }}>Senha</label>
            <div style={{ position: "relative", marginBottom: 8 }}>
              <input style={{ ...inp, paddingRight: 50 }} type={showSenha ? "text" : "password"} value={senha} onChange={e => setSenha(e.target.value)} placeholder="senha" autoComplete="current-password" />
              <button type="button" onClick={() => setShowSenha(!showSenha)}
                style={{ position: "absolute", right: 10, top: 6, height: 32, width: 32, borderRadius: 8, border: "1px solid #dbe2ea", background: "#fff", cursor: "pointer" }}>
                {showSenha ? "🙈" : "👁"}
              </button>
            </div>
            {erroLogin && (
              <div style={{ marginBottom: 10, color: "#991b1b", background: "#fef2f2", border: "1px solid #fecaca", padding: "10px 14px", borderRadius: 12, fontWeight: 700, fontSize: 14 }}>
                {erroLogin}
              </div>
            )}
            <button type="submit" disabled={entrando} style={{ ...btnP, marginTop: 8 }}>
              {entrando ? "Entrando..." : "→ Entrar"}
            </button>
            <button type="button" onClick={() => { setEsqueciEtapa("usuario"); setEsqueciErro(""); }}
              style={{ width: "100%", background: "none", border: "none", color: "#6b7280", fontSize: 13, marginTop: 14, cursor: "pointer", textDecoration: "underline" }}>
              Esqueci minha senha
            </button>
          </form>
        </div>

        {/* ── Modal Esqueci minha senha ── */}
        {esqueciEtapa !== "fechado" && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 400, boxShadow: "0 20px 60px rgba(0,0,0,.2)" }}>
              {esqueciOk ? (
                <>
                  <div style={{ textAlign: "center", fontSize: 52, marginBottom: 12 }}>✅</div>
                  <div style={{ fontWeight: 900, fontSize: 18, color: "#14532d", textAlign: "center", marginBottom: 8 }}>Senha alterada!</div>
                  <div style={{ color: "#4b5563", fontSize: 14, textAlign: "center", marginBottom: 20 }}>
                    A senha do usuário <strong>{esqueciUser}</strong> foi atualizada com sucesso.
                  </div>
                  <button onClick={fecharEsqueci} style={{ ...btnP }}>Fazer login →</button>
                </>
              ) : esqueciEtapa === "usuario" ? (
                <>
                  <div style={{ fontWeight: 900, fontSize: 17, color: "#111827", marginBottom: 6 }}>🔑 Redefinir senha</div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 18 }}>Informe o usuário para continuar.</div>
                  <label style={lbl}>Usuário</label>
                  <input autoFocus value={esqueciUser} onChange={e => setEsqueciUser(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    placeholder="ex: admin"
                    style={{ ...inp, marginBottom: 10 }}
                    onKeyDown={e => e.key === "Enter" && buscarUsuario()} />
                  {esqueciErro && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{esqueciErro}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    <button onClick={fecharEsqueci} style={btnS}>Cancelar</button>
                    <button onClick={buscarUsuario} disabled={esqueciCarreg} style={btnP}>{esqueciCarreg ? "Buscando..." : "Continuar →"}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 900, fontSize: 17, color: "#111827", marginBottom: 6 }}>🔒 Nova senha</div>
                  <div style={{ color: "#6b7280", fontSize: 13, marginBottom: 18 }}>
                    Usuário: <strong>{esqueciUser}</strong>
                  </div>
                  <label style={lbl}>Nova senha</label>
                  <input autoFocus type="password" value={esqueciNovaSenha} onChange={e => setEsqueciNovaSenha(e.target.value)}
                    placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom: 14 }} />
                  <label style={lbl}>Confirmar nova senha</label>
                  <input type="password" value={esqueciConfirma} onChange={e => setEsqueciConfirma(e.target.value)}
                    placeholder="Repita a senha" style={{ ...inp, marginBottom: 10 }}
                    onKeyDown={e => e.key === "Enter" && salvarNovaSenha()} />
                  {esqueciErro && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10, fontWeight: 600 }}>{esqueciErro}</div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8 }}>
                    <button onClick={() => setEsqueciEtapa("usuario")} style={btnS}>← Voltar</button>
                    <button onClick={salvarNovaSenha} disabled={esqueciCarreg} style={btnP}>{esqueciCarreg ? "Salvando..." : "Salvar senha ✔"}</button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </main>
    );
  }

  /* ── Tela de setup ── */
  return (
    <main style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 50%, #bbf7d0 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 20, fontFamily: "Segoe UI, Arial, sans-serif",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <img src="/logo.svg" alt="Horti Gestão" style={{ width: 80, height: 80, marginBottom: 12 }} />
          <div style={{ fontSize: 26, fontWeight: 900, color: "#14532d" }}>Horti Gestão PDV</div>
          <div style={{ color: "#16a34a", fontSize: 15, marginTop: 4 }}>Configuração inicial do sistema</div>
        </div>

        {/* Indicador de passos */}
        {!concluido && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 0, marginBottom: 24 }}>
            {[1, 2, 3].map((n, i) => (
              <div key={n} style={{ display: "flex", alignItems: "center" }}>
                <div style={indicador(n)}>{passo > n ? "✓" : n}</div>
                {i < 2 && <div style={{ width: 60, height: 2, background: passo > n ? "#15803d" : "#e5e7eb" }} />}
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div style={{ background: "#fff", borderRadius: 20, padding: 28, boxShadow: "0 12px 40px rgba(0,0,0,.08)", border: "1px solid rgba(21,128,61,.1)" }}>

          {/* PASSO 1 */}
          {passo === 1 && !concluido && (
            <>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>🔑 Código de ativação</div>
              <div style={{ color: "#64748b", fontSize: 13, marginBottom: 18, lineHeight: 1.6 }}>
                Insira o código fornecido pela Horti Gestão para ativar o sistema.
              </div>
              <label style={lbl}>Código de ativação</label>
              <input
                ref={refSbUrl}
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="ex: JOAO2025"
                autoCapitalize="characters"
                style={{ ...inp, marginBottom: 8, fontSize: 20, fontWeight: 800, letterSpacing: 3, textAlign: "center" }}
                onKeyDown={e => e.key === "Enter" && ativarCodigo()}
              />
              {erroConexao && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{erroConexao}</div>}
              <div style={{ marginTop: 16 }}>
                <button onClick={ativarCodigo} disabled={testando} style={btnP}>
                  {testando ? "Verificando código..." : "Ativar →"}
                </button>
              </div>
            </>
          )}

          {/* PASSO 2 */}
          {passo === 2 && !concluido && (
            <>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>🏪 Dados do estabelecimento</div>
              <div style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>Estas informações aparecem no cupom fiscal e nos relatórios.</div>
              <label style={lbl}>Nome fantasia *</label>
              <input value={nomeFant} onChange={e => setNomeFant(e.target.value)} placeholder="Ex: Hortifruti do João" autoFocus style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>CNPJ</label>
              <input value={cnpj} onChange={e => setCnpj(mascararCNPJ(e.target.value))} placeholder="00.000.000/0001-00" style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Telefone</label>
              <input value={telefone} onChange={e => setTelefone(mascararTel(e.target.value))} placeholder="(00) 00000-0000" style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Endereço</label>
              <input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Rua, número, bairro, cidade" style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Largura da impressora térmica</label>
              <div style={{ display: "flex", gap: 10, marginBottom: 18 }}>
                {([58, 80] as const).map(mm => (
                  <button key={mm} type="button" onClick={() => setLarguraCupom(mm)} style={{
                    flex: 1, height: 44, borderRadius: 10, border: "2px solid",
                    borderColor: larguraCupom === mm ? "#15803d" : "#e2e8f0",
                    background:  larguraCupom === mm ? "#f0fdf4" : "#f9fafb",
                    color:       larguraCupom === mm ? "#15803d" : "#64748b",
                    fontWeight: 800, fontSize: 15, cursor: "pointer",
                  }}>{mm}mm</button>
                ))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button onClick={() => setPasso(1)} style={btnS}>← Voltar</button>
                <button onClick={() => { if (!nomeFant.trim()) return; setPasso(3); }} style={btnP}>Continuar →</button>
              </div>
            </>
          )}

          {/* PASSO 3 */}
          {passo === 3 && !concluido && (
            <>
              <div style={{ fontWeight: 900, fontSize: 18, color: "#0f172a", marginBottom: 6 }}>🔑 Acesso do administrador</div>
              <div style={{ color: "#64748b", fontSize: 13, marginBottom: 18 }}>Crie o usuário principal do sistema. Guarde bem essa senha.</div>
              <label style={lbl}>Usuário (login) *</label>
              <input value={adminUser} onChange={e => setAdminUser(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="admin" autoFocus style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Nome completo *</label>
              <input value={adminNome} onChange={e => setAdminNome(e.target.value)} placeholder="João da Silva" style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Senha ADM *</label>
              <input type="password" value={admSenha} onChange={e => setAdmSenha(e.target.value)} placeholder="Mínimo 4 caracteres" style={{ ...inp, marginBottom: 14 }} />
              <label style={lbl}>Confirmar senha *</label>
              <input type="password" value={admSenha2} onChange={e => setAdmSenha2(e.target.value)} placeholder="Repita a senha" style={{ ...inp, marginBottom: 8 }} onKeyDown={e => e.key === "Enter" && salvarTudo()} />
              {erroSalvar && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 12, fontWeight: 600 }}>{erroSalvar}</div>}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <button onClick={() => setPasso(2)} style={btnS}>← Voltar</button>
                <button onClick={salvarTudo} disabled={salvando} style={btnP}>{salvando ? "Configurando..." : "✔ Finalizar setup"}</button>
              </div>
            </>
          )}

          {/* CONCLUÍDO */}
          {concluido && (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <div style={{ fontWeight: 900, fontSize: 22, color: "#14532d", marginBottom: 10 }}>Sistema configurado!</div>
              <div style={{ color: "#16a34a", fontSize: 15, marginBottom: 24, lineHeight: 1.6 }}>
                <strong>{nomeFant}</strong> está pronto para usar.<br />
                Faça login com o usuário <strong>{adminUser}</strong>.
              </div>
              <button onClick={() => setTela("login")} style={btnP}>🚀 Ir para o login</button>
            </div>
          )}

        </div>
        <div style={{ textAlign: "center", marginTop: 14, color: "#86efac", fontSize: 12 }}>
          Horti Gestão PDV © {new Date().getFullYear()}
        </div>
      </div>
    </main>
  );
}
