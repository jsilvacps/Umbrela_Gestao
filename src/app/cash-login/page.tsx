"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Operator } from "@/lib/types";
import { saveOperatorSession } from "@/lib/operatorSession";

export default function CashLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const q = query(
        collection(db, "operators"),
        where("username", "==", username.trim().toLowerCase())
      );

      const snapshot = await getDocs(q);

      if (snapshot.empty) {
        alert("Operador não encontrado.");
        setLoading(false);
        return;
      }

      const operatorDoc = snapshot.docs[0];
      const operator = { id: operatorDoc.id, ...(operatorDoc.data() as Operator) };

      if (!operator.active) {
        alert("Operador inativo.");
        setLoading(false);
        return;
      }

      if (operator.password !== password.trim()) {
        alert("Usuário ou senha inválidos.");
        setLoading(false);
        return;
      }

      saveOperatorSession({
        operatorId: operator.id!,
        operatorName: operator.name,
        username: operator.username,
      });

      router.push("/checkout");
    } catch (error) {
      console.error(error);
      alert("Erro ao entrar no caixa.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="cash-login-page">
      <div className="cash-login-card">
        <h1>Login do Caixa</h1>
        <p className="muted">Informe usuário e senha do operador.</p>

        <form className="grid" onSubmit={handleLogin}>
          <div>
            <label>Usuário</label>
            <input
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Usuário do operador"
              required
            />
          </div>

          <div>
            <label>Senha</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Senha"
              required
            />
          </div>

          <button className="btn btn-primary btn-full" type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar no caixa"}
          </button>
        </form>
      </div>
    </main>
  );
}