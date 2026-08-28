export interface Doctor {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  numeroOrdre: string;
  signature?: string;
}

export interface ClinicSettings {
  nom: string;
  adresse: string;
  telephone: string;
  email: string;
  logo?: string;
  medecinPrincipal?: string;
}

export interface FormulaireSettings {
  macula?: string[];
  papille?: string[];
  peripherie?: string[];
  motifs?: string[];
  antecedents?: string[];
  diagnostics?: string[];
  divers?: string[];
  hypothesesLibres?: string[];
}

export interface ExportSettings {
  templateNomFichier?: string;
  formatParDefaut?: 'pdf' | 'docx';
  exportFolderPath?: string;
  exportFolderName?: string;
  useFilePicker?: boolean;
}

export interface CustomLesion {
  id: string;
  name: string;
  color: string;
  category: string;
  terms: string[];
}

export type SeverityGrade = 1 | 2 | 3;

export interface ClinicalPattern {
  id: string;
  name: string;
  type: 'RNFL' | 'GCL' | 'RNFL+GCL';
  rnflSectors?: Partial<Record<'S' | 'I' | 'N' | 'T', SeverityGrade>>;
  gclSectors?: Partial<Record<'S' | 'ST' | 'IT' | 'I' | 'IN' | 'SN', SeverityGrade>>;
  description?: string;
}

export interface AppSettings {
  clinic: ClinicSettings;
  doctors: Doctor[];
  prescripteurs?: string[];
  medecinPrescripteurParDefaut?: string;
  formulario: FormulaireSettings;
  export: ExportSettings;
  customLesions?: CustomLesion[];
  // Surcharges des lésions intégrées : version modifiée par id, ou `null` si supprimée.
  lesionOverrides?: Record<string, CustomLesion | null>;
  clinicalPatterns?: ClinicalPattern[];
  updatedAt?: unknown;
}
