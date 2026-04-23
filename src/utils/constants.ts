import type { UserPrefs } from '../types/prefs';

export const DEFAULT_PREFS: UserPrefs = {
  doctors: ["Dr. Milebou", "Dr. Kougou Ntoutoume", "Dr. Bongo", "Dr. Nyinko Aboughe", "Dr. Gabin", "Dr. Mekyna", "Dr. Matsanga", "Dr. Njilekissa", "Dr. Apedo", "Dr. Souleyman", "Pr. Mba Aki"],
  antecedents: ["Sans particularité", "Excavation papillaire", "Diabète type 2", "HTA", "Glaucome", "Chirurgie cataracte", "Hypertonie oculaire", "Myopie forte", "DMLA", "Neuropathie optique", "Uvéite", "Cataracte", "Maculopathie diabétique", "Rétinopathie hypertensive"],
  motifs: ["Suspicion d'un glaucome", "Excavation papillaire bilatérale", "Hypertonie oculaire", "Pâleur papillaire", "Recherche d'une rétinopathie diabétique", "Bilan visuel", "BAV", "Remaniement maculaire", "Suivi d'un glaucome", "Suivi rétinopathie diabétique", "Suspicion de kératocône", "Suspicion d'OVCR", "Suspicion de DMLA", "Neuropathie optique"],
  acqMotifs: ["Cataracte", "Nystagmus", "Problème de fixation", "Opacités cornéennes", "Sécheresse oculaire sévère", "Ptosis", "Trouble des milieux"],
  obsFavoris: ["Sans particularité", "Membrane épirétinienne", "Drusens", "Œdème maculaire cystoïde", "Traction vitréo-maculaire", "Décollement séreux rétinien", "Hémorragies en flammèches", "Micro-anévrismes", "Exsudats maculaires", "Excavation modérée", "Pâleur papillaire"],
  obsAnterieur: ["Sans particularité", "Amincissement focal (suspect kératocône)", "Bombement cornéen inférieur", "Cicatrices cornéennes", "Stries de Vogt", "Œdème cornéen", "Infiltrat", "Perte Courbure", "Asymétrie cornéenne", "Opacité cristallinienne"],
  obsOCTA: ["Sans particularité", "Diminution de la densité vasculaire", "Néovaisseaux", "Désorganisation maille capillaire", "Territoires ischémiques", "Absence de néovaisseaux", "Élargissement de la ZAF", "Raréfaction capillaire périfovéolaire"],
  obsPapille: ["Sans particularité", "Contours nets", "Contours flous", "Bords réguliers", "Excavation modérée", "Excavation marquée", "Pâleur papillaire", "Encoche rebord neuro-rétinien", "Hémorragies papillaires", "Raréfaction vasculaire péripapillaire", "Papille pâle", "Atrophie péripapillaire", "Tilted disc", "Drusen papillaires"],
  obsMacula: ["Sans particularité", "Reflet maculaire suspect", "Drusens", "Exsudats maculaires", "Œdème maculaire", "Membrane épirétinienne", "Décollement séreux", "Trou maculaire", "Menace trou lamellaire", "Remaniement de l'épithélium pigmentaire", "Atrophie maculaire"],
  obsVasc: ["Sans particularité", "Tortuosités veineuses", "Hémorragies en flammèches", "Hémorragies punctiformes", "Micro-anévrismes", "Néovaisseaux", "Nodules cotonneux", "Exsudats secs", "Ischémie rétinienne", "Engainement vasculaire", "Occlusion veineuse"],
  obsPeriph: ["Sans particularité", "Déchirure rétinienne", "Décollement rétinien", "Dégénérescence palissadique", "Givre rétinien", "Trou rond atrophique"],
};

export const RNFL_OPTIONS = [
  "Dans les normes",
  "Inférieur aux normes",
  "Dans les limites inférieures de la norme",
  "Supérieur aux normes",
  "Inférieur aux normes dans l'ensemble des cadrans",
] as const;

export const EVOLUTION_OPTIONS = [
  "Stable",
  "Diminution (amincissement)",
  "Augmentation (épaississement)",
  "Fluctuant",
  "Non évaluable",
] as const;

export const LOC_PAPILLAIRE = [
  "cadran papillaire supérieur",
  "cadran papillaire inférieur",
  "cadran papillaire temporal inférieur",
  "cadran papillaire temporal supérieur",
  "cadrans papillaires temporal (sup. et inf.)",
  "cadran papillaire nasal inférieur",
  "cadran papillaire nasal supérieur",
  "Cadran papillaire nasal (sup. et inf.)",
] as const;

export const LOC_MACULAIRE = [
  "ensemble des cadrans maculaires",
  "cadran maculaire supérieur",
  "cadran maculaire inférieur",
  "cadran maculaire temporal inférieur",
  "cadran maculaire temporal supérieur",
  "cadrans maculaires temporal (sup. et inf.)",
  "cadran maculaire nasal inférieur",
  "cadran maculaire nasal supérieur",
  "cadrans maculaires nasal (sup. et inf.)",
] as const;

export const REPORT_TYPES = [
  "Compte rendu OCT",
  "Compte rendu Rétinographie",
  "Compte rendu OCT + Rétinographie",
  "OCT du Segment Antérieur",
] as const;

export type ReportType = typeof REPORT_TYPES[number];

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
