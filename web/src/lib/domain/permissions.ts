import { AREAS } from "./areas";
import type { AppUser, AreaKey } from "@/types/domain";

/**
 * Quem pode editar cada área.
 * - Admin edita tudo.
 * - Se o usuário tem `areas` definido em `rh-daily-users/{email}`, vale a lista.
 * - Senão, vale o responsável da área (nome do usuário = pessoa da área).
 */
export function canEditArea(user: AppUser | null, area: AreaKey): boolean {
  if (!user) return false;
  if (user.admin) return true;
  if (user.areas?.length) return user.areas.includes(area);
  return AREAS[area].person.trim().toLowerCase() === user.name.trim().toLowerCase();
}

/** Finalizar a daily (arquiva todas as áreas) é restrito a administradores. */
export const canFinalize = (user: AppUser | null) => !!user?.admin;

/** Usuário mestre: único com acesso à tela de Administração. */
export const MASTER_EMAIL = "elias.almeida@graodireto.com.br";

export const canManageUsers = (user: AppUser | null) => !!user && user.email.trim().toLowerCase() === MASTER_EMAIL;
