// CORRECTION DU BUG CRITIQUE : les observations plates (obsPapille, obsMacula, etc.)
// sont maintenant correctement mappées vers l'objet `observations` imbriqué
// attendu par clinicalSummary.ts et hypothesisValidation.ts.

import type {
  EyeState,
  EyeDataNormalisee,
  DonneesCliniquesNormalisees,
  HypotheseDiagnostique,
  ObservationsNormalisees,
} from '../types/clinical';
import type { RawConsultationData } from '../types/clinical';

const cleanString = (str: unknown): string => {
  if (typeof str !== 'string') return '';
  return str.trim();
};

const cleanArray = (arr: unknown): string[] => {
  if (!Array.isArray(arr)) return [];
  return [...new Set((arr as unknown[]).map((item) => cleanString(item)).filter((item) => item !== ''))];
};

const toNumberIfPossible = (val: unknown): number | string => {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = parseFloat(val.replace(',', '.'));
    if (!isNaN(parsed)) return parsed;
  }
  return typeof val === 'string' ? val : '';
};

const normalizeStatut = (statut: unknown): string => {
  const s = cleanString(statut).toLowerCase();
  if (s.includes('inférieur') || s.includes('inferieur')) {
    if (s.includes('ensemble')) return 'inferieur_norme_globale';
    if (s.includes('limites')) return 'limite_inferieure';
    return 'inferieur_norme';
  }
  if (s.includes('supérieur') || s.includes('superieur')) return 'superieur_norme';
  if (s.includes('dans les normes') || s.includes('sans particularité')) return 'dans_normes';
  return cleanString(statut);
};

// Supprime récursivement les champs vides/nuls d'un objet
function removeEmptyFields<T>(obj: T): T {
  if (Array.isArray(obj)) {
    const filtered = (obj as unknown[])
      .map((v) => removeEmptyFields(v))
      .filter((v) => v !== null && v !== undefined && v !== '');
    return filtered as unknown as T;
  }
  if (obj !== null && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const cleaned = removeEmptyFields(v);
      if (cleaned === null || cleaned === undefined || cleaned === '') continue;
      if (Array.isArray(cleaned) && cleaned.length === 0) continue;
      if (typeof cleaned === 'object' && !Array.isArray(cleaned) && Object.keys(cleaned as object).length === 0) continue;
      result[k] = cleaned;
    }
    return result as T;
  }
  return obj;
}

// CORRECTION : mappe les champs plats obs* vers l'objet observations imbriqué
const buildObservations = (eye: EyeState): ObservationsNormalisees => {
  const obs: ObservationsNormalisees = {};

  const assign = (key: keyof ObservationsNormalisees, arr: string[]) => {
    const clean = cleanArray(arr);
    if (clean.length > 0) obs[key] = clean;
  };

  assign('papille', eye.obsPapille);
  assign('macula', eye.obsMacula);
  assign('vasculaire', eye.obsVasc);
  assign('peripherie', eye.obsPeriph);
  assign('anterieur', eye.obsAnterieur);
  assign('favoris', eye.obsFavoris);

  if (eye.octaPerformed) {
    assign('octa', eye.obsOCTA);
  }

  return obs;
};

const normalizeEyeData = (eye: EyeState): EyeDataNormalisee => {
  const observations = buildObservations(eye);

  return {
    acquisitionStatus: eye.acquisitionStatus,
    ...(eye.acquisitionMotif ? { acquisitionMotif: eye.acquisitionMotif } : {}),
    hasFollowUp: eye.hasFollowUp,
    ...(eye.followUpDate ? { followUpDate: eye.followUpDate } : {}),
    ...(eye.rnflEvolution ? { rnflEvolution: eye.rnflEvolution } : {}),
    ...(eye.gclEvolution ? { gclEvolution: eye.gclEvolution } : {}),
    rnfl_statut: normalizeStatut(eye.rnfl),
    gcl_statut: normalizeStatut(eye.gcl),
    ...(eye.cupDisc ? { cup_disc_vertical: toNumberIfPossible(eye.cupDisc) } : {}),
    ...(eye.cornealThickness ? { pachymetrie: toNumberIfPossible(eye.cornealThickness) } : {}),
    ...(eye.discSurface ? { discSurface: eye.discSurface } : {}),
    octaPerformed: eye.octaPerformed,
    ...(eye.obsFree ? { obsFree: eye.obsFree } : {}),
    observations,
    images: eye.images,
  };
};

export const normalizeClinicalData = (
  rawInputJson: RawConsultationData
): DonneesCliniquesNormalisees | null => {
  if (!rawInputJson) return null;

  const normalized: DonneesCliniquesNormalisees = {
    patient: {
      nom: cleanString(rawInputJson.patient?.nom),
      age: toNumberIfPossible(rawInputJson.patient?.age),
      ...(rawInputJson.patient?.date_naissance
        ? { date_naissance: cleanString(rawInputJson.patient.date_naissance) }
        : {}),
    },
    contexte: {
      ...(rawInputJson.contexte?.prescripteur
        ? { prescripteur: cleanString(rawInputJson.contexte.prescripteur) }
        : {}),
      motifs: cleanArray(rawInputJson.contexte?.motifs),
      antecedents: cleanArray(rawInputJson.contexte?.antecedents),
      hypotheses_diagnostiques: (rawInputJson.contexte?.hypotheses_diagnostiques ?? [])
        .map((h): HypotheseDiagnostique => ({
          categorie: cleanString(h.categorie),
          libelle: cleanString(h.libelle),
          lateralite: h.lateralite,
        }))
        .filter(
          (v, i, a) =>
            a.findIndex(
              (t) =>
                t.categorie === v.categorie &&
                t.libelle === v.libelle &&
                t.lateralite === v.lateralite
            ) === i
        ),
      ...(rawInputJson.contexte?.hypothese_libre
        ? { hypothese_libre: cleanString(rawInputJson.contexte.hypothese_libre) }
        : {}),
    },
    donnees_cliniques: {
      oeil_droit: rawInputJson.oeil_droit ? normalizeEyeData(rawInputJson.oeil_droit) : null,
      oeil_gauche: rawInputJson.oeil_gauche ? normalizeEyeData(rawInputJson.oeil_gauche) : null,
    },
  };

  return removeEmptyFields(normalized);
};
