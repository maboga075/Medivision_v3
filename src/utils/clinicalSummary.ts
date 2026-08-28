// CORRECTION DU BUG CRITIQUE : accès aux observations via `eye.observations`
// maintenant correctement peuplé par clinicalPayload.ts.

import type {
  EyeDataNormalisee,
  ObservationsNormalisees,
  AnalyseOeil,
  ClinicalSummary,
  DonneesCliniquesNormalisees,
} from '../types/clinical';

const hasSign = (obs: ObservationsNormalisees, category: keyof ObservationsNormalisees, keywords: string[]): boolean => {
  const items = obs[category];
  if (!items || items.length === 0) return false;
  return items.some((item) =>
    keywords.some((kw) => item.toLowerCase().includes(kw.toLowerCase()))
  );
};

const analyzeEye = (eye: EyeDataNormalisee | null, contexteStr: string): AnalyseOeil => {
  const anomalies: string[] = [];
  const patterns: string[] = [];
  let suspicion: string | null = null;

  if (!eye) return { anomalies, patterns, suspicion };

  const ctxLow = contexteStr.toLowerCase();
  const obs = eye.observations ?? {};

  // 0. OBSERVATIONS OBJECTIVES — chaque coupe/template activé est un constat que
  // l'IA doit exploiter. On remonte comme anomalies significatives les lésions
  // dessinées (rétino + B-scan + OCT-A + cornée/angle) ET les observations
  // structurées (papille, macula, périphérie, segment antérieur). Chaque
  // paramètre renseigné est ainsi pris en compte dans le pré-résumé.
  const OBSERVATION_CATEGORIES: (keyof ObservationsNormalisees)[] = [
    'retina', 'bscan', 'octa', 'cornea',
    'papille', 'macula', 'peripherie', 'anterieur', 'favoris',
  ];
  for (const category of OBSERVATION_CATEGORIES) {
    const items = obs[category];
    if (!items || items.length === 0) continue;
    for (const item of items) {
      const clean = item.replace(/\.$/, '').trim();
      if (clean) anomalies.push(clean.charAt(0).toUpperCase() + clean.slice(1));
    }
  }
  // Épaisseur cornéenne + angle iridocornéen (OCT antérieur) — constats chiffrés.
  if (eye.pachymetrie) anomalies.push(`Pachymétrie cornéenne : ${eye.pachymetrie} µm`);
  if (eye.angle_irido_corneen) anomalies.push(`Angle iridocornéen : ${eye.angle_irido_corneen}`);

  // 0bis. SUIVI RNFL/GCL — l'évolution renseignée oriente l'interprétation.
  if (eye.hasFollowUp) {
    const rnflEvo = (eye.rnflEvolution ?? '').toLowerCase();
    const gclEvo = (eye.gclEvolution ?? '').toLowerCase();
    if (rnflEvo.includes('diminution') || rnflEvo.includes('amincissement')) {
      anomalies.push('Diminution du RNFL au suivi (aggravation)');
      patterns.push('aggravation_suivi');
    }
    if (gclEvo.includes('diminution') || gclEvo.includes('amincissement')) {
      anomalies.push('Diminution du complexe ganglionnaire (GCL) au suivi (aggravation)');
      patterns.push('aggravation_suivi');
    }
  }

  // 1. GLAUCOME / NEUROPATHIE OPTIQUE
  const isCupDiscHigh =
    eye.cup_disc_vertical !== undefined &&
    eye.cup_disc_vertical !== '' &&
    parseFloat(String(eye.cup_disc_vertical)) >= 0.7;

  const isRnflLow = ['inferieur_norme', 'limite_inferieure', 'inferieur_norme_globale'].includes(
    eye.rnfl_statut ?? ''
  );
  const isGclLow = ['inferieur_norme', 'limite_inferieure', 'inferieur_norme_globale'].includes(
    eye.gcl_statut ?? ''
  );
  const papilleHasExcav = hasSign(obs, 'papille', ['excavation']);

  if (isCupDiscHigh || isRnflLow || papilleHasExcav) {
    patterns.push('profil_glaucomateux_possible');
    suspicion = 'Suspicion de neuropathie optique glaucomateuse';

    if (isCupDiscHigh) anomalies.push(`Rapport Cup/Disc augmenté (${eye.cup_disc_vertical})`);
    if (isRnflLow) anomalies.push('Amincissement du RNFL');
    if (isGclLow) anomalies.push('Amincissement du complexe ganglionnaire (GCL)');
    if (papilleHasExcav) anomalies.push('Excavation papillaire objectivée');
    if (hasSign(obs, 'papille', ['encoche'])) anomalies.push('Encoche du rebord neuro-rétinien');
    if (hasSign(obs, 'papille', ['pâleur', 'paleur'])) anomalies.push('Pâleur papillaire');
  }

  // 2. RÉTINOPATHIE DIABÉTIQUE
  const isDiabeticContext = ctxLow.includes('diabète') || ctxLow.includes('diabete');
  const diabeticVascularKw = ['micro-anévrisme', 'microanévrisme', 'néovaisseau', 'neovaisseau', 'hémorragie', 'hemorragie', 'exsudat', 'nodule cotonneux'];
  const hasDiabeticSigns =
    hasSign(obs, 'vasculaire', diabeticVascularKw) ||
    hasSign(obs, 'retina', diabeticVascularKw) ||
    hasSign(obs, 'macula', ['exsudat', 'oedème', 'oedeme', 'œdème']) ||
    hasSign(obs, 'favoris', ['micro-anévrisme', 'hémorragie', 'exsudat']);

  if (isDiabeticContext && hasDiabeticSigns) {
    patterns.push('retinopathie_diabetique_possible');
    suspicion = suspicion
      ? `${suspicion} et Rétinopathie diabétique`
      : 'Rétinopathie diabétique';

    if (hasSign(obs, 'vasculaire', ['hémorragie', 'hemorragie']) || hasSign(obs, 'retina', ['hémorragie', 'hemorragie'])) anomalies.push('Hémorragies rétiniennes');
    if (hasSign(obs, 'vasculaire', ['micro-anévrisme', 'microanévrisme']) || hasSign(obs, 'retina', ['micro-anévrisme', 'microanévrisme'])) anomalies.push('Micro-anévrismes');
    if (hasSign(obs, 'vasculaire', ['néovaisseau', 'neovaisseau']) || hasSign(obs, 'retina', ['néovaisseau', 'neovaisseau'])) anomalies.push('Néovaisseaux');
    if (hasSign(obs, 'macula', ['exsudat'])) anomalies.push('Exsudats maculaires');
    if (hasSign(obs, 'macula', ['oedème', 'oedeme', 'œdème'])) anomalies.push('Œdème maculaire');
  }

  // 3. DMLA / DRUSEN
  const hasDrusen =
    hasSign(obs, 'macula', ['drusen', 'drusens']) ||
    hasSign(obs, 'papille', ['drusen', 'drusens']) ||
    hasSign(obs, 'favoris', ['drusen', 'drusens']);

  const hasMacularAlt =
    hasSign(obs, 'macula', ['remaniement', 'atrophie']) ||
    hasSign(obs, 'favoris', ['remaniement']);

  if (hasDrusen || hasMacularAlt) {
    patterns.push('dmla_possible');
    const dmlaStr = 'Aspect compatible avec une DMLA débutante/évolutive';
    if (!suspicion) {
      suspicion = dmlaStr;
    } else if (!suspicion.includes('DMLA')) {
      suspicion += ` | ${dmlaStr}`;
    }

    if (hasDrusen) anomalies.push("Présence de drusens");
    if (hasMacularAlt) anomalies.push("Remaniements/atrophies de l'épithélium pigmentaire");
  }

  // 4. MEMBRANE ÉPIRÉTINIENNE / INTERFACE
  if (hasSign(obs, 'macula', ['membrane épirétinienne']) || hasSign(obs, 'favoris', ['membrane épirétinienne'])) {
    patterns.push('membrane_epiretinienne');
    anomalies.push('Membrane épirétinienne');
  }

  if (hasSign(obs, 'macula', ['traction vitréo', 'trou maculaire'])) {
    patterns.push('interface_vitreo_maculaire');
    anomalies.push('Anomalie de l\'interface vitréo-maculaire');
  }

  return {
    anomalies: [...new Set(anomalies)],
    patterns: [...new Set(patterns)],
    suspicion,
  };
};

export const buildClinicalSummary = (
  normalizedJson: DonneesCliniquesNormalisees | null
): ClinicalSummary | null => {
  if (!normalizedJson) return null;

  const contexteArray = [
    ...(normalizedJson.contexte?.motifs ?? []),
    ...(normalizedJson.contexte?.antecedents ?? []),
    normalizedJson.contexte?.hypothese_libre ?? '',
  ];
  const contexteStr = contexteArray.join(' ');

  const odResult = analyzeEye(normalizedJson.donnees_cliniques?.oeil_droit ?? null, contexteStr);
  const ogResult = analyzeEye(normalizedJson.donnees_cliniques?.oeil_gauche ?? null, contexteStr);

  return {
    analyse_clinique: {
      oeil_droit: odResult,
      oeil_gauche: ogResult,
    },
    hypotheses_medecin: normalizedJson.contexte?.hypotheses_diagnostiques ?? [],
  };
};
