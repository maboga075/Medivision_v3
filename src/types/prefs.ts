// Types pour les préférences utilisateur persistées en localStorage

export interface UserPrefs {
  doctors: string[];
  antecedents: string[];
  motifs: string[];
  acqMotifs: string[];
  obsFavoris: string[];
  obsAnterieur: string[];
  obsOCTA: string[];
  obsPapille: string[];
  obsMacula: string[];
  obsVasc: string[];
  obsPeriph: string[];
}

export type PrefsKey = keyof UserPrefs;
