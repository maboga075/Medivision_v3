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
}

export interface ExportSettings {
  templateNomFichier?: string;
  formatParDefaut?: 'pdf' | 'docx';
  exportFolderPath?: string;
  exportFolderName?: string;
  useFilePicker?: boolean;
}

export interface AppSettings {
  clinic: ClinicSettings;
  doctors: Doctor[];
  prescripteurs?: string[];
  medecinPrescripteurParDefaut?: string;
  formulario: FormulaireSettings;
  export: ExportSettings;
  updatedAt?: unknown;
}
