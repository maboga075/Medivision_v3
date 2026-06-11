/**
 * Modèle de saisie RNFL / GCL+ par secteurs (remplace les <select> catégoriques).
 *
 * - RNFL : 4 quadrants péripapillaires (S, I, N, T), 4 états
 *     0 = normal · 1 = limite · 2 = hors norme · 3 = au-dessus de la norme
 * - GCL+ (GCIPL) : grille maculaire 6 secteurs (S, ST, IT, I, IN, SN), 3 états
 *     0 = normal · 1 = limite · 2 = hors norme
 *
 * Ce module reste la source de vérité des secteurs ET dérive un `RNFLGCLData`
 * legacy, de sorte que le pipeline existant (clinicalPayload, reportDataMapper,
 * biometricFormatter) continue de fonctionner sans modification.
 */

import type { RNFLGCLData, RNFLGCLStatus } from '../types/clinical';

export type RnflGrade = 0 | 1 | 2 | 3;
export type GclGrade = 0 | 1 | 2;

export type RnflSectorKey = 'S' | 'I' | 'N' | 'T';
export type GclSectorKey = 'S' | 'ST' | 'IT' | 'I' | 'IN' | 'SN';

export type RnflSectors = Record<RnflSectorKey, RnflGrade>;
export type GclSectors = Record<GclSectorKey, GclGrade>;

export const RNFL_SECTOR_ORDER: RnflSectorKey[] = ['S', 'I', 'N', 'T'];
export const GCL_SECTOR_ORDER: GclSectorKey[] = ['S', 'ST', 'IT', 'I', 'IN', 'SN'];

// Couleurs des états (alignées sur la maquette saisie-rnfl-gcl + dual-report).
export const RNFL_COLORS = ['#4caf7d', '#e0a93c', '#d35f4e', '#ffffff'] as const; // 4e = au-dessus (blanc)
export const GCL_COLORS = ['#4caf7d', '#e0a93c', '#d35f4e'] as const;

// Tokens CSS du compte rendu (cohérents avec OCTReport.css).
const REPORT_COLOR = ['var(--sage)', 'var(--amber)', 'var(--crimson)', 'var(--sage)'] as const;

export const GRADE_WORD = [
  'normal',
  'limite',
  'hors norme',
  'au-dessus de la norme',
] as const;

const RNFL_SECTOR_LABEL: Record<RnflSectorKey, string> = {
  S: 'Supérieur',
  I: 'Inférieur',
  N: 'Nasal',
  T: 'Temporal',
};

const GCL_SECTOR_LABEL: Record<GclSectorKey, string> = {
  S: 'Supérieur',
  ST: 'Supéro-temporal',
  IT: 'Inféro-temporal',
  I: 'Inférieur',
  IN: 'Inféro-nasal',
  SN: 'Supéro-nasal',
};

// Mapping secteur → code de localisation legacy (cf. biometricFormatter.LOCATION_LABEL).
const RNFL_LOC: Record<RnflSectorKey, string> = {
  S: 'sup',
  I: 'inf',
  N: 'nasal',
  T: 'temp',
};

const GCL_LOC: Record<GclSectorKey, string> = {
  S: 'sup',
  ST: 'temp_sup',
  IT: 'temp_inf',
  I: 'inf',
  IN: 'nasal_inf',
  SN: 'nasal_sup',
};

export const createDefaultRnflSectors = (): RnflSectors => ({ S: 0, I: 0, N: 0, T: 0 });
export const createDefaultGclSectors = (): GclSectors => ({ S: 0, ST: 0, IT: 0, I: 0, IN: 0, SN: 0 });

export const isRnflSectors = (v: unknown): v is RnflSectors =>
  !!v && typeof v === 'object' && RNFL_SECTOR_ORDER.every((k) => typeof (v as Record<string, unknown>)[k] === 'number');

export const isGclSectors = (v: unknown): v is GclSectors =>
  !!v && typeof v === 'object' && GCL_SECTOR_ORDER.every((k) => typeof (v as Record<string, unknown>)[k] === 'number');

export interface SectorSummary {
  text: string;   // résumé lisible (compte rendu / fallback)
  color: string;  // token CSS du compte rendu
  worst: number;  // pire grade rencontré (0 = tout normal)
  abnormalCount: number;
}

/** Résumé générique d'une grille de secteurs (RNFL ou GCL). */
function summarize<K extends string>(
  sectors: Record<K, number>,
  order: K[],
  label: Record<K, string>,
): SectorSummary {
  const entries = order.map((k) => ({ k, g: sectors[k] ?? 0 }));
  const worst = entries.reduce((m, e) => Math.max(m, e.g), 0);

  // Le grade 3 (au-dessus de la norme) n'est pas une atteinte hypotrophique.
  const lowered = entries.filter((e) => e.g === 1 || e.g === 2);

  if (lowered.length === 0) {
    if (worst === 3) {
      return { text: 'Supérieur aux normes', color: REPORT_COLOR[3], worst, abnormalCount: 0 };
    }
    return { text: 'Dans les normes', color: REPORT_COLOR[0], worst, abnormalCount: 0 };
  }

  const allLowered = lowered.length === order.length;
  const grade = Math.max(...lowered.map((e) => e.g)); // 1 ou 2
  const arrow = grade === 2 ? '↓' : 'Limite';
  const color = REPORT_COLOR[grade];

  if (allLowered) {
    return {
      text: grade === 2 ? '↓ Global' : 'Limite global',
      color,
      worst,
      abnormalCount: lowered.length,
    };
  }

  const where = lowered.map((e) => label[e.k]).join(', ');
  return {
    text: `${arrow} en ${where}`,
    color,
    worst,
    abnormalCount: lowered.length,
  };
}

export const summarizeRnfl = (s: RnflSectors): SectorSummary =>
  summarize(s, RNFL_SECTOR_ORDER, RNFL_SECTOR_LABEL);

export const summarizeGcl = (s: GclSectors): SectorSummary =>
  summarize(s, GCL_SECTOR_ORDER, GCL_SECTOR_LABEL);

/** Dérive un statut legacy générique à partir d'une grille de secteurs. */
function deriveStatus<K extends string>(
  sectors: Record<K, number>,
  order: K[],
  loc: Record<K, string>,
): RNFLGCLData {
  const entries = order.map((k) => ({ k, g: sectors[k] ?? 0 }));
  const worst = entries.reduce((m, e) => Math.max(m, e.g), 0);

  if (worst === 0) return { status: 'normal' };
  if (worst === 3 && !entries.some((e) => e.g === 1 || e.g === 2)) {
    return { status: 'superior' };
  }

  const grade = worst === 2 ? 2 : 1;
  const affected = entries.filter((e) => e.g === grade);
  const allAffected = affected.length === order.length;
  const location = affected.length === 1 ? loc[affected[0].k] : undefined;

  let status: RNFLGCLStatus;
  if (grade === 2) status = allAffected ? 'inferior_global' : 'inferior_localized';
  else status = allAffected ? 'limite_global' : 'limite_localized';

  return location ? { status, location } : { status };
}

export const deriveRnflStatus = (s: RnflSectors): RNFLGCLData =>
  deriveStatus(s, RNFL_SECTOR_ORDER, RNFL_LOC);

export const deriveGclStatus = (s: GclSectors): RNFLGCLData =>
  deriveStatus(s, GCL_SECTOR_ORDER, GCL_LOC);
