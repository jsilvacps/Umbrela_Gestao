"use client";

import { CartItem, PaymentMethod } from "@/lib/types";
import { getUnitPriceByPayment } from "@/lib/pricing";
import { money } from "@/lib/format";

interface Props {
  items: CartItem[];
  paymentMethod: PaymentMethod;
  onRemove: (index: number) => void;
}

export default function SaleTable({ items, paymentMethod, onRemove }: Props) {
  return (
    <table className="table">
      <thead>
        <tr>
          <th>Produto</th>
          <th>Qtd</th>
          <th>Unit.</th>
          <th>Total</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {items.map((item, index) => {
          const unitPrice = getUnitPriceByPayment(item, paymentMethod);
          const total = unitPrice * item.quantity;

          return (
            <tr key={`${item.productId}-${index}`}>
              <td>{item.productName}</td>
              <td>{item.quantity}</td>
              <td>{money(unitPrice)}</td>
              <td>{money(total)}</td>
              <td>
                <button className="btn btn-danger" onClick={() => onRemove(index)} type="button">
                  Remover
                </button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}