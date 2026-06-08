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

// ─── Types legacy (ReportTemplate / ancienne pipeline) ──────────────────────

export interface AIInterpretation {
  segment_anterieur?: string;
  macula_od?: string;
  macula_og?: string;
  papille_od?: string;
  papille_og?: string;
  rnfl_od?: string;
  rnfl_og?: string;
  gcl_od?: string;
  gcl_og?: string;
  peripherie?: string;
  octa?: string;
}

export type AISeverite = 'normal' | 'surveillance' | 'alerte';

export interface AIRecommandations {
  hygiene: string;
  suivi: string;
}

// Format legacy utilisé par ReportTemplate (ancienne pipeline)
export interface AIResultLegacy {
  interpretation: AIInterpretation;
  conclusion: string;
  recommandations: AIRecommandations;
  severite: AISeverite;
}

// ─── Format actif V2 (pipeline OCT active) ──────────────────────────────────

// Structure de sortie JSON v2 (schéma actif — 4 sections cliniques structurées)
export interface AIResult {
  analyse_clinique: string;  // narrative complète par structure anatomique
  conclusion: string;        // diagnostic pur, sans suivi
  prevention: string[];      // items hygiène & prévention (tableau)
  suivi: string[];           // items suivi & examens complémentaires (tableau)
  conseil_patient?: string;  // conseil unique lié à la pathologie (facteurs de risque, alimentation, surveillance)
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
    analyse_clinique_max_phrases?: number;
    analyse_clinique_focus?: string;
    interdire_mentions?: string[];
  };
}
