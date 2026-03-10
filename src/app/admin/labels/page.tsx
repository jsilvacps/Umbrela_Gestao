"use client";

import { useEffect, useState } from "react";
import Header from "@/components/Header";
import { collection, onSnapshot, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Product } from "@/lib/types";
import { money } from "@/lib/format";

export default function LabelsPage() {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    const q = query(collection(db, "products"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Product) }));
      setProducts(list);
    });

    return () => unsubscribe();
  }, []);

  return (
    <main className="container">
      <Header />
      <div className="card no-print" style={{ marginBottom: 16 }}>
        <h3>Etiquetas</h3>
        <button className="btn btn-primary" onClick={() => window.print()}>
          Imprimir etiquetas
        </button>
      </div>

      <div className="grid grid-3">
        {products.map((product) => (
          <div key={product.id} className="card" style={{ border: "1px dashed #999", minHeight: 130 }}>
            <strong>{product.name}</strong>
            <div>Cód. interno: {product.internalCode}</div>
            <div>EAN: {product.eanCode || "-"}</div>
            <hr />
            <div><strong>Pgto dinheiro:</strong> {money(product.priceCash)}</div>
            <div><strong>Pgto cartão:</strong> {money(product.priceCard)}</div>
          </div>
        ))}
      </div>
    </main>
  );
}