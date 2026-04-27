export interface Doctor {
  id: string;
  nom: string;
  prenom: string;
  specialite: string;
  numeroOrdre: string;
  signature?: string;
}

export interface BubbleSuggestion {
  id: string;
  label: string;
  category: 'macula' | 'papille' | 'peripherie';
  isCustom?: boolean;
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
  bulles: Record<string, BubbleSuggestion[]>;
  frequentDiagnoses?: string[];
  frequentAntecedents?: string[];
}

export interface ExportSettings {
  templateNomFichier: string;
  formatParDefaut: 'pdf' | 'docx';
  exportFolderPath?: string;
}

export interface AppSettings {
  clinic: ClinicSettings;
  doctors: Doctor[];
  medecinPrescripteurParDefaut?: string;
  formulario: FormulaireSettings;
  export: ExportSettings;
}
