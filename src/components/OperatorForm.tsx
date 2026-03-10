"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, getDocs, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Operator } from "@/lib/types";
import { nowIso } from "@/lib/utils";

const initialState: Operator = {
  name: "",
  username: "",
  password: "",
  active: true,
};

interface OperatorFormProps {
  editingOperator?: Operator | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
}

export default function OperatorForm({
  editingOperator,
  onSaved,
  onCancelEdit,
}: OperatorFormProps) {
  const [form, setForm] = useState<Operator>(initialState);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editingOperator) {
      setForm(editingOperator);
    } else {
      setForm(initialState);
    }
  }, [editingOperator]);

  function handleChange(field: keyof Operator, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function usernameAlreadyExists() {
    const q = query(
      collection(db, "operators"),
      where("username", "==", form.username.trim().toLowerCase())
    );

    const snapshot = await getDocs(q);

    if (!editingOperator?.id) {
      return !snapshot.empty;
    }

    return snapshot.docs.some((item) => item.id !== editingOperator.id);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      if (!form.name.trim()) {
        alert("Informe o nome do operador.");
        setSaving(false);
        return;
      }

      if (!form.username.trim()) {
        alert("Informe o usuário do operador.");
        setSaving(false);
        return;
      }

      if (!form.password.trim()) {
        alert("Informe a senha do operador.");
        setSaving(false);
        return;
      }

      if (await usernameAlreadyExists()) {
        alert("Já existe um operador com esse usuário.");
        setSaving(false);
        return;
      }

      const payload = {
        name: form.name.trim(),
        username: form.username.trim().toLowerCase(),
        password: form.password.trim(),
        active: Boolean(form.active),
      };

      if (editingOperator?.id) {
        await updateDoc(doc(db, "operators", editingOperator.id), payload);
        alert("Operador atualizado com sucesso.");
      } else {
        await addDoc(collection(db, "operators"), {
          ...payload,
          createdAt: nowIso(),
        });
        alert("Operador cadastrado com sucesso.");
      }

      setForm(initialState);
      onSaved?.();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar operador.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card grid" onSubmit={handleSubmit}>
      <div className="form-title-wrap">
        <div>
          <h3 style={{ margin: 0 }}>
            {editingOperator ? "Editar operador" : "Novo operador de caixa"}
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Operadores acessam somente a tela de vendas.
          </p>
        </div>
      </div>

      <div>
        <label>Nome do operador</label>
        <input
          className="input"
          placeholder="Ex.: João Caixa"
          value={form.name}
          onChange={(e) => handleChange("name", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-2">
        <div>
          <label>Usuário</label>
          <input
            className="input"
            placeholder="Ex.: joao1"
            value={form.username}
            onChange={(e) => handleChange("username", e.target.value)}
            required
          />
        </div>

        <div>
          <label>Senha</label>
          <input
            className="input"
            type="text"
            placeholder="Senha do operador"
            value={form.password}
            onChange={(e) => handleChange("password", e.target.value)}
            required
          />
        </div>
      </div>

      <div>
        <label>Status</label>
        <select
          className="select"
          value={form.active ? "ativo" : "inativo"}
          onChange={(e) => handleChange("active", e.target.value === "ativo")}
        >
          <option value="ativo">Ativo</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      <div className="row">
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? "Salvando..." : editingOperator ? "Atualizar operador" : "Salvar operador"}
        </button>

        {editingOperator ? (
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              setForm(initialState);
              onCancelEdit?.();
            }}
          >
            Cancelar edição
          </button>
        ) : null}
      </div>
    </form>
  );
}