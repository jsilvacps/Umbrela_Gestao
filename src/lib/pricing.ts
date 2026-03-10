import { CartItem, PaymentMethod } from "./types";

export function getUnitPriceByPayment(item: CartItem, paymentMethod: PaymentMethod) {
  if (paymentMethod === "cash" || paymentMethod === "pix") {
    return item.unitPriceCash;
  }

  return item.unitPriceCard;
}

export function calculateCartTotal(items: CartItem[], paymentMethod: PaymentMethod) {
  return items.reduce((sum, item) => {
    const unitPrice = getUnitPriceByPayment(item, paymentMethod);
    return sum + unitPrice * item.quantity;
  }, 0);
}