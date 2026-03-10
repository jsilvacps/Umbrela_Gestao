export function money(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value || 0);
}

export function dateTime(value?: string) {
  if (!value) return "";
  return new Date(value).toLocaleString("pt-BR");
}