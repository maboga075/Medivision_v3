// Types pour les fournisseurs IA et réponses

export type AIProviderKey = 'openai' | 'anthropic' | 'deepseek' | 'gemini';

export interface ProviderConfig {
  apiKey: string;
  selectedModel: string;
}

export interface AIConfig {
  activeEngine: AIProviderKey;
  openai: ProviderConfig;
  gemini: ProviderConfig;
  anthropic: ProviderConfig;
  deepseek: ProviderConfig;
}

// Structure de sortie JSON du moteur IA (schéma strict imposé au LLM)
export interface AIInterpretation {
  segment_anterieur?: string;  // conditionnel : seulement si OCT antérieur réalisé
  macula_od?: string;
  macula_og?: string;
  papille_od?: string;
  papille_og?: string;
  rnfl_od?: string;            // format : "normal" | "inf. en X" | "limite en X" | "dans les normes"
  rnfl_og?: string;
  gcl_od?: string;
  gcl_og?: string;
  peripherie?: string;
  octa?: string;               // conditionnel : seulement si OCTA réalisé
}

export type AISeverite = 'normal' | 'surveillance' | 'alerte';

export interface AIRecommandations {
  hygiene: string;
  suivi: string;               // contrôle, examens complémentaires, surveillance
}

export interface AIResult {
  interpretation: AIInterpretation;
  conclusion: string;          // diagnostic uniquement, pas de suivi
  recommandations: AIRecommandations;
  severite: AISeverite;
}

// Résultat de validation de la réponse IA
export type ValidationScore = 'vert' | 'orange' | 'rouge';

export interface ValidationResult {
  valid: boolean;
  score: ValidationScore;
  issues: string[];
}

// Payload envoyé à l'IA
export interface AIPayload {
  meta: {
    type_document: string;
    version_schema: string;
    langue: string;
    original_type_label: string;
  };
  patient: Record<string, unknown>;
  contexte: Record<string, unknown>;
  donnees_cliniques: Record<string, unknown>;
  analyse_clinique: Record<string, unknown>;
  hypotheses_medecin: unknown[];
  instructions_generation: {
    style: string;
    niveau_detail: string;
    ne_pas_inventer: boolean;
  };
}
