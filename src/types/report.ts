// Types pour le compte rendu structuré complet (MedivisionReport)
// Ce type représente la structure complète d'un compte rendu généré.

import type { AIProviderKey, AIResult } from './ai';
import type { EyeState } from './clinical';

export type ExamenType = 'OCT' | 'Retinographie' | 'OCTA' | 'Pachymetrie' | 'Segment_Anterieur';
export type SeveriteReport = 'normal' | 'surveillance' | 'alerte';

// Contexte de la consultation au moment de la génération du rapport
export interface ReportContext {
  patientNom: string;
  patientAge: number | string;
  patientFolderId?: string;
  patientTel?: string;
  dateExamen: string;
  prescripteur?: string;
  motifs: string[];
  antecedents: string[];
  typeExamen: string;
  showAnterior: boolean;
  showPosterior: boolean;
}

// Données brutes des yeux au moment du rendu rapport
export interface ReportEyeData {
  oeilDroit: EyeState;
  oeilGauche: EyeState;
}

// Valeurs du rapport (données saisies + résultat IA)
export interface ReportData {
  context: ReportContext;
  eyes: ReportEyeData;
  aiResult: AIResult;
  meta: {
    generePar: AIProviderKey;
    dateGeneration: string;
    versionSchema: string;
  };
}

// Champs éditables inline dans le rendu (patchs utilisateur)
export type ReportEdits = Record<string, string>;

// Props communes pour les composants du rapport
export interface ReportComponentProps {
  data: ReportData;
  edits: ReportEdits;
  onEdit: (field: string, value: string) => void;
}
