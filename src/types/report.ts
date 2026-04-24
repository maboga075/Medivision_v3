// Types pour le compte rendu structuré complet (MedivisionReport)

import type { ReactNode } from 'react';
import type { AIProviderKey, AIResult } from './ai';
import type { EyeState } from './clinical';

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
  morphology: ParamRow[];
  biometrics: ParamRow[];
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
  interpretation: ReactNode;
  conclusion: { headline: ReactNode; caveat: ReactNode };
  recommendations: { hygiene: ReactNode[]; followUp: ReactNode[] };
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
  aiResult: AIResult;
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
