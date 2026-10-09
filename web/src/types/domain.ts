/**
 * Tipos do domínio do Painel RH.
 *
 * Espelha o modelo de dados hoje guardado no Firestore pelo app single-file
 * (coleção `rh-daily`), de forma tipada. Na Fase 2 (config sem código) as áreas
 * e campos passam a ser dados no banco em vez de constantes — os tipos abaixo já
 * foram desenhados para essa evolução.
 */

/** Chave de uma área de RH. Hoje é um conjunto fixo; vira dinâmico na Fase 2. */
export type AreaKey = "dp" | "bp" | "rs" | "est";

/** Aba da tela de Pautas. "amanda" unifica as áreas BP + R&S. */
export type TabKey = "dp" | "amanda" | "est";

/** Status de uma prioridade. */
export type PrioStatus = "pending" | "progress" | "done";

/** Metadados de exibição de uma área. */
export interface AreaConfig {
  key: AreaKey;
  /** Nome completo, ex.: "Depto. Pessoal". */
  name: string;
  /** Sigla curta, ex.: "DP". */
  short: string;
  /** Responsável padrão (pode ser sobrescrito por layoutConfig). */
  person: string;
  /** Cor de destaque (hex). */
  color: string;
}

/** Um campo de texto dentro de uma seção da pauta. */
export interface PautaField {
  key: string;
  label: string;
}

/** Uma seção agrupando campos dentro de uma pauta de área. */
export interface PautaSection {
  section: string;
  fields: PautaField[];
}

/**
 * Conteúdo de uma pauta (draft ou current).
 * As chaves dinâmicas (`dp_admissoes`, `bp_ag_clima`, ...) mapeiam para o texto
 * digitado. Também carrega prioridades `<area>_p1..p3` e um mapa de status.
 */
/** Uma prioridade da semana (lista dinâmica: pode incluir/excluir). */
export interface PrioEntry {
  id: string;
  text: string;
  status: PrioStatus;
  /** Quantas dailies esta prioridade já atravessou sem ser concluída. */
  weeks?: number;
}

/** Um tópico (rótulo + texto) dentro de um quadro de pauta. */
export interface PautaTopic {
  id: string;
  label: string;
  value: string;
}

/** Um quadro de pauta: título principal + tópicos. Criado/excluído pelo usuário. */
export interface PautaBlock {
  id: string;
  title: string;
  topics: PautaTopic[];
}

export interface PautaData {
  [fieldKey: string]: string | boolean | Record<string, PrioStatus> | PautaBlock[] | PrioEntry[] | undefined;
  prioStatus?: Record<string, PrioStatus>;
  sections?: PautaBlock[];
  priorities?: PrioEntry[];
  savedAt?: string;
  finalized?: boolean;
  date?: string;
}

/** Uma entrada arquivada no histórico de pautas de uma área. */
export type PautaHistoryEntry = PautaData;

/** Uma prioridade arquivada. */
export interface PrioHistoryEntry {
  text: string;
  status: PrioStatus;
  num: number;
  archivedAt: string;
  date: string;
}

/** Snapshot de uma daily finalizada (subcoleção `history`). */
export type DailyHistoryEntry = PautaData;

/** Documento de uma área no Firestore (`rh-daily/{area}`). */
export interface AreaDoc {
  draft?: PautaData | null;
  current?: PautaData | null;
  pautaHistory?: PautaHistoryEntry[];
  prioHistory?: PrioHistoryEntry[];
  /** Preenchido em runtime a partir da subcoleção `history`. */
  history?: DailyHistoryEntry[];
}

/** Usuário do sistema (`rh-daily-users/{email}`). */
export interface AppUser {
  email: string;
  name: string;
  admin: boolean;
  /** Áreas que o usuário pode editar (opcional; senão vale o responsável da área). */
  areas?: AreaKey[];
}

/** Presença em tempo real (`rh-daily/_presence`). */
export interface PresenceEntry {
  tab: TabKey;
  time: number;
}

/** Metadados agregados (`rh-daily/_meta`). */
export interface MetaDoc {
  dailysCount?: number;
  [key: string]: unknown;
}
