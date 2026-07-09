// Types pour les données cliniques oculaires

export type AcquisitionStatus = 'Bon' | 'Faible' | 'Impossible';
export type Eye = 'OD' | 'OG';
export type Lateralite = 'OD' | 'OG' | 'OD et OG';

// Statuts catégoriques RNFL / GCL++
export type RNFLGCLStatus =
  | 'normal'              // Dans les normes
  | 'superior'            // Supérieur aux normes
  | 'inferior_global'     // Inférieur — ensemble des cadrans
  | 'inferior_localized'  // Inférieur — localisé
  | 'limite_global'       // Limite — ensemble des cadrans
  | 'limite_localized';   // Limite — localisé

export interface RNFLGCLData {
  status: RNFLGCLStatus;
  location?: string;  // code localisation : 'temp_inf' | 'temp_sup' | 'nasal_inf' | 'nasal_sup'
}

export interface ImageData {
  name: string;
  type: string;
  data: string; // base64 data URL
}

// Calques RetinaSketch (mémorise l'état activé/désactivé pour le compte rendu).
export type RetinaLayers = Record<
  'anatomy' | 'quadrants' | 'fovea' | 'etdrs' | 'periphery' | 'vessels',
  boolean
>;

/**
 * Instantané de l'image de rétinographie et de son réglage, persisté depuis
 * l'éditeur RetinaSketch pour reproduire fidèlement l'affichage dans le compte
 * rendu (image compressée JPEG + alignement + colorimétrie).
 */
export interface RetinaBackgroundSnapshot {
  src: string;        // dataURL JPEG compressé
  natW: number;
  natH: number;
  visible: boolean;
  // Colorimétrie (appliquée en CSS)
  opacity: number;     // 0..1
  brightness: number;  // %, 100 = neutre
  contrast: number;    // %, 100 = neutre
  saturation: number;  // %, 100 = neutre
  // Alignement
  scale: number;       // multiplicateur, 1 = ajusté au contour
  offsetXMm: number;
  offsetYMm: number;
  rotationDeg: number;
}

export interface EyeState {
  acquisitionStatus: AcquisitionStatus;
  acquisitionMotif: string;
  acquisitionQuality?: 'bon' | 'faible' | 'impossible';
  acquisitionQualityReasons?: string[];

  // Acquisition difficile : exclut RNFL/GCL de l'interprétation et du compte rendu.
  excludeRnflGcl?: boolean;

  hasFollowUp: boolean;
  followUpDate: string;
  rnflEvolution: string;
  gclEvolution: string;

  rnfl?: RNFLGCLData;
  gcl?: RNFLGCLData;

  // Saisie par secteurs (V3) — source de vérité ; `rnfl`/`gcl` en sont dérivés.
  rnflSectors?: import('../utils/rnflGcl').RnflSectors;
  gclSectors?: import('../utils/rnflGcl').GclSectors;

  // Annotations RetinaSketch de cet œil (V3, module 1).
  retinaAnnotations?: import('../features/retinasketch/lib/types').Annotation[];

  // Image de rétinographie + calques persistés depuis RetinaSketch (pour le CR).
  retinaBackground?: RetinaBackgroundSnapshot | null;
  retinaLayers?: RetinaLayers;

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
  /** Lésions dessinées dans RetinaSketch, converties en texte clinique structuré */
  retina?: string[];
}

export interface EyeDataNormalisee {
  acquisitionStatus?: AcquisitionStatus;
  acquisitionMotif?: string;
  // Indice d'acquisition dégradé (transmis à l'IA pour nuancer l'interprétation).
  acquisitionQuality?: 'faible' | 'impossible';
  acquisitionMotifs?: string[];
  // Acquisition difficile : RNFL/GCL non interprétables (exclus par le praticien).
  rnfl_gcl_non_interpretable?: boolean;
  rnfl_localisation?: string;
  gcl_localisation?: string;
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
    sexe?: 'M' | 'F';
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
