/**
 * Permissões da equipe da academia. Quem tem acesso total (permissions = null no banco)
 * gerencia a equipe e vê tudo; os demais veem só o que foi liberado para eles.
 */
export const PERMISSIONS = {
  alunos: { label: "Alunos", hint: "Ver, cadastrar e editar alunos, responsáveis e fichas" },
  saude: { label: "Dados de saúde", hint: "Ver e editar a seção restrita de saúde dos alunos" },
  mensalidades: { label: "Mensalidades", hint: "Criar, gerar, editar e cancelar mensalidades" },
  pagamentos: { label: "Pagamentos", hint: "Registrar, confirmar e cancelar pagamentos e recibos" },
  presenca: { label: "Presença", hint: "Marcar quem treinou no dia e ver quem está sumido" },
  financeiro: { label: "Financeiro", hint: "Ver entradas, saídas, saldo e relatórios; lançar despesas" },
  solicitacoes: { label: "Solicitações e convites", hint: "Aprovar pedidos de entrada e gerenciar o QR Code" },
  comunicados: { label: "Comunicados", hint: "Publicar e arquivar avisos para os alunos" },
  configuracoes: { label: "Configurações da academia", hint: "Dados e logo da academia, Pix, modalidades e termos da ficha" },
  auditoria: { label: "Auditoria", hint: "Ver o histórico de ações de todos" },
} as const;

export type Permission = keyof typeof PERMISSIONS;
export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];
export const isPermission = (v: string): v is Permission => v in PERMISSIONS;

/** null ou undefined = acesso total. */
export type PermissionSet = readonly Permission[] | null | undefined;

export const hasFullAccess = (p: PermissionSet) => p === null || p === undefined;
export const can = (p: PermissionSet, permission: Permission) => hasFullAccess(p) || p!.includes(permission);

/** Para onde mandar quem entra sem acesso ao Início completo: a primeira área liberada. */
export const PERMISSION_HOME: Record<Permission, string> = {
  alunos: "/alunos", saude: "/alunos", mensalidades: "/mensalidades", pagamentos: "/pagamentos",
  presenca: "/presenca", financeiro: "/financeiro", solicitacoes: "/solicitacoes", comunicados: "/comunicados", configuracoes: "/configuracoes", auditoria: "/auditoria",
};
