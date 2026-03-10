import { CashClosureReport, CashMovement, CashSession, Sale } from "./types";

export function calculateCashClosureReport(params: {
  session: CashSession;
  sales: Sale[];
  movements: CashMovement[];
  trayAmount?: number | null;
}): CashClosureReport {
  const { session, sales, movements, trayAmount = null } = params;

  const totalSalesCash = sales
    .filter((sale) => sale.paymentMethod === "cash")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalSalesPix = sales
    .filter((sale) => sale.paymentMethod === "pix")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalSalesCard = sales
    .filter((sale) => sale.paymentMethod === "card")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalSalesFiado = sales
    .filter((sale) => sale.paymentMethod === "fiado")
    .reduce((sum, sale) => sum + sale.total, 0);

  const totalWithdrawals = movements
    .filter((movement) => movement.type === "withdrawal")
    .reduce((sum, movement) => sum + movement.amount, 0);

  const expectedCashAmount =
    Number(session.openingAmount || 0) +
    totalSalesCash -
    totalWithdrawals;

  let differenceAmount: number | null = null;
  let differenceType: "matched" | "short" | "over" | null = null;

  if (typeof trayAmount === "number") {
    differenceAmount = trayAmount - expectedCashAmount;

    if (differenceAmount === 0) {
      differenceType = "matched";
    } else if (differenceAmount < 0) {
      differenceType = "short";
    } else {
      differenceType = "over";
    }
  }

  return {
    openingAmount: Number(session.openingAmount || 0),
    totalSalesCash,
    totalSalesPix,
    totalSalesCard,
    totalSalesFiado,
    totalWithdrawals,
    expectedCashAmount,
    trayAmount,
    differenceAmount,
    differenceType,
  };
}