"use client";

import { useEffect, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/lib/types";
import {
  nowIso,
  calculatePriceFromMargin,
  calculateMarginFromPrice,
  formatMoneyInput,
  parseMoneyInput,
  onlyDigits,
} from "@/lib/utils";

const initialState: Product = {
  internalCode: "",
  eanCode: "",
  name: "",
  category: "",
  unitType: "un",
  costPrice: 0,
  marginCash: 0,
  priceCash: 0,
  marginCard: 0,
  priceCard: 0,
  active: true,
};

interface ProductFormProps {
  editingProduct?: Product | null;
  onSaved?: () => void;
  onCancelEdit?: () => void;
}

export default function ProductForm({
  editingProduct,
  onSaved,
  onCancelEdit,
}: ProductFormProps) {
  const [form, setForm] = useState<Product>(initialState);
  const [saving, setSaving] = useState(false);

  const [costPriceInput, setCostPriceInput] = useState("0,00");
  const [priceCashInput, setPriceCashInput] = useState("0,00");
  const [priceCardInput, setPriceCardInput] = useState("0,00");

  useEffect(() => {
    if (editingProduct) {
      const loaded = {
        ...editingProduct,
        eanCode: editingProduct.eanCode || "",
      };

      setForm(loaded);
      setCostPriceInput(
        loaded.costPrice.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
      setPriceCashInput(
        loaded.priceCash.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
      setPriceCardInput(
        loaded.priceCard.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );
    } else {
      setForm(initialState);
      setCostPriceInput("0,00");
      setPriceCashInput("0,00");
      setPriceCardInput("0,00");
    }
  }, [editingProduct]);

  const handleChange = (field: keyof Product, value: string | number | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleEanChange = (value: string) => {
    handleChange("eanCode", onlyDigits(value).slice(0, 14));
  };

  const handleCostPriceChange = (rawValue: string) => {
    const formatted = formatMoneyInput(rawValue);
    const numericValue = parseMoneyInput(formatted);

    setCostPriceInput(formatted);
    setForm((prev) => {
      const newPriceCash = calculatePriceFromMargin(numericValue, prev.marginCash);
      const newPriceCard = calculatePriceFromMargin(numericValue, prev.marginCard);

      setPriceCashInput(
        newPriceCash.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );

      setPriceCardInput(
        newPriceCard.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );

      return {
        ...prev,
        costPrice: numericValue,
        priceCash: newPriceCash,
        priceCard: newPriceCard,
      };
    });
  };

  const handleMarginCashChange = (value: number) => {
    setForm((prev) => {
      const newPriceCash = calculatePriceFromMargin(prev.costPrice, value);

      setPriceCashInput(
        newPriceCash.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );

      return {
        ...prev,
        marginCash: value,
        priceCash: newPriceCash,
      };
    });
  };

  const handlePriceCashChange = (rawValue: string) => {
    const formatted = formatMoneyInput(rawValue);
    const numericValue = parseMoneyInput(formatted);

    setPriceCashInput(formatted);
    setForm((prev) => ({
      ...prev,
      priceCash: numericValue,
      marginCash: calculateMarginFromPrice(prev.costPrice, numericValue),
    }));
  };

  const handleMarginCardChange = (value: number) => {
    setForm((prev) => {
      const newPriceCard = calculatePriceFromMargin(prev.costPrice, value);

      setPriceCardInput(
        newPriceCard.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      );

      return {
        ...prev,
        marginCard: value,
        priceCard: newPriceCard,
      };
    });
  };

  const handlePriceCardChange = (rawValue: string) => {
    const formatted = formatMoneyInput(rawValue);
    const numericValue = parseMoneyInput(formatted);

    setPriceCardInput(formatted);
    setForm((prev) => ({
      ...prev,
      priceCard: numericValue,
      marginCard: calculateMarginFromPrice(prev.costPrice, numericValue),
    }));
  };

  async function internalCodeAlreadyExists() {
    const q = query(
      collection(db, "products"),
      where("internalCode", "==", form.internalCode.trim())
    );

    const snapshot = await getDocs(q);

    if (!editingProduct?.id) {
      return !snapshot.empty;
    }

    return snapshot.docs.some((item) => item.id !== editingProduct.id);
  }

  const resetForm = () => {
    setForm(initialState);
    setCostPriceInput("0,00");
    setPriceCashInput("0,00");
    setPriceCardInput("0,00");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      if (!form.internalCode.trim()) {
        alert("Informe o código interno.");
        setSaving(false);
        return;
      }

      if (await internalCodeAlreadyExists()) {
        alert("Já existe um produto com esse código interno.");
        setSaving(false);
        return;
      }

      const payload = {
        ...form,
        internalCode: form.internalCode.trim(),
        eanCode: onlyDigits(form.eanCode || "").slice(0, 14),
        name: form.name.trim(),
        category: form.category.trim(),
        costPrice: Number(form.costPrice || 0),
        marginCash: Number(form.marginCash || 0),
        priceCash: Number(form.priceCash || 0),
        marginCard: Number(form.marginCard || 0),
        priceCard: Number(form.priceCard || 0),
        updatedAt: nowIso(),
      };

      if (editingProduct?.id) {
        await updateDoc(doc(db, "products", editingProduct.id), payload);
        alert("Produto atualizado com sucesso.");
      } else {
        await addDoc(collection(db, "products"), {
          ...payload,
          createdAt: nowIso(),
        });
        alert("Produto cadastrado com sucesso.");
      }

      resetForm();
      onSaved?.();
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar produto.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card grid" onSubmit={handleSubmit}>
      <h3>{editingProduct ? "Editar produto" : "Novo produto"}</h3>

      <div className="grid grid-2">
        <div>
          <label>Código interno</label>
          <input
            className="input"
            placeholder="Código interno"
            value={form.internalCode}
            onChange={(e) => handleChange("internalCode", e.target.value)}
            required
          />
        </div>

        <div>
          <label>Código EAN</label>
          <input
            className="input"
            placeholder="Somente números"
            value={form.eanCode}
            onChange={(e) => handleEanChange(e.target.value)}
            inputMode="numeric"
            maxLength={14}
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Nome do produto</label>
          <input
            className="input"
            placeholder="Nome do produto"
            value={form.name}
            onChange={(e) => handleChange("name", e.target.value)}
            required
          />
        </div>

        <div>
          <label>Categoria</label>
          <input
            className="input"
            placeholder="Categoria"
            value={form.category}
            onChange={(e) => handleChange("category", e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Unidade de venda</label>
          <select
            className="select"
            value={form.unitType}
            onChange={(e) => handleChange("unitType", e.target.value as Product["unitType"])}
          >
            <option value="un">Unidade</option>
            <option value="kg">Kg</option>
            <option value="g">Gramas</option>
            <option value="cx">Caixa</option>
            <option value="pct">Pacote</option>
            <option value="bdj">Bandeja</option>
          </select>
        </div>

        <div>
          <label>Preço de custo</label>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={costPriceInput}
            onChange={(e) => handleCostPriceChange(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Margem de lucro - pagamento em dinheiro (%)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.marginCash}
            onChange={(e) => handleMarginCashChange(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Preço final - pagamento em dinheiro</label>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={priceCashInput}
            onChange={(e) => handlePriceCashChange(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="grid grid-2">
        <div>
          <label>Margem de lucro - pagamento em cartão (%)</label>
          <input
            className="input"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={form.marginCard}
            onChange={(e) => handleMarginCardChange(Number(e.target.value))}
          />
        </div>

        <div>
          <label>Preço final - pagamento em cartão</label>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            placeholder="0,00"
            value={priceCardInput}
            onChange={(e) => handlePriceCardChange(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="row">
        <button className="btn btn-primary" disabled={saving} type="submit">
          {saving ? "Salvando..." : editingProduct ? "Atualizar produto" : "Salvar produto"}
        </button>

        {editingProduct ? (
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