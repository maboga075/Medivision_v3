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
  segment_anterieur?: string;
  synthese_oct?: string;
  macula?: string;
  papille?: string;
  vascularisation?: string;
  peripherie?: string;
}

export type AISeverite = 'normal' | 'surveillance' | 'alerte';

export interface AIRecommandations {
  hygiene: string;
  suivi: string;
}

export interface AIResult {
  interpretation: AIInterpretation;
  conclusion: string;
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
