import type { AIPayload } from '../types/ai';
import type { DonneesCliniquesNormalisees } from '../types/clinical';
import type { ClinicalSummary } from '../types/clinical';

const formatDocumentType = (type: string): string => {
  if (!type) return 'compte_rendu_standard';
  return type
    .toLowerCase()
    .replace(/ \+ /g, '_plus_')
    .replace(/\s+/g, '_')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');
};

export const buildAIPayload = (
  normalizedJson: DonneesCliniquesNormalisees | null,
  clinicalSummary: ClinicalSummary | null,
  reportType: string
): AIPayload | null => {
  if (!normalizedJson) return null;

  return {
    meta: {
      type_document: formatDocumentType(reportType),
      version_schema: '2.0.0',
      langue: 'fr',
      original_type_label: reportType,
    },
    patient: (normalizedJson.patient as Record<string, unknown>) ?? {},
    contexte: (normalizedJson.contexte as Record<string, unknown>) ?? {
      prescripteur: '',
      motifs: [],
      antecedents: [],
      hypotheses_diagnostiques: [],
      hypothese_libre: '',
    },
    donnees_cliniques: (normalizedJson.donnees_cliniques as Record<string, unknown>) ?? {
      oeil_droit: {},
      oeil_gauche: {},
    },
    analyse_clinique: (clinicalSummary?.analyse_clinique as Record<string, unknown>) ?? {
      oeil_droit: { anomalies: [], patterns: [], suspicion: null },
      oeil_gauche: { anomalies: [], patterns: [], suspicion: null },
    },
    hypotheses_medecin: clinicalSummary?.hypotheses_medecin ?? [],
    instructions_generation: {
      style: 'medical_professionnel',
      niveau_detail: 'synthetique',
      ne_pas_inventer: true,
      analyse_clinique_max_phrases: 4,
      analyse_clinique_focus: 'anomalies_significatives_uniquement',
      // 'acquisition' n'est plus interdit : quand l'indice est faible/impossible,
      // l'IA DOIT en tenir compte (nuancer l'interprétation, mentionner le motif).
      interdire_mentions: ['non_realise', 'aucune_donnee', 'non_transmis', 'non_renseigne'],
      tenir_compte_indice_acquisition: true,
    },
  };
};
