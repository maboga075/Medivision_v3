import type { RNFLGCLData } from '../types/clinical';

export interface BiometricDisplay {
  text: string;   // texte affiché dans le rapport
  color: string;  // token CSS ou hex
}

const LOCATION_LABEL: Record<string, string> = {
  temp_sup:  'Temp. sup',
  temp_inf:  'Temp. inf',
  nasal_sup: 'Nasal sup',
  nasal_inf: 'Nasal inf',
};

function locLabel(location: string | undefined): string {
  if (!location) return '';
  return LOCATION_LABEL[location] ?? location;
}

export function formatRNFLGCL(data: RNFLGCLData | undefined): BiometricDisplay | null {
  if (!data) return null;
  const loc = locLabel(data.location);

  switch (data.status) {
    case 'normal':
      return { text: 'Dans les normes', color: 'var(--sage)' };
    case 'superior':
      return { text: 'Supérieur aux normes', color: 'var(--amber)' };
    case 'inferior_global':
      return { text: '↓ Global', color: 'var(--crimson)' };
    case 'inferior_localized':
      return { text: loc ? `↓ ${loc}` : '↓ Localisé', color: 'var(--crimson)' };
    case 'limite_global':
      return { text: 'Limite Global', color: 'var(--amber)' };
    case 'limite_localized':
      return { text: loc ? `Limite ${loc}` : 'Limite', color: 'var(--amber)' };
  }
}
