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
  const ref = isNaN(d.getTime()) ? new Date() : d;
  const y = ref.getFullYear();
  const m = String(ref.getMonth() + 1).padStart(2, '0');
  const day = String(ref.getDate()).padStart(2, '0');
  const seq = String(Math.floor(Math.random() * 999) + 1).padStart(3, '0');
  return `MV-${y}${m}${day}-${seq}`;
}

/* ─── Label dynamique selon les flags d'examen ──────────────────── */

interface ExamFlags {
  octaDone: boolean;
  anteriorSegmentDone: boolean;
  hasOCTPostData: boolean;
  hasRetinography: boolean;
}

function getExamLabel(f: ExamFlags): string {
  if (f.octaDone && f.anteriorSegmentDone && f.hasOCTPostData) return 'OCT Segment Ant. & Post. + OCTA';
  if (f.octaDone) return 'OCT + Angiographie (OCTA)';
  if (f.anteriorSegmentDone && f.hasOCTPostData) return 'OCT Segment Ant. & Post.';
  if (f.anteriorSegmentDone) return 'OCT Segment Antérieur';
  if (f.hasRetinography) return 'Rétinographie';
  return 'OCT Segment Postérieur';
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

/* A7 — Une bulle par anomalie */
function buildPills(
  observations: string[]
): Array<{ variant: PillVariant; text: string }> {
  const anomalies = observations.filter(
    (o) => o.toLowerCase() !== 'sans particularité'
  );
  const relevant = anomalies.length > 0 ? anomalies : observations;
  return relevant.map((obs) => ({
    variant: determinePillVariant([obs]),
    text: obs.slice(0, 38).trim(),
  }));
}

/* ─── A10 — Formater valeur RNFL/GCL++ avec couleur et localisation ── */

function abbreviateLoc(loc: string): string {
  if (!loc) return '';
  const l = loc.toLowerCase();
  if (l.includes('temporal') && l.includes('sup') && l.includes('inf')) return 'Temp. sup. & inf.';
  if (l.includes('nasal') && l.includes('sup') && l.includes('inf')) return 'Nasal sup. & inf.';
  if (l.includes('temporal') && l.includes('sup')) return 'Temp. sup.';
  if (l.includes('temporal') && l.includes('inf')) return 'Temp. inf.';
  if (l.includes('temporal')) return 'Temporal';
  if (l.includes('nasal') && l.includes('sup')) return 'Nasal sup.';
  if (l.includes('nasal') && l.includes('inf')) return 'Nasal inf.';
  if (l.includes('nasal')) return 'Nasal';
  if (l.includes('ensemble') || l.includes('tous')) return 'Global';
  if (l.includes('sup')) return 'Cadran sup.';
  if (l.includes('inf')) return 'Cadran inf.';
  return loc;
}

function formatBiometricValue(value: string, loc?: string): { text: string; color: string } {
  if (!value) return { text: '—', color: 'var(--ink)' };
  const lower = value.toLowerCase();

  // "Inférieur dans l'ensemble des cadrans" — tous les quadrants touchés
  if (lower.includes("ensemble") || lower.includes("tous les cadrans")) {
    return { text: '↓ Global', color: 'var(--crimson)' };
  }

  const locAbbr = loc ? abbreviateLoc(loc) : '';
  const locSuffix = locAbbr ? ` en ${locAbbr}` : '';

  if (lower.includes('inférieur') || lower.includes('inf.')) {
    return { text: `↓${locSuffix}`, color: 'var(--crimson)' };
  }
  if (lower.includes('limite') || lower.includes('limites inf')) {
    return { text: `Limite${locSuffix}`, color: 'var(--amber)' };
  }
  if (lower.includes('supérieur')) {
    return { text: 'Élevé', color: 'var(--sage)' };
  }
  if (lower.includes('normal') || lower.includes('normes')) {
    return { text: 'Dans les normes', color: 'var(--sage)' };
  }
  // Évolution
  if (lower.includes('diminution') || lower.includes('amincissement')) {
    return { text: '↓ Amincissement', color: 'var(--crimson)' };
  }
  if (lower.includes('augmentation') || lower.includes('épaississement')) {
    return { text: '↑ Épaississement', color: 'var(--amber)' };
  }
  return { text: value, color: 'var(--ink)' };
}

/* ─── Morphologie (pills) ──────────────────────────────────────── */

function buildMorphologyRows(
  eye: EyeState,
  anteriorSegmentDone?: boolean,
  octaDone?: boolean
): ParamRow[] {
  const rows: ParamRow[] = [];

  // Sections principales : toujours affichées, "Sans particularité" si vide
  const addMainRow = (label: string, obs: string[], hint?: string) => {
    const filtered = obs.filter((o) => o && o.trim() && o !== '—');
    const toShow = filtered.length > 0 ? filtered : ['Sans particularité'];
    rows.push({ label, hint, pills: buildPills(toShow) });
  };

  // Sections conditionnelles : affichées seulement si données présentes
  const addOptRow = (label: string, obs: string[], hint?: string) => {
    const filtered = obs.filter((o) => o && o.trim() && o !== '—');
    if (filtered.length === 0) return;
    rows.push({ label, hint, pills: buildPills(filtered) });
  };

  addMainRow('Macula', eye.observationsMacula ?? []);
  addMainRow('Papille optique', eye.observationsPapille ?? []);
  addMainRow('Périphérie', eye.observationsPeripherie ?? []);

  // A5 : Cornée conditionnelle
  if (anteriorSegmentDone !== false && (eye.obsAnterieur ?? []).length > 0) {
    addOptRow('Cornée / Ant.', eye.obsAnterieur ?? []);
  }

  // Divers (texte libre)
  if (eye.observationsDivers?.trim()) {
    addOptRow('Divers', [eye.observationsDivers.trim()]);
  }

  // A6 : OCTA conditionnel
  if (octaDone !== false && eye.octaPerformed && (eye.obsOCTA ?? []).length > 0) {
    addOptRow('OCTA', eye.obsOCTA ?? [], 'densité capillaire');
  }

  return rows;
}

/* ─── Biométrie (valeurs numériques) ──────────────────────────── */

function buildBiometricRows(eye: EyeState): ParamRow[] {
  const rows: ParamRow[] = [];

  // A8 : RNFL avec localisation et couleur
  if (eye.rnfl) {
    const fmt = formatBiometricValue(eye.rnfl, eye.rnflLoc || undefined);
    rows.push({
      label: 'RNFL',
      hint: 'fibres nerveuses péripapillaires',
      value: fmt.text,
      customColor: fmt.color,
      isBiometricGraded: true,
    });
  }

  // A9 : GCL++ avec localisation et couleur
  if (eye.gcl) {
    const fmt = formatBiometricValue(eye.gcl, eye.gclLoc || undefined);
    rows.push({
      label: 'GCL++',
      hint: 'complexe cell. ganglionnaires',
      value: fmt.text,
      customColor: fmt.color,
      isBiometricGraded: true,
    });
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
    const fmt = formatBiometricValue(eye.rnflEvolution);
    const hint = eye.followUpDate ? `vs ${eye.followUpDate}` : 'évolution';
    rows.push({ label: 'Évolution RNFL', hint, value: fmt.text, customColor: fmt.color });
  }

  if (rows.length === 0) {
    rows.push({ label: 'Biométrie', value: '—' });
  }

  return rows;
}

/* ─── Données par œil ──────────────────────────────────────────── */

function buildEyeData(
  side: 'OD' | 'OG',
  eye: EyeState,
  anteriorSegmentDone?: boolean,
  octaDone?: boolean,
  acquisitionQuality?: 'bon' | 'faible' | 'impossible'
): EyeData {
  return {
    code: side,
    name: side === 'OD' ? 'Œil droit' : 'Œil gauche',
    latin: side === 'OD' ? 'dexter' : 'sinister',
    acquisitionQuality,
    morphology: buildMorphologyRows(eye, anteriorSegmentDone, octaDone),
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

/* ─── Conclusion (A11 : diagnostic pur, suivi → recommandations) ─ */

const SEVERITY_LABEL: Record<string, string> = {
  normal: 'Examen dans les normes',
  surveillance: 'Surveillance recommandée',
  alerte: 'Anomalie significative détectée',
};

function buildConclusion(aiResult: AIResult): OCTReportData['conclusion'] {
  const sevLabel = SEVERITY_LABEL[aiResult.severite] ?? '';
  return {
    headline: highlightText(aiResult.conclusion),
    caveat: sevLabel || '',  // diagnostic uniquement, suivi dans recommandations
  };
}

/* ─── Recommandations : parse texte → items liste ─────────────── */

function splitToItems(text: string): ReactNode[] {
  if (!text || text === '—') return [];

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
  contactInfo?: ContactInfoOverride,
  folderId?: string
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

  // A1 : tous les motifs en indication.main (séparés par virgule → multi-lignes dans OCTReport)
  const motifMain =
    consultation.contexte.motifs.join(', ') || 'Bilan ophtalmologique';

  const history =
    consultation.contexte.antecedents.join(', ') || 'Sans particularité';

  const prescriber =
    consultation.contexte.prescripteur || '— Non spécifié —';

  const patientAge =
    typeof consultation.patient.age === 'number'
      ? consultation.patient.age
      : parseInt(String(consultation.patient.age), 10) || 0;

  const isAnteriorOnly = consultation.reportType === 'OCT du Segment Antérieur';
  const examLabel = getExamLabel({
    octaDone: consultation.octaDone ?? false,
    anteriorSegmentDone: consultation.anteriorSegmentDone ?? false,
    hasOCTPostData: !isAnteriorOnly,
    hasRetinography: consultation.reportType === 'Compte rendu Rétinographie',
  });

  return {
    reportNumber: folderId || generateReportNumber(dateExamen),

    examTitle: 'OCT / Rétinographie',
    examSubtitle: `Examen du ${formattedDate} — ${examLabel}`,

    brand: {
      clinic: 'Clinique',
      name: 'Medivision',
      taglineParts: ['Ophtalmologie', 'Imagerie rétinienne', 'Libreville'],
    },

    patient: {
      surname: consultation.patient.nom.toUpperCase(),
      age: patientAge,
      sex: 'M',
    },

    prescriber,

    indication: {
      main: motifMain,
    },

    history,

    // A5/A6 : passer les flags d'acquisition aux builders
    eyes: {
      od: buildEyeData(
        'OD',
        consultation.oeil_droit,
        consultation.anteriorSegmentDone,
        consultation.octaDone,
        consultation.acquisitionQualityOD
      ),
      og: buildEyeData(
        'OG',
        consultation.oeil_gauche,
        consultation.anteriorSegmentDone,
        consultation.octaDone,
        consultation.acquisitionQualityOG
      ),
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
