// Types pour le compte rendu structuré complet (MedivisionReport)

import type { AIProviderKey, AIResultLegacy, AISeverite } from './ai';
import type { EyeState, RetinaBackgroundSnapshot, RetinaLayers } from './clinical';
import type { RnflSectors, GclSectors } from '../utils/rnflGcl';
import type { Annotation } from '../features/retinasketch/lib/types';

export type ExamenType = 'OCT' | 'Retinographie' | 'OCTA' | 'Pachymetrie' | 'Segment_Anterieur';
export type SeveriteReport = 'normal' | 'surveillance' | 'alerte';

// ─── Types OCT Report (source de vérité, importés par OCTReport.tsx) ─────────

export type PillVariant = 'normal' | 'alert' | 'critical';

export interface ParamRow {
  label: string;
  hint?: string;
  pills?: Array<{ variant: PillVariant; text: string }>; // une bulle par anomalie
  value?: string;
  customColor?: string;        // couleur inline pour RNFL/GCL++ colorés
  isBiometricGraded?: boolean; // true pour les lignes RNFL/GCL++
  flag?: 'alert' | 'critical'; // flag legacy (rapport C/D)
}

export interface EyeData {
  code: 'OD' | 'OG';
  name: string;
  latin: string;
  acquisitionQuality?: 'bon' | 'faible' | 'impossible';
  acquisitionQualityReasons?: string[];
  // Acquisition difficile : RNFL/GCL non interprétés (message dédié dans le CR).
  rnflGclExcluded?: boolean;
  // Boîtes de résumé en haut de la section biométriques
  discSurface?: string;
  cupDisc?: string;
  cupDiscFlag?: 'alert' | 'critical';
  morphology: ParamRow[];
  biometrics: ParamRow[];
  // V3 — données du rendu visuel (schéma rétine + anneaux neuro-rétiniens).
  // Optionnels : les rapports d'avant la V3 retombent sur l'affichage texte.
  annotations?: Annotation[];
  rnflSectors?: RnflSectors;
  gclSectors?: GclSectors;
  // V3 — image de rétinographie + calques persistés (reproduits dans le schéma CR).
  retinaBackground?: RetinaBackgroundSnapshot | null;
  retinaLayers?: RetinaLayers;
  // V3 — suivi RNFL/GCL (affiché près des anneaux : « Diminué » / « Stable »).
  followUp?: {
    date?: string;
    rnflEvolution?: string;
    gclEvolution?: string;
  };
}

// V3 — compte rendu en langage simple (vue patient).
export interface PatientSummary {
  titre: string;
  observe: string;
  signification: string;
  suite: string;
  rassurance: string;
  odEtat?: 'ok' | 'watch' | 'alert';
  ogEtat?: 'ok' | 'watch' | 'alert';
}

export interface OCTReportData {
  reportNumber: string;
  examTitle: string;
  examSubtitle: string;
  brand: {
    clinic: string;
    name: string;
    taglineParts: string[];
  };
  patient: { surname: string; age: number; sex: 'M' | 'F' };
  prescriber: string;
  indication: { main: string; soft?: string };
  history: string;
  eyes: { od: EyeData; og: EyeData };
  // Orientation d'impression : 'landscape' pour la rétinographie (schémas agrandis).
  layout?: 'portrait' | 'landscape';
  // 4 sections cliniques structurées (remplacent interpretation + conclusion + recommendations)
  analyseClinic: string;
  conclusion: string;
  prevention: string[];
  suivi: string[];
  // Bloc synthèse compact (remplace l'affichage prévention + suivi côte à côte).
  // Optionnels : repli sur prevention[]/suivi[] pour les rapports déjà sauvegardés.
  prochainControleOCT?: string;   // ex : "dans 6 mois"
  examenComplementaire?: string;  // examen non-ophtalmologique précisé au formulaire
  conseilPatient?: string;        // conseil unique lié à la pathologie
  severite: AISeverite;
  badge?: { label: string; variant: 'surveillance' | 'alerte' };
  // V3 — résumé patient en langage simple (vue patient). Optionnel.
  resumePatient?: PatientSummary;
  signature: {
    city: string;
    dateLabel: string;
    clinicLine: string;
    email: string;
    phone: string;
    doctorTitle: string;
    doctorName: string;
    specialty: string;
  };
}

// ─── Types rapport legacy (conservation pour compatibilité) ──────────────────

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

export interface ReportEyeData {
  oeilDroit: EyeState;
  oeilGauche: EyeState;
}

export interface ReportData {
  context: ReportContext;
  eyes: ReportEyeData;
  aiResult: AIResultLegacy;
  meta: {
    generePar: AIProviderKey;
    dateGeneration: string;
    versionSchema: string;
  };
}

export type ReportEdits = Record<string, string>;

export interface ReportComponentProps {
  data: ReportData;
  edits: ReportEdits;
  onEdit: (field: string, value: string) => void;
}
