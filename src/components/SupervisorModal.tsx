"use client";

import { useState } from "react";

type UsuarioSistema = {
  login: string;
  senha: string;
  perfil: string;
};

type Props = {
  aberto: boolean;
  titulo: string;
  descricao?: string;
  onFechar: () => void;
  onAutorizado: (supervisor: UsuarioSistema) => void;
};

const usuariosSistema: UsuarioSistema[] = [
  { login: "admin", senha: "123456", perfil: "ADMIN" },
  { login: "supervisor", senha: "123456", perfil: "SUPERVISOR" },
  { login: "operador", senha: "123456", perfil: "OPERADOR" },
];

export default function SupervisorModal({
  aberto,
  titulo,
  descricao,
  onFechar,
  onAutorizado,
}: Props) {
  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  if (!aberto) return null;

  function confirmar() {
    setErro("");
    const usuario = usuariosSistema.find(
      (item) => item.login === login.trim() && item.senha === senha.trim()
    );
    if (!usuario) {
      setErro("Supervisor não encontrado ou senha inválida.");
      return;
    }
    if (usuario.perfil !== "SUPERVISOR" && usuario.perfil !== "ADMIN") {
      setErro("O usuário informado não possui permissão de supervisor.");
      return;
    }
    setLogin("");
    setSenha("");
    onAutorizado(usuario);
  }

  function fechar() {
    setErro("");
    setLogin("");
    setSenha("");
    onFechar();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 16,
      }}
    >
      <div className="card" style={{ width: "100%", maxWidth: 420, padding: 24 }}>
        <h3 className="card-title">{titulo}</h3>
        <p className="card-text" style={{ marginBottom: 16 }}>
          {descricao || "Esta ação exige autorização de supervisor."}
        </p>

        {erro ? (
          <div className="alert alert-error" style={{ marginBottom: 14 }}>
            {erro}
          </div>
        ) : null}

        <label className="label">Login do supervisor</label>
        <input className="input" type="text" value={login} onChange={(e) => setLogin(e.target.value)} />
        <div style={{ height: 12 }} />
        <label className="label">Senha do supervisor</label>
        <input className="input" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
        <div style={{ height: 18 }} />
        <div className="actions-row">
          <button className="btn btn-secondary" onClick={fechar}>Cancelar</button>
          <button className="btn btn-primary" onClick={confirmar}>Autorizar</button>
        </div>
      </div>
    </div>
  );
}
