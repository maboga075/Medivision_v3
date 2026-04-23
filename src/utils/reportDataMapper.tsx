import type { ReactNode } from 'react';
import type { RawConsultationData, EyeState } from '../types/clinical';
import type { AIResult, AIInterpretation } from '../types/ai';
import type { OCTReportData, EyeData, ParamRow, PillVariant } from '../types/report';

/* ─── Praticien par défaut ─────────────────────────────────────── */

export interface PractitionerData {
  title: string;
  name: string;
  specialty: string;
  email: string;
  phone: string;
  city: string;
  clinicLine: string;
}

export const DEFAULT_PRACTITIONER: PractitionerData = {
  title: 'Dr.',
  name: 'Yoan MBOUSSOU',
  specialty: 'Médecin · Imagerie rétinienne',
  email: 'yoanmboussou@gmail.com',
  phone: '+241 76 51 50 12',
  city: 'Libreville',
  clinicLine: 'CLINIQUE MEDIVISION · Libreville, Gabon',
};

/* ─── Helpers date ─────────────────────────────────────────────── */

const MONTHS_FR = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

function formatDateFR(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getDate()} ${MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

function generateReportNumber(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  if (isNaN(d.getTime())) {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-01`;
  }
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}${day}-01`;
}

/* ─── Highlight termes OCT clés dans le texte ─────────────────── */

const KEY_TERM_REGEX =
  /\b(RNFL|GCL\+\+|GCL|C\/D|OCT[A]?|PIO|DMLA|OVCR|OBVR|OACR|DR[NP]?)\b/g;

function highlightText(text: string): ReactNode {
  const chunks: ReactNode[] = [];
  let lastIndex = 0;
  const regex = new RegExp(KEY_TERM_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      chunks.push(text.slice(lastIndex, match.index));
    }
    chunks.push(
      <span key={match.index} className="key">
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  if (chunks.length === 0) return text;
  if (chunks.length === 1 && typeof chunks[0] === 'string') return chunks[0];
  return <>{chunks}</>;
}

/* ─── Pill variant depuis les observations ─────────────────────── */

const CRITICAL_KEYWORDS = [
  'décollement rétinien',
  'néovaisseaux choroïdiens',
  'trou maculaire',
  'déchirure rétinienne',
  'proliférante',
  'ovcr',
  'oacr',
];

const ALERT_KEYWORDS = [
  'excavation',
  'pâleur papillaire',
  'papille pâle',
  'encoche',
  'drusen',
  'membrane épirétinienne',
  'remaniement',
  'hémorragie',
  'ischémie',
  'exsudat',
  'œdème',
  'traction',
  'amincissement focal',
  'kératocône',
  'bombement cornéen',
  'dégénérescence',
  'atrophie',
  'décollement séreux',
  'micro-anévrisme',
  'nodule coton',
  'engainement',
  'tortuosité',
  'cicatrice',
  'stries de vogt',
  'trou lamellaire',
  'reflet maculaire suspect',
  'contours flous',
];

function determinePillVariant(observations: string[]): PillVariant {
  const text = observations.join(' ').toLowerCase();
  if (CRITICAL_KEYWORDS.some((t) => text.includes(t))) return 'critical';
  if (ALERT_KEYWORDS.some((t) => text.includes(t))) return 'alert';
  return 'normal';
}

function buildPillText(observations: string[]): string {
  // Si "Sans particularité" + anomalies → montrer seulement les anomalies
  const anomalies = observations.filter(
    (o) => o.toLowerCase() !== 'sans particularité'
  );
  const relevant = anomalies.length > 0 ? anomalies : observations;
  return relevant
    .slice(0, 2)
    .join(' · ')
    .slice(0, 38);
}

/* ─── Morphologie (pills) ──────────────────────────────────────── */

function buildMorphologyRows(eye: EyeState): ParamRow[] {
  const rows: ParamRow[] = [];

  const addRow = (label: string, obs: string[], hint?: string) => {
    const filtered = obs.filter((o) => o && o.trim() && o !== '—');
    if (filtered.length === 0) return;
    rows.push({
      label,
      hint,
      pill: {
        variant: determinePillVariant(filtered),
        text: buildPillText(filtered),
      },
    });
  };

  addRow('Macula', eye.obsMacula, 'profil fovéolaire');
  addRow('Papille optique', eye.obsPapille);
  addRow('Vaisseaux', eye.obsVasc);
  addRow('Périphérie', eye.obsPeriph);

  if (eye.obsAnterieur.length > 0) {
    addRow('Cornée / Ant.', eye.obsAnterieur);
  }
  if (eye.obsFavoris.length > 0) {
    addRow('Divers', eye.obsFavoris);
  }
  if (eye.octaPerformed && eye.obsOCTA.length > 0) {
    addRow('OCTA', eye.obsOCTA, 'densité capillaire');
  }

  // Si aucune ligne (examen vide), insérer une ligne neutre
  if (rows.length === 0) {
    rows.push({ label: 'Données', pill: { variant: 'normal', text: 'Non documentées' } });
  }

  return rows;
}

/* ─── Biométrie (valeurs numériques) ──────────────────────────── */

function buildBiometricRows(eye: EyeState): ParamRow[] {
  const rows: ParamRow[] = [];

  if (eye.rnfl) {
    const lower = eye.rnfl.toLowerCase();
    const flag: ParamRow['flag'] =
      lower.includes('inférieur') || lower.includes('limite') ? 'alert' : undefined;
    const hint = eye.rnflLoc ? eye.rnflLoc : 'fibres péripapillaires';
    rows.push({ label: 'RNFL', hint, value: eye.rnfl, flag });
  }

  if (eye.gcl) {
    const lower = eye.gcl.toLowerCase();
    const flag: ParamRow['flag'] = lower.includes('inférieur') ? 'alert' : undefined;
    rows.push({ label: 'GCL++', hint: 'cell. ganglionnaires', value: eye.gcl, flag });
  }

  if (eye.cupDisc) {
    const cdVal = parseFloat(eye.cupDisc.replace(',', '.'));
    const flag: ParamRow['flag'] = !isNaN(cdVal)
      ? cdVal >= 0.80 ? 'critical'
      : cdVal >= 0.65 ? 'alert'
      : undefined
      : undefined;
    rows.push({ label: 'Rapport C/D', hint: 'vertical', value: eye.cupDisc, flag });
  }

  if (eye.discSurface) {
    rows.push({ label: 'Surface discale', value: `${eye.discSurface} mm²` });
  }

  if (eye.cornealThickness) {
    rows.push({ label: 'Pachymétrie', hint: 'cornée centrale', value: `${eye.cornealThickness} µm` });
  }

  if (eye.hasFollowUp && eye.rnflEvolution && eye.rnflEvolution !== 'Non évaluable') {
    const flag: ParamRow['flag'] = eye.rnflEvolution.toLowerCase().includes('diminution')
      ? 'alert'
      : undefined;
    const hint = eye.followUpDate ? `vs ${eye.followUpDate}` : 'évolution';
    rows.push({ label: 'Évolution RNFL', hint, value: eye.rnflEvolution, flag });
  }

  // Si aucune biométrie, insérer ligne neutre
  if (rows.length === 0) {
    rows.push({ label: 'Biométrie', value: '—' });
  }

  return rows;
}

/* ─── Données par œil ──────────────────────────────────────────── */

function buildEyeData(side: 'OD' | 'OG', eye: EyeState): EyeData {
  return {
    code: side,
    name: side === 'OD' ? 'Œil droit' : 'Œil gauche',
    latin: side === 'OD' ? 'dexter' : 'sinister',
    morphology: buildMorphologyRows(eye),
    biometrics: buildBiometricRows(eye),
  };
}

/* ─── Interprétation (ReactNode avec highlights) ─────────────── */

function buildInterpretation(interp: AIInterpretation): ReactNode {
  const sections: Array<string | undefined> = [
    interp.segment_anterieur,
    interp.macula_od,
    interp.macula_og,
    interp.papille_od,
    interp.papille_og,
    interp.rnfl_od,
    interp.rnfl_og,
    interp.gcl_od,
    interp.gcl_og,
    interp.peripherie,
    interp.octa,
  ];

  const filled = sections.filter((s): s is string => Boolean(s));
  if (filled.length === 0) {
    return "Données d'interprétation insuffisantes.";
  }

  return (
    <>
      {filled.map((text, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {highlightText(text)}
        </span>
      ))}
    </>
  );
}

/* ─── Conclusion ───────────────────────────────────────────────── */

const SEVERITY_LABEL: Record<string, string> = {
  normal: 'Examen dans les normes',
  surveillance: 'Surveillance recommandée',
  alerte: 'Anomalie significative détectée',
};

function buildConclusion(aiResult: AIResult): OCTReportData['conclusion'] {
  const sevLabel = SEVERITY_LABEL[aiResult.severite] ?? '';
  return {
    headline: highlightText(aiResult.conclusion),
    caveat: (
      <>
        {sevLabel ? `${sevLabel}. ` : ''}
        {aiResult.recommandations.suivi}
      </>
    ),
  };
}

/* ─── Recommandations : parse texte → items liste ─────────────── */

function splitToItems(text: string): ReactNode[] {
  if (!text || text === '—') return [];

  // Tenter de séparer par phrases (". " suivi d'une majuscule ou fin de chaîne)
  const items = text
    .split(/\.\s+(?=[A-ZÀÂÉÈÊÙÛÔÎ\d])|(?<=\.)\s*$|\n+/)
    .map((s) => s.trim().replace(/\.$/, '').trim())
    .filter((s) => s.length > 4);

  return items.length > 0 ? items : [text];
}

/* ─── Point d'entrée principal ────────────────────────────────── */

export interface ContactInfoOverride {
  name?: string;
  title?: string;
  specialty?: string;
  email?: string;
  phone?: string;
}

export function mapAIResultToOCTReportData(
  consultation: RawConsultationData,
  aiResult: AIResult,
  contactInfo?: ContactInfoOverride
): OCTReportData {
  const dateExamen = new Date().toISOString().split('T')[0];
  const formattedDate = formatDateFR(dateExamen);

  const practitioner: PractitionerData = {
    ...DEFAULT_PRACTITIONER,
    ...(contactInfo?.title     && { title:     contactInfo.title     }),
    ...(contactInfo?.specialty && { specialty: contactInfo.specialty }),
    ...(contactInfo?.email     && { email:     contactInfo.email     }),
    ...(contactInfo?.phone     && { phone:     contactInfo.phone     }),
    // name est toujours DEFAULT_PRACTITIONER.name — contactInfo.name est le patient
  };

  const motifMain = consultation.contexte.motifs[0] ?? 'Bilan ophtalmologique';
  const motifSoft =
    consultation.contexte.motifs.slice(1).join(', ') || undefined;

  const history =
    consultation.contexte.antecedents.join(', ') || 'Sans particularité';

  const prescriber =
    consultation.contexte.prescripteur || '— Non spécifié —';

  const patientAge =
    typeof consultation.patient.age === 'number'
      ? consultation.patient.age
      : parseInt(String(consultation.patient.age), 10) || 0;

  return {
    reportNumber: generateReportNumber(dateExamen),

    examTitle: 'OCT / Rétinographie',
    examSubtitle: `Examen du ${formattedDate} — Segment postérieur`,

    brand: {
      clinic: 'Clinique',
      name: 'Medivision',
      taglineParts: ['Ophtalmologie', 'Imagerie rétinienne', 'Libreville'],
    },

    patient: {
      surname: consultation.patient.nom.toUpperCase(),
      age: patientAge,
      sex: 'M', // champ non saisi — valeur par défaut
    },

    prescriber,

    indication: {
      main: motifMain,
      soft: motifSoft,
    },

    history,

    eyes: {
      od: buildEyeData('OD', consultation.oeil_droit),
      og: buildEyeData('OG', consultation.oeil_gauche),
    },

    interpretation: buildInterpretation(aiResult.interpretation),

    conclusion: buildConclusion(aiResult),

    recommendations: {
      hygiene: splitToItems(aiResult.recommandations.hygiene),
      followUp: splitToItems(aiResult.recommandations.suivi),
    },

    signature: {
      city: practitioner.city,
      dateLabel: `Fait à ${practitioner.city}, le ${formattedDate}`,
      clinicLine: practitioner.clinicLine,
      email: practitioner.email,
      phone: practitioner.phone,
      doctorTitle: practitioner.title,
      doctorName: practitioner.name,
      specialty: practitioner.specialty,
    },
  };
}
