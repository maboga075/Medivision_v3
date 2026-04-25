// Types pour les données cliniques oculaires

export type AcquisitionStatus = 'Bon' | 'Faible' | 'Impossible';
export type Eye = 'OD' | 'OG';
export type Lateralite = 'OD' | 'OG' | 'OD et OG';

export interface ImageData {
  name: string;
  type: string;
  data: string; // base64 data URL
}

export interface EyeState {
  acquisitionStatus: AcquisitionStatus;
  acquisitionMotif: string;
  acquisitionQuality?: 'bon' | 'faible' | 'impossible';

  hasFollowUp: boolean;
  followUpDate: string;
  rnflEvolution: string;
  gclEvolution: string;

  rnfl: string;
  rnflLoc: string;
  gcl: string;
  gclLoc: string;

  cornealThickness: string;
  obsAnterieur: string[];

  discSurface: string;
  cupDisc: string;

  octaPerformed: boolean;
  obsOCTA: string[];

  // Champs bubble-picker (remplacent obsMacula, obsPapille, obsPeriph, obsFavoris, obsVasc)
  observationsMacula: string[];
  observationsPapille: string[];
  observationsPeripherie: string[];
  observationsDivers: string;

  obsFree: string;
  images: ImageData[];
}

// Données œil normalisées (après passage dans clinicalPayload)
export interface ObservationsNormalisees {
  papille?: string[];
  macula?: string[];
  vasculaire?: string[];
  peripherie?: string[];
  anterieur?: string[];
  octa?: string[];
  favoris?: string[];
}

export interface EyeDataNormalisee {
  acquisitionStatus?: AcquisitionStatus;
  acquisitionMotif?: string;
  hasFollowUp?: boolean;
  followUpDate?: string;
  rnflEvolution?: string;
  gclEvolution?: string;
  rnfl_statut?: string;
  gcl_statut?: string;
  cup_disc_vertical?: number | string;
  pachymetrie?: number | string;
  discSurface?: string;
  octaPerformed?: boolean;
  obsFree?: string;
  observations: ObservationsNormalisees;
  images?: ImageData[];
}

// Analyse clinique produite par buildClinicalSummary
export interface AnalyseOeil {
  anomalies: string[];
  patterns: string[];
  suspicion: string | null;
}

export interface HypotheseDiagnostique {
  categorie: string;
  libelle: string;
  lateralite: Lateralite;
}

export interface RawConsultationData {
  patient: {
    nom: string;
    age: number | string;
    date_naissance: string | null;
  };
  contexte: {
    prescripteur: string;
    motifs: string[];
    antecedents: string[];
    hypotheses_diagnostiques: HypotheseDiagnostique[];
    hypothese_libre: string;
  };
  oeil_droit: EyeState;
  oeil_gauche: EyeState;

  // Champs optionnels Session 1 — contexte acquisition
  reportType?: string;
  anteriorSegmentDone?: boolean;
  octaDone?: boolean;
  acquisitionQualityOD?: 'bon' | 'faible' | 'impossible';
  acquisitionQualityOG?: 'bon' | 'faible' | 'impossible';
  discSurfaceOD?: string;
  discSurfaceOG?: string;
}

export interface DonneesCliniquesNormalisees {
  patient: {
    nom: string;
    age: number | string;
    date_naissance?: string;
  };
  contexte: {
    prescripteur?: string;
    motifs: string[];
    antecedents: string[];
    hypotheses_diagnostiques: HypotheseDiagnostique[];
    hypothese_libre?: string;
  };
  donnees_cliniques: {
    oeil_droit: EyeDataNormalisee | null;
    oeil_gauche: EyeDataNormalisee | null;
  };
}

export interface ClinicalSummary {
  analyse_clinique: {
    oeil_droit: AnalyseOeil;
    oeil_gauche: AnalyseOeil;
  };
  hypotheses_medecin: HypotheseDiagnostique[];
}
