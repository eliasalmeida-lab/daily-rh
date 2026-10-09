import type { AppUser, AreaKey } from "@/types/domain";

/** Qualquer usuário logado pode editar qualquer área. */
export function canEditArea(user: AppUser | null, area: AreaKey): boolean {
  void area;
  return !!user;
}

/** Finalizar a daily (arquiva todas as áreas) é restrito a administradores. */
export const canFinalize = (user: AppUser | null) => !!user?.admin;

/** Usuário mestre: único com acesso à tela de Administração. */
export const MASTER_EMAIL = "elias.almeida@graodireto.com.br";

export const canManageUsers = (user: AppUser | null) => !!user && user.email.trim().toLowerCase() === MASTER_EMAIL;
