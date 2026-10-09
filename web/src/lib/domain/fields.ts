import type { AreaKey, PautaSection } from "@/types/domain";

/**
 * Mapa de campos das pautas por área (migrado de FIELD_MAP no index.html).
 * Estrutura declarativa: seção → campos. Renderizada dinamicamente na tela de
 * Pautas. Na Fase 2 passa a ser configurável via banco.
 */
export const FIELD_MAP: Record<AreaKey, PautaSection[]> = {
  dp: [
    {
      section: "Movimentações da Semana",
      fields: [
        { key: "dp_admissoes", label: "Admissões" },
        { key: "dp_rescisoes", label: "Rescisões" },
        { key: "dp_ferias", label: "Férias Relevantes" },
        { key: "dp_alteracoes", label: "Alterações Contratuais" },
        { key: "dp_folha", label: "Folha e Benefícios" },
      ],
    },
    {
      section: "Pendências com a Tako",
      fields: [
        { key: "dp_ajustes", label: "Ajustes Necessários" },
        { key: "dp_prazos", label: "Prazos Críticos" },
        { key: "dp_outros", label: "Outros Assuntos" },
      ],
    },
    {
      section: "Compliance e Riscos Trabalhistas",
      fields: [
        { key: "dp_notificacoes", label: "Notificações / Ações" },
        { key: "dp_documentacao", label: "Documentação Pendente" },
      ],
    },
    {
      section: "Experiência do Colaborador",
      fields: [
        { key: "dp_reclamacoes", label: "Reclamações Recorrentes" },
        { key: "dp_problemas", label: "Problemas com Benefícios ou Processos" },
      ],
    },
  ],
  bp: [
    {
      section: "Agfintech",
      fields: [
        { key: "bp_ag_clima", label: "Clima e Engajamento" },
        { key: "bp_ag_percepcoes", label: "Principais Percepções" },
        { key: "bp_ag_conflitos", label: "Conflitos ou Tensões" },
        { key: "bp_ag_movimentacoes", label: "Movimentações de Pessoas" },
        { key: "bp_ag_promocoes", label: "Promoções em Discussão" },
        { key: "bp_ag_desligamentos", label: "Possíveis Desligamentos" },
      ],
    },
    {
      section: "Operações",
      fields: [
        { key: "bp_cf_clima", label: "Clima e Engajamento" },
        { key: "bp_cf_percepcoes", label: "Principais Percepções" },
        { key: "bp_cf_conflitos", label: "Conflitos ou Tensões" },
        { key: "bp_cf_movimentacoes", label: "Movimentações de Pessoas" },
        { key: "bp_cf_promocoes", label: "Promoções em Discussão" },
        { key: "bp_cf_desligamentos", label: "Possíveis Desligamentos" },
      ],
    },
    {
      section: "Anotações Gerais",
      fields: [{ key: "bp_anotacoes_gerais", label: "Anotações" }],
    },
  ],
  rs: [
    {
      section: "Pipeline de Vagas",
      fields: [
        { key: "rs_vagas_abertas", label: "Vagas em Aberto" },
        { key: "rs_vagas_fechadas", label: "Vagas Fechadas na Semana" },
        { key: "rs_onboarding", label: "Onboarding em Curso" },
        { key: "rs_info_importantes", label: "Informações Importantes" },
        { key: "rs_outros", label: "Outros Assuntos" },
      ],
    },
  ],
  est: [
    {
      section: "Projetos Estratégicos",
      fields: [
        { key: "est_projetos", label: "Projetos em Andamento" },
        { key: "est_marcos", label: "Marcos / Entregas" },
      ],
    },
    {
      section: "KR's",
      fields: [
        { key: "est_kr_info", label: "Informações Importantes" },
        { key: "est_kr_demandas", label: "Demandas a Serem Discutidas" },
      ],
    },
    {
      section: "Outros Assuntos",
      fields: [{ key: "est_anotacoes", label: "Anotações" }],
    },
  ],
};

/** Todas as chaves de campo de pauta (todas as áreas). */
export const ALL_PAUTA_FIELDS: string[] = Object.values(FIELD_MAP).flatMap((secs) =>
  secs.flatMap((s) => s.fields.map((f) => f.key)),
);

/** Chaves de campo de uma área específica. */
export function fieldsOf(area: AreaKey): string[] {
  return FIELD_MAP[area].flatMap((s) => s.fields.map((f) => f.key));
}
