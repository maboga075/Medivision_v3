import type { RawConsultationData, EyeState } from '../types/clinical';
import type { AIResult } from '../types/ai';
import type { OCTReportData, EyeData, ParamRow, PillVariant, PatientSummary } from '../types/report';
import { formatRNFLGCL } from './biometricFormatter';

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

// Supprime puces/tirets de début et markdown **gras** générés par certains modèles IA
function stripItem(s: string): string {
  return s.replace(/^\s*[-–—•*]\s*/, '').replace(/\*\*([^*]+)\*\*/g, '$1').trim();
}

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

/* ─── Pills : binaire — normal (vert) ou alert (rouge) ─────────── */

/* "sans particularité" → 'normal' (vert), toute anomalie → 'alert' (rouge) */
function buildPills(
  observations: string[]
): Array<{ variant: PillVariant; text: string }> {
  const anomalies = observations.filter(
    (o) => o.toLowerCase() !== 'sans particularité'
  );

  if (anomalies.length === 0) {
    return observations.map((obs) => ({
      variant: 'normal' as PillVariant,
      text: obs.slice(0, 38).trim(),
    }));
  }

  return anomalies.map((obs) => ({
    variant: 'alert' as PillVariant,
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

/* ─── Biométrie (valeurs catégoriques) ────────────────────────── */

// `showNeuro` : RNFL/GCL et leur suivi ne sont pertinents qu'en présence d'OCT.
// En rétinographie pure, ces paramètres OCT sont exclus du compte rendu.
// `excludeRnflGcl` : acquisition difficile → RNFL/GCL retirés (non interprétables).
function buildBiometricRows(eye: EyeState, showNeuro: boolean, excludeRnflGcl = false): ParamRow[] {
  const rows: ParamRow[] = [];
  const showNeuroEff = showNeuro && !excludeRnflGcl;

  // RNFL avec statut catégorique — OCT uniquement
  if (showNeuroEff && eye.rnfl) {
    const fmt = formatRNFLGCL(eye.rnfl);
    if (fmt) {
      rows.push({
        label: 'RNFL',
        hint: 'fibres nerveuses péripapillaires',
        value: fmt.text,
        customColor: fmt.color,
        isBiometricGraded: true,
      });
    }
  }

  // GCL++ avec statut catégorique — OCT uniquement
  if (showNeuroEff && eye.gcl) {
    const fmt = formatRNFLGCL(eye.gcl);
    if (fmt) {
      rows.push({
        label: 'GCL++',
        hint: 'complexe cell. ganglionnaires',
        value: fmt.text,
        customColor: fmt.color,
        isBiometricGraded: true,
      });
    }
  }

  // Surface discale et C/D affichés en boîtes de résumé dans EyeColumn
  if (eye.cornealThickness) {
    rows.push({ label: 'Pachymétrie', hint: 'cornée centrale', value: `${eye.cornealThickness} µm` });
  }

  if (showNeuroEff && eye.hasFollowUp && eye.rnflEvolution && eye.rnflEvolution !== 'Non évaluable') {
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
  acquisitionQuality?: 'bon' | 'faible' | 'impossible',
  showNeuro: boolean = true
): EyeData {
  // Calcul du flag C/D
  const cupDiscFlag = (() => {
    if (!eye.cupDisc) return undefined;
    const v = parseFloat(eye.cupDisc.replace(',', '.'));
    if (isNaN(v)) return undefined;
    if (v >= 0.80) return 'critical' as const;
    if (v >= 0.65) return 'alert' as const;
    return undefined;
  })();

  // Acquisition difficile : le praticien a pu exclure RNFL/GCL de l'interprétation.
  const excludeRnflGcl =
    eye.excludeRnflGcl === true &&
    (acquisitionQuality === 'faible' || acquisitionQuality === 'impossible');

  // Données du rendu visuel (V3) — recopiées telles quelles depuis la saisie.
  // Les anneaux RNFL/GCL et leur suivi sont des paramètres OCT : exclus en rétinographie
  // ou quand l'acquisition difficile a conduit à ne pas les interpréter.
  const showRings = showNeuro && !excludeRnflGcl;
  const visual = {
    annotations: eye.retinaAnnotations ?? [],
    // Image de rétinographie + calques (reproduits fidèlement dans le schéma CR).
    ...(eye.retinaBackground ? { retinaBackground: eye.retinaBackground } : {}),
    ...(eye.retinaLayers ? { retinaLayers: eye.retinaLayers } : {}),
    ...(showRings
      ? {
          rnflSectors: eye.rnflSectors,
          gclSectors: eye.gclSectors,
        }
      : {}),
    ...(showRings && eye.hasFollowUp
      ? {
          followUp: {
            date: eye.followUpDate || undefined,
            rnflEvolution: eye.rnflEvolution || undefined,
            gclEvolution: eye.gclEvolution || undefined,
          },
        }
      : {}),
  };

  // Acquisition impossible : sections morpho/biométrie vides, raisons transmises
  if (acquisitionQuality === 'impossible') {
    return {
      code: side,
      name: side === 'OD' ? 'Œil droit' : 'Œil gauche',
      latin: side === 'OD' ? 'dexter' : 'sinister',
      acquisitionQuality: 'impossible',
      acquisitionQualityReasons: eye.acquisitionQualityReasons ?? [],
      rnflGclExcluded: excludeRnflGcl,
      discSurface: eye.discSurface || undefined,
      cupDisc: eye.cupDisc || undefined,
      cupDiscFlag,
      morphology: [],
      biometrics: [],
      ...visual,
    };
  }

  return {
    code: side,
    name: side === 'OD' ? 'Œil droit' : 'Œil gauche',
    latin: side === 'OD' ? 'dexter' : 'sinister',
    acquisitionQuality,
    // Motifs d'acquisition affichés aussi en qualité « faible » (pas seulement impossible).
    acquisitionQualityReasons:
      acquisitionQuality === 'faible' ? eye.acquisitionQualityReasons ?? [] : undefined,
    rnflGclExcluded: excludeRnflGcl,
    discSurface: eye.discSurface || undefined,
    cupDisc: eye.cupDisc || undefined,
    cupDiscFlag,
    morphology: buildMorphologyRows(eye, anteriorSegmentDone, octaDone),
    biometrics: buildBiometricRows(eye, showNeuro, excludeRnflGcl),
    ...visual,
  };
}


/* ─── Vue patient (langage simple) ────────────────────────────── */

type EyeEtat = 'ok' | 'watch' | 'alert';

function deriveEyeEtat(eye: EyeData): EyeEtat {
  if (eye.acquisitionQuality === 'impossible') return 'watch';
  const lesions = (eye.annotations ?? []).filter((a) => a.status === 'validated').length;
  const biomCritical = eye.biometrics.some((r) => r.customColor === 'var(--crimson)');
  const morphoAnomaly = eye.morphology.some((r) => r.pills?.some((p) => p.variant !== 'normal'));
  const biomLimit = eye.biometrics.some((r) => r.customColor === 'var(--amber)');

  if (eye.cupDiscFlag === 'critical' || biomCritical || lesions >= 3) return 'alert';
  if (lesions > 0 || morphoAnomaly || biomLimit || eye.cupDiscFlag === 'alert') return 'watch';
  return 'ok';
}

const ETAT_RANK: Record<EyeEtat, number> = { ok: 0, watch: 1, alert: 2 };

/** Construit le résumé patient : champ IA si présent, sinon repli déterministe. */
function buildPatientSummary(
  aiResult: AIResult,
  od: EyeData,
  og: EyeData,
): PatientSummary {
  const ai = aiResult.resume_patient;
  const odEtat: EyeEtat = ai?.od_etat ?? deriveEyeEtat(od);
  const ogEtat: EyeEtat = ai?.og_etat ?? deriveEyeEtat(og);
  const worst = ETAT_RANK[odEtat] >= ETAT_RANK[ogEtat] ? odEtat : ogEtat;

  // Repli déterministe — formulations prudentes, sans donnée inventée.
  const fallbackTitre =
    worst === 'ok'
      ? 'Vos yeux sont en bon état'
      : worst === 'watch'
        ? 'Un point à surveiller'
        : 'Un suivi rapproché est conseillé';

  const lesionsOD = (od.annotations ?? []).filter((a) => a.status === 'validated').length;
  const lesionsOG = (og.annotations ?? []).filter((a) => a.status === 'validated').length;
  const fallbackObserve =
    lesionsOD + lesionsOG === 0
      ? "L'examen du fond de vos yeux n'a pas montré de signe particulier nécessitant une action immédiate."
      : `Nous avons repéré ${lesionsOD > 0 ? `${lesionsOD} élément${lesionsOD > 1 ? 's' : ''} sur votre œil droit` : 'aucun élément sur votre œil droit'}${
          lesionsOG > 0 ? ` et ${lesionsOG} sur votre œil gauche` : ''
        }. Votre médecin vous explique chaque point en détail.`;

  return {
    titre: ai?.titre?.trim() || fallbackTitre,
    observe: ai?.observe?.trim() || fallbackObserve,
    signification:
      ai?.signification?.trim() ||
      (worst === 'ok'
        ? 'Ces résultats sont rassurants. Une surveillance régulière reste utile pour suivre votre vue dans le temps.'
        : 'Repérés tôt, ces signes se surveillent et se prennent en charge sereinement avec votre médecin.'),
    suite:
      ai?.suite?.trim() ||
      (worst === 'ok'
        ? 'Poursuivez un suivi ophtalmologique régulier selon les recommandations de votre médecin.'
        : 'Un prochain contrôle est prévu pour suivre l’évolution. Respecter le rendez-vous protège votre vue.'),
    rassurance:
      ai?.rassurance?.trim() ||
      (aiResult.conseil_patient?.trim() ||
        'Votre médecin reste disponible pour répondre à toutes vos questions.'),
    odEtat,
    ogEtat,
  };
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
    ...(contactInfo?.name      && { name:      contactInfo.name      }),
    ...(contactInfo?.title     && { title:     contactInfo.title     }),
    ...(contactInfo?.specialty && { specialty: contactInfo.specialty }),
    ...(contactInfo?.email     && { email:     contactInfo.email     }),
    ...(contactInfo?.phone     && { phone:     contactInfo.phone     }),
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

  // RNFL/GCL sont des paramètres OCT : exclus du compte rendu en rétinographie pure.
  const isRetinography = consultation.reportType === 'Compte rendu Rétinographie';
  const showNeuro = !isRetinography;

  const odEye = buildEyeData(
    'OD',
    consultation.oeil_droit,
    consultation.anteriorSegmentDone,
    consultation.octaDone,
    consultation.acquisitionQualityOD,
    showNeuro
  );
  const ogEye = buildEyeData(
    'OG',
    consultation.oeil_gauche,
    consultation.anteriorSegmentDone,
    consultation.octaDone,
    consultation.acquisitionQualityOG,
    showNeuro
  );

  const resumePatient = buildPatientSummary(aiResult, odEye, ogEye);

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
      // Sexe saisi à l'accueil ; repli sur 'M' pour les anciens dossiers sans sexe.
      sex: consultation.patient.sexe ?? 'M',
    },

    prescriber,

    indication: {
      main: motifMain,
    },

    history,

    // Rétinographie pure → compte rendu en paysage (schémas rétiniens agrandis).
    layout: isRetinography ? 'landscape' : 'portrait',

    // A5/A6 : passer les flags d'acquisition aux builders
    eyes: { od: odEye, og: ogEye },

    resumePatient,

    analyseClinic: aiResult.analyse_clinique || "Données d'analyse insuffisantes.",
    conclusion: aiResult.conclusion || 'Résultat non exploitable — vérifier les données cliniques.',
    prevention: Array.isArray(aiResult.prevention) ? aiResult.prevention : [],
    suivi: Array.isArray(aiResult.suivi) ? aiResult.suivi : [],
    // Conseil patient = champ IA dédié (facteurs de risque, alimentation, surveillance des symptômes).
    // Repli sur le 1er item de prévention si l'IA ne renvoie pas le champ.
    // prochainControleOCT et examenComplementaire sont renseignés depuis le formulaire (Consultation).
    conseilPatient:
      aiResult.conseil_patient && aiResult.conseil_patient.trim()
        ? stripItem(aiResult.conseil_patient)
        : Array.isArray(aiResult.prevention) && aiResult.prevention.length > 0
          ? stripItem(aiResult.prevention[0])
          : undefined,
    severite: aiResult.severite ?? 'normal',

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
