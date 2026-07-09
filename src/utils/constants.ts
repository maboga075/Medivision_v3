import type { UserPrefs } from '../types/prefs';

export const DEFAULT_PREFS: UserPrefs = {
  doctors: ["Dr. Milebou", "Dr. Kougou Ntoutoume", "Dr. Bongo", "Dr. Nyinko Aboughe", "Dr. Gabin", "Dr. Mekyna", "Dr. Matsanga", "Dr. Njilekissa", "Dr. Apedo", "Dr. Souleyman", "Pr. Mba Aki"],
  antecedents: ["Sans particularité", "Excavation papillaire", "Diabète type 2", "HTA", "Glaucome", "Chirurgie cataracte", "Hypertonie oculaire", "Myopie forte", "DMLA", "Neuropathie optique", "Uvéite", "Cataracte", "Maculopathie diabétique", "Rétinopathie hypertensive"],
  motifs: ["Suspicion d'un glaucome", "Excavation papillaire bilatérale", "Hypertonie oculaire", "Pâleur papillaire", "Recherche d'une rétinopathie diabétique", "Bilan visuel", "BAV", "Remaniement maculaire", "Suivi d'un glaucome", "Suivi rétinopathie diabétique", "Suspicion de kératocône", "Suspicion d'OVCR", "Suspicion de DMLA", "Neuropathie optique"],
  acqMotifs: ["Cataracte", "Nystagmus", "Problème de fixation", "Opacités cornéennes", "Sécheresse oculaire sévère", "Ptosis", "Trouble des milieux", "Opacité des milieux transparents"],
  obsFavoris: ["Sans particularité", "Membrane épirétinienne", "Drusens", "Œdème maculaire cystoïde", "Traction vitréo-maculaire", "Décollement séreux rétinien", "Hémorragies en flammèches", "Micro-anévrismes", "Exsudats maculaires", "Excavation modérée", "Pâleur papillaire"],
  obsAnterieur: ["Sans particularité", "Amincissement focal (suspect kératocône)", "Bombement cornéen inférieur", "Cicatrices cornéennes", "Stries de Vogt", "Œdème cornéen", "Infiltrat", "Perte Courbure", "Asymétrie cornéenne", "Opacité cristallinienne"],
  obsOCTA: ["Sans particularité", "Diminution de la densité vasculaire", "Néovaisseaux", "Désorganisation maille capillaire", "Territoires ischémiques", "Absence de néovaisseaux", "Élargissement de la ZAF", "Raréfaction capillaire périfovéolaire"],
  obsPapille: ["Sans particularité", "Contours nets", "Contours flous", "Bords réguliers", "Excavation modérée", "Excavation marquée", "Pâleur papillaire", "Encoche rebord neuro-rétinien", "Hémorragies papillaires", "Raréfaction vasculaire péripapillaire", "Papille pâle", "Atrophie péripapillaire", "Tilted disc", "Drusen papillaires"],
  obsMacula: ["Sans particularité", "Reflet maculaire suspect", "Drusens", "Exsudats maculaires", "Œdème maculaire", "Membrane épirétinienne", "Décollement séreux", "Trou maculaire", "Menace trou lamellaire", "Remaniement de l'épithélium pigmentaire", "Atrophie maculaire"],
  obsVasc: ["Sans particularité", "Tortuosités veineuses", "Hémorragies en flammèches", "Hémorragies punctiformes", "Micro-anévrismes", "Néovaisseaux", "Nodules cotonneux", "Exsudats secs", "Ischémie rétinienne", "Engainement vasculaire", "Occlusion veineuse"],
  obsPeriph: ["Sans particularité", "Déchirure rétinienne", "Décollement rétinien", "Dégénérescence palissadique", "Givre rétinien", "Trou rond atrophique"],
};

import type { RNFLGCLStatus } from '../types/clinical';

export const RNFL_STATUSES: ReadonlyArray<{ value: RNFLGCLStatus; label: string }> = [
  { value: 'normal',             label: 'Dans les normes' },
  { value: 'superior',           label: 'Supérieur aux normes' },
  { value: 'inferior_global',    label: 'Inférieur aux normes (ensemble des cadrans)' },
  { value: 'inferior_localized', label: 'Inférieur aux normes (localisé)' },
  { value: 'limite_global',      label: 'Limite (ensemble des cadrans)' },
  { value: 'limite_localized',   label: 'Limite (localisé)' },
] as const;

export const RNFL_LOCATIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'temp_sup',  label: 'Temporal supérieur' },
  { value: 'temp_inf',  label: 'Temporal inférieur' },
  { value: 'nasal_sup', label: 'Nasal supérieur' },
  { value: 'nasal_inf', label: 'Nasal inférieur' },
  { value: 'sup',       label: 'Supérieur' },
  { value: 'inf',       label: 'Inférieur' },
  { value: 'temp',      label: 'Temporal' },
  { value: 'nasal',     label: 'Nasal' },
] as const;

export const EVOLUTION_OPTIONS = [
  "Stable",
  "Diminution (amincissement)",
  "Augmentation (épaississement)",
  "Fluctuant",
  "Non évaluable",
] as const;

export const REPORT_TYPES = [
  "Compte rendu OCT",
  "Compte rendu Rétinographie",
  "Compte rendu OCT + Rétinographie",
  "OCT du Segment Antérieur",
] as const;

export type ReportType = typeof REPORT_TYPES[number];

export const BUBBLE_PICKER_SUGGESTIONS = {
  macula: [
    'OMC (œdème maculaire cystoïde)',
    'Œdème diffus',
    'Décollement EP',
    'Drusens',
    'Membrane épirétinienne',
    'Trou maculaire',
    'Hémorragies maculaires',
    'Atrophie maculaire',
    'Décollement rétinien',
    'Exsudats maculaires',
    'Trou lamellaire',
    'Remaniement de l\'EP',
    'Décollement séreux rétinien',
    'Traction vitréo-maculaire',
  ],
  papille: [
    'Excavation augmentée',
    'Asymétrie C/D',
    'Pâleur papillaire',
    'Hémorragies péripapillaires',
    'Œdème papillaire',
    'Drusen papillaire',
    'Atrophie péripapillaire',
    'Encoche rebord neuro-rétinien',
    'Contours flous',
    'Tilted disc',
    'Raréfaction vasculaire péripapillaire',
  ],
  peripherie: [
    'Déchirure rétinienne',
    'Décollement rétinien',
    'Palissades',
    'Néovaisseaux',
    'Hémorragies périphériques',
    'Trous atrophiques',
    'Rétinoschisis',
    'Dégénérescence palissadique',
    'Givre rétinien',
  ],
  anterieur: [
    'Amincissement focal (suspect kératocône)',
    'Bombement cornéen inférieur',
    'Cicatrices cornéennes',
    'Stries de Vogt',
    'Œdème cornéen',
    'Infiltrat',
    'Asymétrie cornéenne',
    'Opacité cristallinienne',
  ],
  octa: [
    'Diminution de la densité vasculaire',
    'Néovaisseaux choroïdiens',
    'Désorganisation maille capillaire',
    'Territoires ischémiques',
    'Élargissement de la ZAF',
    'Raréfaction capillaire périfovéolaire',
  ],
} as const;

export const NORMAL_VALUES: string[] = [
  "Sans particularité", "Dans les normes", "Stable", "—", "",
  "Contours nets", "Bords réguliers", "Absence de néovaisseaux",
  "Bon", "Supérieur aux normes", "Impossible",
];

export const EXCLUSIONS: Record<string, [string, string][]> = {
  obsAnterieur: [["Sans particularité", "Amincissement focal (suspect kératocône)"]],
  obsOCTA: [["Néovaisseaux", "Absence de néovaisseaux"]],
  obsPapille: [["Contours nets", "Contours flous"], ["Excavation modérée", "Excavation marquée"]],
};

export const HYPOTHESES_DIAGNOSTIQUES: Record<string, string[]> = {
  "Normal": [
    "Examen sans particularité, épaisseurs rétiniennes dans les normes",
    "Excavation papillaire isolée sur papille de grande surface",
  ],
  "Neuropathie optique / glaucome": [
    "Absence de signes en faveur d'un glaucome",
    "Suspicion de glaucome débutant",
    "Aspect compatible avec un glaucome",
    "Aspect compatible avec un glaucome avancé",
    "Suspicion de neuropathie optique non glaucomateuse",
    "Aspect compatible avec une neuropathie optique avancée",
  ],
  "Diabète": [
    "Absence de signes en faveur d'une rétinopathie diabétique",
    "Rétinopathie diabétique non proliférante légère",
    "Rétinopathie diabétique non proliférante modérée",
    "Rétinopathie diabétique non proliférante sévère",
    "Rétinopathie diabétique proliférante",
    "Œdème maculaire diabétique focal",
    "Œdème maculaire cystoïde",
  ],
  "Drusen / DMLA": [
    "Rares drusen périphériques, à surveiller",
    "Rares drusen maculaires, à surveiller",
    "Maculopathie liée à l'âge avec drusen",
    "DMLA débutante",
    "DMLA sèche",
    "DMLA exsudative",
  ],
  "Interface vitréo-maculaire": [
    "Adhérence vitréo-maculaire",
    "Traction vitréo-maculaire",
    "Trou maculaire",
  ],
  "Autre": [
    "Cicatrice choriorétinienne atrophique hyperpigmentée",
  ],
};
