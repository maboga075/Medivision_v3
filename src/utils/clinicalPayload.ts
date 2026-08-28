// CORRECTION DU BUG CRITIQUE : les observations plates (obsPapille, obsMacula, etc.)
// sont maintenant correctement mappées vers l'objet `observations` imbriqué
// attendu par clinicalSummary.ts et hypothesisValidation.ts.

import type {
  EyeState,
  EyeDataNormalisee,
  DonneesCliniquesNormalisees,
  HypotheseDiagnostique,
  ObservationsNormalisees,
  RNFLGCLData,
} from '../types/clinical';
import type { RawConsultationData } from '../types/clinical';
import { generateReport } from '../features/retinasketch/lib/report/generate';
import type { Annotation } from '../features/retinasketch/lib/types';

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

const normalizeStatut = (data: RNFLGCLData | undefined): string => {
  if (!data) return 'dans_normes';
  switch (data.status) {
    case 'inferior_global':    return 'inferieur_norme_globale';
    case 'inferior_localized': return 'inferieur_norme';
    case 'limite_global':      return 'limite_inferieure_globale';
    case 'limite_localized':   return 'limite_inferieure';
    case 'superior':           return 'superieur_norme';
    case 'normal':
    default:                   return 'dans_normes';
  }
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

// Mappe les champs bubble-picker + annotations RSK vers l'objet observations imbriqué
const buildObservations = (eye: EyeState, laterality: 'OD' | 'OG'): ObservationsNormalisees => {
  const obs: ObservationsNormalisees = {};

  const assign = (key: keyof ObservationsNormalisees, arr: string[]) => {
    const clean = cleanArray(arr);
    if (clean.length > 0) obs[key] = clean;
  };

  assign('papille', eye.observationsPapille ?? []);
  assign('macula', eye.observationsMacula ?? []);
  assign('peripherie', eye.observationsPeripherie ?? []);
  assign('anterieur', eye.obsAnterieur ?? []);

  if (eye.observationsDivers?.trim()) {
    obs.favoris = [eye.observationsDivers.trim()];
  }

  if (eye.octaPerformed) {
    assign('octa', eye.obsOCTA ?? []);
  }

  // Annotations RetinaSketch — converties en texte clinique structuré, réparties
  // par type de coupe. L'éditeur tague l'œil gauche en 'OS' (convention latine
  // Konva) ; on convertit 'OG' → 'OS' pour le filtre de latéralité de generateReport.
  const rskLaterality = laterality === 'OG' ? 'OS' : 'OD';

  /** Extrait les lignes de lésions ("• Présence de…") d'un lot d'annotations. */
  const lesionLines = (anns: Annotation[]): string[] =>
    generateReport(anns, rskLaterality)
      .split('\n')
      .filter((l) => l.startsWith('•'))
      .map((l) => l.replace(/^•\s*/, '').trim())
      .filter(Boolean);

  // Rétinographie : slot principal (annotations à plat de l'œil).
  const retinaAnns = (eye.retinaAnnotations ?? []) as Annotation[];
  if (retinaAnns.some((a) => a.status === 'validated')) {
    const lines = lesionLines(retinaAnns);
    if (lines.length > 0) obs.retina = lines;
  }

  // Autres coupes (B-scan, cornée, OCT-A) : annotations des slots non-rétino,
  // chacune interprétée dans le référentiel de sa coupe (couche + position).
  const crossAnns = (eye.retinaSlots ?? [])
    // Les images libres (annexes) ne sont pas des observations cliniques structurées.
    .filter((sl) => sl.kind !== 'retino' && sl.kind !== 'free')
    .flatMap((sl) => (sl.annotations ?? []) as Annotation[]);
  for (const ctx of ['bscan', 'cornea', 'octa'] as const) {
    const subset = crossAnns.filter(
      (a) => a.status === 'validated' && a.attrs.context === ctx,
    );
    if (subset.length === 0) continue;
    const lines = lesionLines(subset);
    if (lines.length > 0) obs[ctx] = lines;
  }

  return obs;
};

const normalizeEyeData = (eye: EyeState, laterality: 'OD' | 'OG'): EyeDataNormalisee => {
  const observations = buildObservations(eye, laterality);

  // Qualité d'acquisition (indice de fiabilité) : transmise à l'IA pour qu'elle
  // en tienne compte. 'bon' reste implicite ; 'faible'/'impossible' + motifs sont
  // remontés pour être mentionnés et nuancer l'interprétation.
  const quality = eye.acquisitionQuality ?? 'bon';
  const isDegraded = quality === 'faible' || quality === 'impossible';
  const reasons = (eye.acquisitionQualityReasons ?? []).filter(Boolean);

  // Exclusions facultatives, indépendantes de l'indice d'acquisition.
  const rnflGclExcluded = eye.excludeRnflGcl === true;
  const discExcluded = eye.excludeDisc === true;

  // octaPerformed : n'inclure que si true — false est implicite (absence = non réalisé, à ne pas mentionner)
  const rnflStatut = normalizeStatut(eye.rnfl);
  const gclStatut = normalizeStatut(eye.gcl);

  return {
    ...(isDegraded ? { acquisitionQuality: quality } : {}),
    ...(isDegraded && reasons.length > 0 ? { acquisitionMotifs: reasons } : {}),
    ...(rnflGclExcluded ? { rnfl_gcl_non_interpretable: true } : {}),
    ...(eye.hasFollowUp && !rnflGclExcluded ? { hasFollowUp: eye.hasFollowUp } : {}),
    ...(eye.followUpDate && !rnflGclExcluded ? { followUpDate: eye.followUpDate } : {}),
    ...(eye.hasFollowUp && !rnflGclExcluded && eye.rnflEvolution ? { rnflEvolution: eye.rnflEvolution } : {}),
    ...(eye.hasFollowUp && !rnflGclExcluded && eye.gclEvolution  ? { gclEvolution: eye.gclEvolution }  : {}),
    ...(!rnflGclExcluded && rnflStatut !== 'dans_normes' ? { rnfl_statut: rnflStatut } : {}),
    ...(!rnflGclExcluded && gclStatut !== 'dans_normes' ? { gcl_statut: gclStatut } : {}),
    ...(!rnflGclExcluded && eye.rnfl?.location ? { rnfl_localisation: eye.rnfl.location } : {}),
    ...(!rnflGclExcluded && eye.gcl?.location ? { gcl_localisation: eye.gcl.location } : {}),
    ...(discExcluded ? { disque_non_interpretable: true } : {}),
    ...(!discExcluded && eye.cupDisc ? { cup_disc_vertical: toNumberIfPossible(eye.cupDisc) } : {}),
    ...(eye.cornealThickness ? { pachymetrie: toNumberIfPossible(eye.cornealThickness) } : {}),
    ...(eye.iridoCornealAngle ? { angle_irido_corneen: eye.iridoCornealAngle } : {}),
    ...(!discExcluded && eye.discSurface ? { discSurface: eye.discSurface } : {}),
    ...(eye.octaPerformed ? { octaPerformed: true } : {}),
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
      oeil_droit:  rawInputJson.oeil_droit  ? normalizeEyeData(rawInputJson.oeil_droit,  'OD') : null,
      oeil_gauche: rawInputJson.oeil_gauche ? normalizeEyeData(rawInputJson.oeil_gauche, 'OG') : null,
    },
  };

  return removeEmptyFields(normalized);
};
