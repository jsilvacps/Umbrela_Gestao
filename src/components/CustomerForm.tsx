"use client";

import { useEffect, useState } from "react";
import { addDoc, collection, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Customer } from "@/lib/types";
import {
  nowIso,
  formatCpf,
  formatPhone,
  formatCep,
  isValidCpf,
  onlyDigits,
  formatMoneyInput,
  parseMoneyInput,
} from "@/lib/utils";

const initialState: Customer = {
  name: "",
  cpf: "",
  phone: "",
  whatsapp: "",
  cep: "",
  address: "",
  district: "",
  city: "",
  creditLimit: 0,
  availableCredit: 0,
  blocked: false,
  active: true,
};

interface CustomerFormProps {
  editingCustomer?: Customer | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
}

export default function CustomerForm({
  editingCustomer,
  onSaved,
  onCancelEdit,
}: CustomerFormProps) {
  const [form, setForm] = useState<Customer>(initialState);
  const [saving, setSaving] = useState(false);
  const [loadingCep, setLoadingCep] = useState(false);
  const [creditLimitInput, setCreditLimitInput] = useState("0,00");
  const [availableCreditInput, setAvailableCreditInput] = useState("0,00");

  useEffect(() => {
    if (editingCustomer) {
      setForm({
        ...editingCustomer,
        blocked: editingCustomer.blocked ?? false,
      });

      setCreditLimitInput(
        Number(editingCustomer.creditLimit || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );

      setAvailableCreditInput(
        Number(editingCustomer.availableCredit || 0).toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    } else {
      setForm(initialState);
      setCreditLimitInput("0,00");
      setAvailableCreditInput("0,00");
    }
  }, [editingCustomer]);

  const handleChange = (
    field: keyof Customer,
    value: string | number | boolean
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCpfChange = (value: string) => {
    handleChange("cpf", formatCpf(value));
  };

  const handlePhoneChange = (field: "phone" | "whatsapp", value: string) => {
    handleChange(field, formatPhone(value));
  };

  const handleCepChange = (value: string) => {
    handleChange("cep", formatCep(value));
  };

  const handleCreditLimitChange = (value: string) => {
    const formatted = formatMoneyInput(value);
    const parsed = parseMoneyInput(formatted);

    setCreditLimitInput(formatted);
    setForm((prev) => ({
      ...prev,
      creditLimit: parsed,
    }));
  };

  const handleAvailableCreditChange = (value: string) => {
    const formatted = formatMoneyInput(value);
    const parsed = parseMoneyInput(formatted);

    setAvailableCreditInput(formatted);
    setForm((prev) => ({
      ...prev,
      availableCredit: parsed,
    }));
  };

  const resetForm = () => {
    setForm(initialState);
    setCreditLimitInput("0,00");
    setAvailableCreditInput("0,00");
  };

  const searchCep = async () => {
    const cep = onlyDigits(form.cep || "");

    if (cep.length !== 8) {
      alert("Informe um CEP válido com 8 dígitos.");
      return;
    }

    setLoadingCep(true);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await response.json();

      if (data.erro) {
        alert("CEP não encontrado.");
        return;
      }

      setForm((prev) => ({
        ...prev,
        cep: formatCep(cep),
        address: data.logradouro || prev.address || "",
        district: data.bairro || prev.district || "",
        city: data.localidade || prev.city || "",
      }));
    } catch (error) {
      console.error(error);
      alert("Erro ao buscar CEP.");
    } finally {
      setLoadingCep(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const cpfDigits = onlyDigits(form.cpf || "");

      if (cpfDigits.length > 0 && cpfDigits.length !== 11) {
        alert("O CPF deve ter 11 dígitos.");
        setSaving(false);
        return;
      }

      if (cpfDigits.length === 11 && !isValidCpf(cpfDigits)) {
        alert("CPF inválido.");
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        cpf: form.cpf || "",
        phone: form.phone || "",
        whatsapp: form.whatsapp || "",
        cep: form.cep || "",
        address: form.address || "",
        district: form.district || "",
        city: form.city || "",
        creditLimit: Number(form.creditLimit || 0),
        availableCredit: Number(form.availableCredit || 0),
        blocked: Boolean(form.blocked),
      };

      if (editingCustomer?.id) {
        await updateDoc(doc(db, "customers", editingCustomer.id), payload);
        alert("Cliente atualizado com sucesso.");
      } else {
        await addDoc(collection(db, "customers"), {
          ...payload,
          createdAt: nowIso(),
        });
        alert("Cliente cadastrado com sucesso.");
      }

      resetForm();
      onSaved?.();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card grid" onSubmit={handleSubmit}>
      <div className="form-title-wrap">
        <div>
          <h3 style={{ margin: 0 }}>
            {editingCustomer ? "Editar cliente" : "Novo cliente"}
          </h3>
          <p className="muted" style={{ marginTop: 6 }}>
            Cadastro para vendas à vista e controle de fiado.
          </p>
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Nome do cliente</label>
          <input
            className="input"
            placeholder="Nome completo"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label>CPF</label>
          <input
            className="input"
            placeholder="000.000.000-00"
            value={form.cpf}
            onChange={(e) => handleCpfChange(e.target.value)}
            maxLength={14}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Telefone</label>
          <input
            className="input"
            placeholder="(00) 00000-0000"
            value={form.phone}
            onChange={(e) => handlePhoneChange("phone", e.target.value)}
            maxLength={15}
          />
        </div>

        <div>
          <label>WhatsApp</label>
          <input
            className="input"
            placeholder="(00) 00000-0000"
            value={form.whatsapp}
            onChange={(e) => handlePhoneChange("whatsapp", e.target.value)}
            maxLength={15}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>CEP</label>
          <input
            className="input"
            placeholder="00000-000"
            value={form.cep}
            onChange={(e) => handleCepChange(e.target.value)}
            maxLength={9}
          />
        </div>

        <div className="cep-button-wrap">
          <label style={{ visibility: "hidden" }}>Buscar CEP</label>
          <button
            className="btn btn-secondary btn-full"
            type="button"
            onClick={searchCep}
            disabled={loadingCep}
          >
            {loadingCep ? "Buscando CEP..." : "Buscar CEP"}
          </button>
        </div>
      </div>

      <div className="grid grid-3">
        <div>
          <label>Endereço</label>
          <input
            className="input"
            placeholder="Rua, avenida, número"
            value={form.address}
            onChange={(e) => handleChange("address", e.target.value)}
          />
        </div>

        <div>
          <label>Bairro</label>
          <input
            className="input"
            placeholder="Bairro"
            value={form.district}
            onChange={(e) => handleChange("district", e.target.value)}
          />
        </div>

        <div>
          <label>Cidade</label>
          <input
            className="input"
            placeholder="Cidade"
            value={form.city}
            onChange={(e) => handleChange("city", e.target.value)}
          />
        </div>
      </div>

      <div className="credit-box">
        <div className="grid grid-2">
          <div>
            <label>Limite de fiado</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={creditLimitInput}
              onChange={(e) => handleCreditLimitChange(e.target.value)}
            />
          </div>

          <div>
            <label>Saldo disponível</label>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              placeholder="0,00"
              value={availableCreditInput}
              onChange={(e) => handleAvailableCreditChange(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="row">
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? "Salvando..." : editingCustomer ? "Atualizar cliente" : "Salvar cliente"}
        </button>

        {editingCustomer ? (
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              resetForm();
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