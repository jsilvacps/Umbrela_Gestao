import { money, dateTime } from "@/lib/format";
import { Sale } from "@/lib/types";

export default function Receipt80mm({ sale }: { sale: Sale }) {
  return (
    <div style={{ width: 280, padding: 8, fontFamily: "monospace", fontSize: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 8 }}>
        <strong>HORTI GESTAO</strong>
        <br />
        Comprovante nao fiscal
      </div>

      <div>
        <div>Venda: {sale.saleNumber}</div>
        <div>Data: {dateTime(sale.createdAt)}</div>
        <div>Operador: {sale.operatorName}</div>
        <div>Pagamento: {sale.paymentMethod}</div>
        {sale.customerName ? <div>Cliente: {sale.customerName}</div> : null}
      </div>

      <hr />

      {sale.items.map((item, index) => (
        <div key={index} style={{ marginBottom: 6 }}>
          <div>{item.productName}</div>
          <div>
            {item.quantity} x {money(item.unitPrice)} = {money(item.totalPrice)}
          </div>
        </div>
      ))}

      <hr />

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <strong>Total</strong>
        <strong>{money(sale.total)}</strong>
      </div>

      {sale.paymentMethod === "fiado" &&
      typeof sale.remainingCustomerCredit === "number" ? (
        <>
          <div style={{ marginTop: 8, display: "flex", justifyContent: "space-between" }}>
            <strong>Saldo restante</strong>
            <strong>{money(sale.remainingCustomerCredit)}</strong>
          </div>
        </>
      ) : null}

      <div style={{ textAlign: "center", marginTop: 10 }}>Obrigado pela preferencia!</div>
    </div>
  );
}