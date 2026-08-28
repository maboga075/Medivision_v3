export const DEFAULT_MACULA_SUGGESTIONS = [
  'Sans particularité',
  'Drusens',
  'Atrophie maculaire',
  'Membrane épirétinienne',
  'Trou maculaire',
  'Œdème maculaire cystoïde',
  'Décollement séreux rétinien',
  'Remaniements EPR',
  'Néovaisseaux sous-rétiniens',
  'Microanévrismes',
  'Exsudats',
  'Hémorragies',
];

export const DEFAULT_PAPILLE_SUGGESTIONS = [
  'Sans particularité',
  'Pâleur papillaire',
  'Excavation augmentée',
  'Hémorragie papillaire',
  'Notch papillaire',
  'Bord temporal aminci',
  'Papille hyperhémique',
  'Atrophie péripapillaire',
  'Drusen papillaire',
];

export const DEFAULT_PERIPHERIE_SUGGESTIONS = [
  'Sans particularité',
  'Dégénérescence palissadique',
  'Déchirure rétinienne',
  'Décollement de rétine',
  'Néovaisseaux',
  'Hémorragies périphériques',
  'Traction vitréorétinienne',
];

export const DEFAULT_MOTIFS_SUGGESTIONS = [
  "Contrôle glaucome",
  "Contrôle DMLA",
  "Contrôle rétinopathie diabétique",
  "Baisse d'acuité visuelle",
  "Métamorphopsies",
  "Scotome",
  "Œdème maculaire",
  "Suivi post-opératoire",
  "Bilan ophtalmologique complet",
];

export const DEFAULT_ANTECEDENTS_SUGGESTIONS = [
  'Diabète type 1',
  'Diabète type 2',
  'Hypertension artérielle',
  'Myopie forte',
  'Glaucome',
  'DMLA',
  'Chirurgie réfractive',
  'Chirurgie de la cataracte',
  'Uvéite',
  'Occlusion vasculaire',
];

export const DEFAULT_DIAGNOSTIC_SUGGESTIONS = [
  'DMLA',
  'Glaucome primitif à angle ouvert',
  'Rétinopathie diabétique',
  'Membrane épirétinienne',
  'Trou maculaire',
  'Œdème maculaire',
  'Neuropathie optique',
  'Occlusion veine centrale',
  'Décollement de rétine',
];

export const DEFAULT_PRESCRIPTEURS = [
  'Dr. Milebou',
  'Dr. Kougou Ntoutoume',
  'Dr. Bongo',
  'Dr. Nyinko Aboughe',
  'Dr. Gabin',
  'Dr. Mekyna',
  'Dr. Matsanga',
  'Dr. Njilekissa',
  'Dr. Apedo',
  'Dr. Souleyman',
  'Pr. Mba Aki',
  'Dr. Baye',
  'Dr. Mboussou',
];

export const DEFAULT_DIVERS_SUGGESTIONS = [
  'Bonne fixation',
  'Fixation instable',
  'Trouble des milieux',
  'Artefacts de segmentation',
  'Qualité d\'image limite',
  'Coopération limitée',
  'Larmoiement',
  'Photophobie',
  'À recontrôler',
];

export const DEFAULT_HYPOTHESE_LIBRE_SUGGESTIONS = [
  'À corréler à la clinique',
  'Aspect stable par rapport à l\'examen précédent',
  'Surveillance rapprochée conseillée',
  'Contrôle à 6 mois',
  'Contrôle à 1 an',
  'Examen complémentaire recommandé',
  'Résultat à confirmer',
  'Absence d\'argument pour une pathologie évolutive',
];

export const DEFAULT_SUGGESTIONS: Record<string, string[]> = {
  macula:           DEFAULT_MACULA_SUGGESTIONS,
  papille:          DEFAULT_PAPILLE_SUGGESTIONS,
  peripherie:       DEFAULT_PERIPHERIE_SUGGESTIONS,
  motifs:           DEFAULT_MOTIFS_SUGGESTIONS,
  antecedents:      DEFAULT_ANTECEDENTS_SUGGESTIONS,
  diagnostics:      DEFAULT_DIAGNOSTIC_SUGGESTIONS,
  divers:           DEFAULT_DIVERS_SUGGESTIONS,
  hypothesesLibres: DEFAULT_HYPOTHESE_LIBRE_SUGGESTIONS,
};
