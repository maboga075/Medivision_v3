import { useState, useCallback } from 'react';
import { createEyeState } from '../../../utils/clinicalData';
import { processHypothesisAddition } from '../../../utils/hypothesisValidation';
import { HYPOTHESES_DIAGNOSTIQUES } from '../../../utils/constants';
import type { ConsultationDraft } from '../../../hooks/useConsultationDrafts';
import type { EyeState, HypotheseDiagnostique } from '../../../types/clinical';
import type { ReportType } from '../../../utils/constants';

const INIT_CAT = Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0];
const INIT_HYP = HYPOTHESES_DIAGNOSTIQUES[INIT_CAT][0];

export function useConsultationForm() {
  const [reportType, setReportType] = useState<ReportType>('Compte rendu OCT');
  const [eyeOD, setEyeOD] = useState<EyeState>(createEyeState());
  const [eyeOG, setEyeOG] = useState<EyeState>(createEyeState());

  const [hypothesesDiagnostiques, setHypothesesDiagnostiques] = useState<HypotheseDiagnostique[]>([]);
  const [hypotheseLibre, setHypotheseLibre] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(INIT_CAT);
  const [selectedHyp, setSelectedHyp] = useState<string>(INIT_HYP);
  const [selectedLat, setSelectedLat] = useState<'OD et OG' | 'OD' | 'OG'>('OD et OG');
  const [hypoError, setHypoError] = useState('');
  const [hypoWarning, setHypoWarning] = useState('');

  const [showBadge, setShowBadge] = useState(false);
  const [badgeVariant, setBadgeVariant] = useState<'surveillance' | 'alerte'>('surveillance');
  const [badgeCustomLabel, setBadgeCustomLabel] = useState('');
  const [showBadgeCustom, setShowBadgeCustom] = useState(false);
  const [nextControlDelay, setNextControlDelay] = useState('');
  const [customDelayText, setCustomDelayText] = useState('');
  const [complementaryExam, setComplementaryExam] = useState('');

  const isAnteriorBase = reportType === 'OCT du Segment Antérieur';
  // OCTA et segment antérieur sont déduits des coupes ajoutées dans RetinaSketch
  // (coupe « octa » ⇒ OCTA ; « cornea »/« angle » ⇒ segment antérieur), au lieu
  // de cases à cocher manuelles.
  const retinaSlotKinds = [
    ...(eyeOD.retinaSlots ?? []),
    ...(eyeOG.retinaSlots ?? []),
  ].map((s) => s.kind);
  const octaDone = retinaSlotKinds.includes('octa');
  const showAnterior =
    isAnteriorBase || retinaSlotKinds.includes('cornea') || retinaSlotKinds.includes('angle');

  const reset = useCallback(() => {
    setReportType('Compte rendu OCT');
    setEyeOD(createEyeState());
    setEyeOG(createEyeState());
    setHypothesesDiagnostiques([]);
    setHypotheseLibre('');
    setSelectedCat(INIT_CAT);
    setSelectedHyp(INIT_HYP);
    setSelectedLat('OD et OG');
    setHypoError('');
    setHypoWarning('');
    setShowBadge(false);
    setBadgeVariant('surveillance');
    setBadgeCustomLabel('');
    setShowBadgeCustom(false);
    setNextControlDelay('');
    setCustomDelayText('');
    setComplementaryExam('');
  }, []);

  const applyDraft = useCallback((draft: ConsultationDraft) => {
    setReportType(draft.reportType);
    setEyeOD(draft.eyeOD);
    setEyeOG(draft.eyeOG);
    setHypothesesDiagnostiques(draft.hypothesesDiagnostiques);
    setHypotheseLibre(draft.hypotheseLibre);
    setSelectedCat(draft.selectedCat);
    setSelectedHyp(draft.selectedHyp);
    setSelectedLat(draft.selectedLat);
    setHypoError('');
    setHypoWarning('');
  }, []);

  const snapshotDraft = useCallback((): ConsultationDraft => ({
    reportType,
    eyeOD,
    eyeOG,
    hypothesesDiagnostiques,
    hypotheseLibre,
    selectedCat,
    selectedHyp,
    selectedLat,
  }), [reportType, eyeOD, eyeOG,
      hypothesesDiagnostiques, hypotheseLibre, selectedCat, selectedHyp, selectedLat]);

  const handleAddHypothese = useCallback(() => {
    setHypoError('');
    setHypoWarning('');
    const candidate: HypotheseDiagnostique = {
      categorie: selectedCat,
      libelle: selectedHyp,
      lateralite: selectedLat,
    };
    const result = processHypothesisAddition(hypothesesDiagnostiques, candidate, eyeOD, eyeOG);
    if (!result.isValid) {
      setHypoError(result.reason ?? '');
    } else {
      setHypothesesDiagnostiques(result.newHypotheses ?? hypothesesDiagnostiques);
      if (result.warning) setHypoWarning(result.warning);
    }
  }, [selectedCat, selectedHyp, selectedLat, hypothesesDiagnostiques, eyeOD, eyeOG]);

  const handleRemoveHypothese = useCallback((libelle: string, lateralite: string) => {
    setHypothesesDiagnostiques((prev) =>
      prev.filter((h) => !(h.libelle === libelle && h.lateralite === lateralite))
    );
  }, []);

  const handleReportTypeChange = useCallback((type: ReportType) => {
    setReportType(type);
  }, []);

  // ── Suivi RNFL/GCL commun aux deux yeux ──────────────────────────────────
  // Un seul interrupteur et une seule date pilotent OD et OG simultanément ;
  // les évolutions restent saisies par œil.
  const setFollowUpEnabled = useCallback((enabled: boolean) => {
    const patch = (prev: EyeState): EyeState =>
      enabled
        ? {
            ...prev,
            hasFollowUp: true,
            rnflEvolution: prev.rnflEvolution || 'Stable',
            gclEvolution: prev.gclEvolution || 'Stable',
          }
        : { ...prev, hasFollowUp: false };
    setEyeOD(patch);
    setEyeOG(patch);
  }, []);

  const setFollowUpDate = useCallback((date: string) => {
    setEyeOD((prev) => ({ ...prev, followUpDate: date }));
    setEyeOG((prev) => ({ ...prev, followUpDate: date }));
  }, []);

  return {
    reportType, eyeOD, eyeOG, octaDone,
    hypothesesDiagnostiques, hypotheseLibre, selectedCat, selectedHyp, selectedLat,
    hypoError, hypoWarning,
    showBadge, badgeVariant, badgeCustomLabel, showBadgeCustom,
    nextControlDelay, customDelayText, complementaryExam,
    isAnteriorBase, showAnterior,
    setEyeOD, setEyeOG,
    setHypothesesDiagnostiques, setHypotheseLibre,
    setSelectedCat, setSelectedHyp, setSelectedLat,
    setShowBadge, setBadgeVariant, setBadgeCustomLabel, setShowBadgeCustom,
    setNextControlDelay, setCustomDelayText, setComplementaryExam,
    setFollowUpEnabled, setFollowUpDate,
    reset, applyDraft, snapshotDraft,
    handleAddHypothese, handleRemoveHypothese,
    handleReportTypeChange,
  };
}
