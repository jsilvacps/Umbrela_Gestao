"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import ProductForm from "@/components/ProductForm";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/lib/types";
import { money } from "@/lib/format";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("name"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...(docItem.data() as Product),
      }));
      setProducts(list);
    });

    return () => unsubscribe();
  }, []);

  async function handleDeleteProduct(product: Product) {
    if (!product.id) return;

    const ok = confirm(`Excluir o produto "${product.name}"?`);
    if (!ok) return;

    try {
      await deleteDoc(doc(db, "products", product.id));
      if (editingProduct?.id === product.id) {
        setEditingProduct(null);
      }
      alert("Produto excluído com sucesso.");
    } catch (error) {
      console.error(error);
      alert("Erro ao excluir produto.");
    }
  }

  return (
    <main className="container">
      <Header />

      <div className="grid grid-2">
        <ProductForm
          editingProduct={editingProduct}
          onSaved={() => setEditingProduct(null)}
          onCancelEdit={() => setEditingProduct(null)}
        />

        <div className="card">
          <div className="table-header">
            <div>
              <h3 style={{ margin: 0 }}>Produtos cadastrados</h3>
              <p className="muted" style={{ marginTop: 6 }}>
                Gerencie preços, margens e dados dos produtos.
              </p>
            </div>

            <span className="badge-modern">
              {products.length} {products.length === 1 ? "produto" : "produtos"}
            </span>
          </div>

          <div className="table-wrap">
            <table className="table modern-table">
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Cód. interno</th>
                  <th>EAN</th>
                  <th>Custo</th>
                  <th>Dinheiro</th>
                  <th>Cartão</th>
                  <th>Ações</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div style={{ fontWeight: 700 }}>{product.name}</div>
                      <div className="muted">{product.category}</div>
                    </td>
                    <td>{product.internalCode}</td>
                    <td>{product.eanCode || "-"}</td>
                    <td>{money(product.costPrice || 0)}</td>
                    <td>{money(product.priceCash || 0)}</td>
                    <td>{money(product.priceCard || 0)}</td>
                    <td>
                      <div className="action-buttons">
                        <button
                          className="btn btn-edit"
                          type="button"
                          onClick={() => setEditingProduct(product)}
                        >
                          Editar
                        </button>

                        <button
                          className="btn btn-danger"
                          type="button"
                          onClick={() => handleDeleteProduct(product)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}