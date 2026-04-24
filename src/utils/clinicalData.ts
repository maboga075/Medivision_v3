import type { EyeState, ImageData } from '../types/clinical';
import { NORMAL_VALUES } from './constants';

export const createEyeState = (): EyeState => ({
  acquisitionStatus: 'Bon',
  acquisitionMotif: '',
  acquisitionQuality: 'bon',
  hasFollowUp: false,
  followUpDate: '',
  rnflEvolution: 'Stable',
  gclEvolution: 'Stable',
  rnfl: 'Dans les normes',
  rnflLoc: '',
  gcl: 'Dans les normes',
  gclLoc: '',
  cornealThickness: '',
  obsAnterieur: [],
  discSurface: '',
  cupDisc: '',
  octaPerformed: false,
  obsOCTA: [],
  observationsMacula: [],
  observationsPapille: [],
  observationsPeripherie: [],
  observationsDivers: '',
  obsFree: '',
  images: [],
});

export const needsLocalisation = (val: string): boolean =>
  !!val &&
  val !== 'Dans les normes' &&
  val !== 'Supérieur aux normes' &&
  val !== 'Impossible' &&
  !val.includes('ensemble');

export const isAnomaly = (value: string | undefined): boolean => {
  if (!value || value === '—') return false;
  return String(value)
    .split(', ')
    .map((s) => s.trim())
    .some((p) => !NORMAL_VALUES.includes(p));
};

export const isCupDiscAlert = (value: string | undefined): boolean => {
  if (!value || value === '—' || value === 'Impossible') return false;
  const num = parseFloat(String(value).replace(',', '.'));
  return !isNaN(num) && num >= 0.7;
};

export const hasRealSelection = (arr: string[]): boolean =>
  arr.length > 0 && !(arr.length === 1 && arr[0] === 'Sans particularité');

export const fileToBase64 = (file: File): Promise<ImageData> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () =>
      resolve({ name: file.name, type: file.type, data: reader.result as string });
    reader.onerror = (error) => reject(error);
  });
