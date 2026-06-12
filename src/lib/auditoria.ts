export type AuditoriaAcao =
  | "LOGIN"
  | "ABERTURA_CAIXA"
  | "SANGRIA"
  | "SUPRIMENTO"
  | "FECHAMENTO_CAIXA"
  | "CADASTRO_PRODUTO"
  | "EDICAO_PRODUTO"
  | "EXCLUSAO_PRODUTO"
  | "CADASTRO_CLIENTE"
  | "EDICAO_CLIENTE"
  | "EXCLUSAO_CLIENTE"
  | "MOVIMENTO_ESTOQUE"
  | "FINALIZACAO_VENDA"
  | "CANCELAMENTO_VENDA"
  | "AUTORIZACAO_SUPERVISOR"
  | "MOVIMENTO_FIADO";

export type AuditoriaRegistro = {
  id: string;
  dataHora: string;
  usuario: string;
  perfil: string;
  acao: AuditoriaAcao;
  descricao: string;
  referencia?: string;
  autorizadoPor?: string;
};

const STORAGE_AUDITORIA = "umbrela_auditoria";

function gerarId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function obterAuditoria(): AuditoriaRegistro[] {
  if (typeof window === "undefined") return [];
  const salvo = localStorage.getItem(STORAGE_AUDITORIA);
  if (!salvo) return [];
  try {
    return JSON.parse(salvo) as AuditoriaRegistro[];
  } catch {
    return [];
  }
}

export function registrarAuditoria(input: {
  usuario: string;
  perfil: string;
  acao: AuditoriaAcao;
  descricao: string;
  referencia?: string;
  autorizadoPor?: string;
}) {
  if (typeof window === "undefined") return;
  const registros = obterAuditoria();
  const novoRegistro: AuditoriaRegistro = {
    id: gerarId(),
    dataHora: new Date().toISOString(),
    usuario: input.usuario,
    perfil: input.perfil,
    acao: input.acao,
    descricao: input.descricao,
    referencia: input.referencia,
    autorizadoPor: input.autorizadoPor,
  };
  localStorage.setItem(STORAGE_AUDITORIA, JSON.stringify([...registros, novoRegistro]));
}
