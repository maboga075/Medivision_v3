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
  const [forceShowAnterior, setForceShowAnterior] = useState(false);
  const [, setForceShowPosterior] = useState(false);
  const [octaDone, setOctaDone] = useState(false);

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

  const isAnteriorBase = reportType === 'OCT du Segment Antérieur';
  const showAnterior = isAnteriorBase || forceShowAnterior;

  const reset = useCallback(() => {
    setReportType('Compte rendu OCT');
    setEyeOD(createEyeState());
    setEyeOG(createEyeState());
    setForceShowAnterior(false);
    setForceShowPosterior(false);
    setOctaDone(false);
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
  }, []);

  const applyDraft = useCallback((draft: ConsultationDraft) => {
    setReportType(draft.reportType);
    setEyeOD(draft.eyeOD);
    setEyeOG(draft.eyeOG);
    setForceShowAnterior(draft.forceShowAnterior);
    setForceShowPosterior(false);
    setOctaDone(draft.octaDone);
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
    forceShowAnterior,
    octaDone,
    hypothesesDiagnostiques,
    hypotheseLibre,
    selectedCat,
    selectedHyp,
    selectedLat,
  }), [reportType, eyeOD, eyeOG, forceShowAnterior, octaDone,
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
    setForceShowAnterior(false);
    setForceShowPosterior(false);
  }, []);

  const handleAnteriorChange = useCallback((checked: boolean) => {
    if (isAnteriorBase) setForceShowPosterior(checked);
    else setForceShowAnterior(checked);
  }, [isAnteriorBase]);

  return {
    reportType, eyeOD, eyeOG, forceShowAnterior, octaDone,
    hypothesesDiagnostiques, hypotheseLibre, selectedCat, selectedHyp, selectedLat,
    hypoError, hypoWarning,
    showBadge, badgeVariant, badgeCustomLabel, showBadgeCustom,
    nextControlDelay, customDelayText,
    isAnteriorBase, showAnterior,
    setEyeOD, setEyeOG, setOctaDone,
    setHypothesesDiagnostiques, setHypotheseLibre,
    setSelectedCat, setSelectedHyp, setSelectedLat,
    setShowBadge, setBadgeVariant, setBadgeCustomLabel, setShowBadgeCustom,
    setNextControlDelay, setCustomDelayText,
    reset, applyDraft, snapshotDraft,
    handleAddHypothese, handleRemoveHypothese,
    handleReportTypeChange, handleAnteriorChange,
  };
}
