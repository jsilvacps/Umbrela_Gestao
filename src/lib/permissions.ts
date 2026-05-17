export type PerfilUsuario = "ADMIN" | "SUPERVISOR" | "OPERADOR";

export function isAdmin(perfil?: string): boolean {
  return perfil === "ADMIN";
}

export function isSupervisor(perfil?: string): boolean {
  return perfil === "SUPERVISOR" || perfil === "ADMIN";
}

export function canAdjustStock(perfil?: string): boolean {
  return isSupervisor(perfil);
}

export function canCancelSale(perfil?: string): boolean {
  return isSupervisor(perfil);
}

export function canOpenCaixa(perfil?: string): boolean {
  return perfil === "OPERADOR" || perfil === "SUPERVISOR" || perfil === "ADMIN";
}
