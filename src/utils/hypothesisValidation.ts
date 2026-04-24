// CORRECTION : accès aux observations via `eye.observations` (EyeDataNormalisee)
// ou via les champs plats (EyeState brut) — gère les deux cas.

import type { HypotheseDiagnostique, Lateralite, EyeState } from '../types/clinical';

const EXCLUSIVE_CATEGORIES = [
  'Normal',
  'Neuropathie optique / glaucome',
  'Diabète',
  'Drusen / DMLA',
];

// Lit les observations depuis un EyeState brut (avant normalisation)
const hasSignInRawEye = (eye: EyeState, keywords: string[]): boolean => {
  const allObs = [
    ...(eye.observationsPapille ?? []),
    ...(eye.observationsMacula ?? []),
    ...(eye.observationsPeripherie ?? []),
    ...(eye.obsAnterieur ?? []),
    ...(eye.observationsDivers ? [eye.observationsDivers] : []),
    ...(eye.octaPerformed ? (eye.obsOCTA ?? []) : []),
  ];
  return allObs.some((item) =>
    keywords.some((kw) => item.toLowerCase().includes(kw.toLowerCase()))
  );
};


export interface HypothesisAdditionResult {
  isValid: boolean;
  reason?: string;
  warning?: string;
  newHypotheses?: HypotheseDiagnostique[];
}

export const processHypothesisAddition = (
  existingHypotheses: HypotheseDiagnostique[],
  candidate: HypotheseDiagnostique,
  eyeOD: EyeState | null = null,
  eyeOG: EyeState | null = null
): HypothesisAdditionResult => {
  const isBilatCandidate = candidate.lateralite === 'OD et OG';
  const candidateEyes: Lateralite[] = isBilatCandidate ? ['OD', 'OG'] : [candidate.lateralite];

  // 1. Conflits bloquants
  for (const existing of existingHypotheses) {
    const isBilatExisting = existing.lateralite === 'OD et OG';
    const existingEyes: Lateralite[] = isBilatExisting ? ['OD', 'OG'] : [existing.lateralite];

    const hasOverlap = candidateEyes.some((eye) => existingEyes.includes(eye));
    if (!hasOverlap) continue;

    if (existing.libelle === candidate.libelle) {
      if (candidate.lateralite === existing.lateralite) {
        return { isValid: false, reason: 'Cette hypothèse est déjà présente pour cette latéralité.' };
      }
      if (!isBilatCandidate && isBilatExisting) {
        return { isValid: false, reason: 'Cette hypothèse est déjà couverte par une sélection bilatérale (OD et OG).' };
      }
    } else if (existing.categorie === candidate.categorie && EXCLUSIVE_CATEGORIES.includes(candidate.categorie)) {
      const overlapEyes = candidateEyes.filter((eye) => existingEyes.includes(eye));
      return {
        isValid: false,
        reason: `Hypothèse contradictoire avec "${existing.libelle}" déjà sélectionnée pour ${overlapEyes.join(' et ')}.`,
      };
    }
  }

  // 2. Alertes non-bloquantes de cohérence clinique
  let warningMsg: string | undefined;
  const eyesToCheck: EyeState[] = [];
  if (candidateEyes.includes('OD') && eyeOD) eyesToCheck.push(eyeOD);
  if (candidateEyes.includes('OG') && eyeOG) eyesToCheck.push(eyeOG);

  const catLow = candidate.categorie.toLowerCase();
  const libLow = candidate.libelle.toLowerCase();
  const isAbsenceSign = libLow.includes('absence');

  if (!isAbsenceSign && eyesToCheck.length > 0) {
    if (catLow.includes('glaucome')) {
      const isSupported = eyesToCheck.some((eye) => {
        if (eye.rnfl?.toLowerCase().includes('inférieur')) return true;
        if (eye.gcl?.toLowerCase().includes('inférieur')) return true;
        if (eye.cupDisc && parseFloat(eye.cupDisc.replace(',', '.')) >= 0.7) return true;
        return hasSignInRawEye(eye, ['excavation', 'encoche', 'pâleur', 'paleur']);
      });
      if (!isSupported) {
        warningMsg = 'Alerte : hypothèse glaucomateuse peu soutenue par les données structurelles actuellement saisies.';
      }
    } else if (catLow.includes('diabète') || catLow.includes('diabete')) {
      const isSupported = eyesToCheck.some((eye) =>
        hasSignInRawEye(eye, ['microanévrisme', 'micro-anévrisme', 'hémorragie', 'hemorragie', 'exsudat', 'néovaisseau', 'neovaisseau', 'nodule cotonneux', 'ischémi', 'oedème', 'oedeme', 'œdème'])
      );
      if (!isSupported) {
        warningMsg = 'Alerte : hypothèse de rétinopathie diabétique peu soutenue par les signes rétiniens actuellement saisis.';
      }
    } else if (catLow.includes('dmla') || catLow.includes('drusen')) {
      const isSupported = eyesToCheck.some((eye) =>
        hasSignInRawEye(eye, ['drusen', 'remaniement', 'atrophie', 'exsudat', 'liquide', 'décollement'])
      );
      if (!isSupported) {
        warningMsg = 'Alerte : hypothèse maculaire peu soutenue par les données actuellement saisies.';
      }
    }
  }

  // 3. Intégration avec fusion OD+OG intelligente
  let result: HypotheseDiagnostique[] = [];
  let candidateToAdd = { ...candidate };

  for (const existing of existingHypotheses) {
    if (existing.libelle === candidateToAdd.libelle) {
      const isBilatExisting = existing.lateralite === 'OD et OG';
      const existingEyes: Lateralite[] = isBilatExisting ? ['OD', 'OG'] : [existing.lateralite];
      const currentCandidateEyes: Lateralite[] = candidateToAdd.lateralite === 'OD et OG' ? ['OD', 'OG'] : [candidateToAdd.lateralite];

      const hasOverlap = currentCandidateEyes.some((eye) => existingEyes.includes(eye));
      if (hasOverlap) continue;

      if (!hasOverlap && candidateToAdd.lateralite !== 'OD et OG' && !isBilatExisting) {
        candidateToAdd = { ...candidateToAdd, lateralite: 'OD et OG' };
        continue;
      }
    }
    result.push(existing);
  }

  result.push(candidateToAdd);
  return { isValid: true, warning: warningMsg, newHypotheses: result };
};

