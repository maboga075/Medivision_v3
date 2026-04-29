import { useState, useEffect, useRef } from 'react';
import {
  Users,
  Clock,
  Stethoscope,
  Activity,
  UserPlus,
  FileDown,
  MessageCircle,
  Mail,
  RotateCcw,
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  Plus,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, where } from '../services/firebase';
import PatientEditModal from '../components/modals/PatientEditModal';
import { sendViaWhatsApp, sendViaEmail } from '../services/communication';
import { callNativeAI } from '../services/aiManager';
import EyeExamSection from '../components/forms/EyeExamSection';
import { createEyeState } from '../utils/clinicalData';
import { useConsultationDrafts, type ConsultationDraft } from '../hooks/useConsultationDrafts';
import { archiveAllWaitingPatients } from '../services/waitingRoomService';
import { normalizeClinicalData } from '../utils/clinicalPayload';
import { processHypothesisAddition } from '../utils/hypothesisValidation';
import { HYPOTHESES_DIAGNOSTIQUES, REPORT_TYPES } from '../utils/constants';
import { buildClinicalSummary } from '../utils/clinicalSummary';
import { buildAIPayload } from '../utils/aiPayload';
import OCTReport, { type OCTReportData } from '../components/reports/OCTReport';
import ValidationBadge from '../components/shared/ValidationBadge';
import { mapAIResultToOCTReportData, DEFAULT_PRACTITIONER } from '../utils/reportDataMapper';
import { printReport } from '../services/printService';
import { exportReportToPDF } from '../services/pdfExportService';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_SUGGESTIONS } from '../constants/defaultSuggestions';

import type { PatientFirestore } from '../types/patient';
import type { EyeState, HypotheseDiagnostique, RawConsultationData } from '../types/clinical';
import type { ValidationResult } from '../types/ai';
import type { ReportType } from '../utils/constants';

type ConsultationView = 'form' | 'report';

export default function Consultation() {
  const { settings, updateBulles } = useSettings();
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');

  // Pré-sélectionner le médecin par défaut dès que les settings sont chargés
  useEffect(() => {
    if (settings?.medecinPrescripteurParDefaut && !selectedDoctorId) {
      setSelectedDoctorId(settings.medecinPrescripteurParDefaut);
    }
  }, [settings, selectedDoctorId]);

  const [patients, setPatients] = useState<PatientFirestore[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientFirestore | null>(null);
  const [view, setView] = useState<ConsultationView>('form');
  const [reportType, setReportType] = useState<ReportType>('Compte rendu OCT');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [eyeOD, setEyeOD] = useState<EyeState>(createEyeState());
  const [eyeOG, setEyeOG] = useState<EyeState>(createEyeState());
  const [forceShowAnterior, setForceShowAnterior] = useState(false);
  const [, setForceShowPosterior] = useState(false);
  const [octaDone, setOctaDone] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jsonValidation, setJsonValidation] = useState<ValidationResult | null>(null);
  const [octReportData, setOctReportData] = useState<OCTReportData | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const { loadAllDrafts, saveDraft, getDraft, deleteDraft, clearAllDrafts } = useConsultationDrafts();

  // Charger les brouillons session au montage
  useEffect(() => { loadAllDrafts(); }, [loadAllDrafts]);

  const [showNewDayModal, setShowNewDayModal] = useState(false);
  const [isPurgingDay, setIsPurgingDay] = useState(false);
  const [purgeToast, setPurgeToast] = useState('');

  const [hypothesesDiagnostiques, setHypothesesDiagnostiques] = useState<HypotheseDiagnostique[]>([]);
  const [hypotheseLibre, setHypotheseLibre] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]);
  const [selectedHyp, setSelectedHyp] = useState<string>(
    HYPOTHESES_DIAGNOSTIQUES[Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]][0]
  );
  const [selectedLat, setSelectedLat] = useState<'OD et OG' | 'OD' | 'OG'>('OD et OG');
  const [hypoError, setHypoError] = useState('');
  const [hypoWarning, setHypoWarning] = useState('');

  // Paramètres compte rendu — badge + délai
  const [showBadge, setShowBadge] = useState(false);
  const [badgeVariant, setBadgeVariant] = useState<'surveillance' | 'alerte'>('surveillance');
  const [badgeCustomLabel, setBadgeCustomLabel] = useState('');
  const [showBadgeCustom, setShowBadgeCustom] = useState(false);
  const [nextControlDelay, setNextControlDelay] = useState('');
  const [customDelayText, setCustomDelayText] = useState('');

  const handleAddHypothese = () => {
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
  };

  const handleRemoveHypothese = (libelle: string, lateralite: string) => {
    setHypothesesDiagnostiques(
      hypothesesDiagnostiques.filter((h) => !(h.libelle === libelle && h.lateralite === lateralite))
    );
  };

  useEffect(() => {
    const q = query(
      collection(db, 'patients'),
      where('statut', '==', 'en_attente'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const livePatients: PatientFirestore[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<PatientFirestore, 'id' | 'date'>),
        date: docSnap.data().createdAt ? docSnap.data().createdAt.toDate() : new Date(),
      }));
      setPatients(livePatients);
    });

    return () => unsubscribe();
  }, []);

  const resetExam = () => {
    setView('form');
    setReportType('Compte rendu OCT');
    setEyeOD(createEyeState());
    setEyeOG(createEyeState());
    setForceShowAnterior(false);
    setForceShowPosterior(false);
    setOctaDone(false);
    setOctReportData(null);
    setJsonValidation(null);
    setHypothesesDiagnostiques([]);
    setHypotheseLibre('');
    setSelectedCat(Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]);
    setSelectedHyp(HYPOTHESES_DIAGNOSTIQUES[Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]][0]);
    setSelectedLat('OD et OG');
    setHypoError('');
    setHypoWarning('');
  };

  const applyDraft = (draft: ConsultationDraft) => {
    setView('form');
    setReportType(draft.reportType);
    setEyeOD(draft.eyeOD);
    setEyeOG(draft.eyeOG);
    setForceShowAnterior(draft.forceShowAnterior);
    setForceShowPosterior(false);
    setOctaDone(draft.octaDone);
    setOctReportData(null);
    setJsonValidation(null);
    setHypothesesDiagnostiques(draft.hypothesesDiagnostiques);
    setHypotheseLibre(draft.hypotheseLibre);
    setSelectedCat(draft.selectedCat);
    setSelectedHyp(draft.selectedHyp);
    setSelectedLat(draft.selectedLat);
    setHypoError('');
    setHypoWarning('');
  };

  const handlePatientSelect = (p: PatientFirestore) => {
    // Sauvegarder le brouillon du patient courant avant de changer
    if (selectedPatient) {
      saveDraft(selectedPatient.id, {
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
      });
    }
    setSelectedPatient(p);
    const draft = getDraft(p.id);
    if (draft) {
      applyDraft(draft);
    } else {
      resetExam();
    }
  };

  const handlePrint = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    printReport(reportRef.current, {
      title: buildFilename('pdf').replace(/\.pdf$/, ''),
      paperSize: 'A4',
      orientation: 'portrait',
      margins: { top: 10, right: 10, bottom: 10, left: 10 },
    });
  };

  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (!exportMenuRef.current?.contains(e.target as Node)) setExportMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [exportMenuOpen]);

  const buildFilename = (ext: string) => {
    const sanitize = (s: string) => s.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_\-]/g, '');
    const dossier = sanitize(selectedPatient?.folderId ?? '');
    const nom = sanitize(selectedPatient?.nom ?? 'Patient');
    const date = selectedPatient?.dateExamen ?? new Date().toISOString().split('T')[0];
    const parts = [dossier, nom, date].filter(Boolean);
    return parts.join('_') + '.' + ext;
  };

  const handleExportPDF = async () => {
    setExportMenuOpen(false);
    if (!octReportData) return;
    try {
      await exportReportToPDF(reportRef.current, octReportData, {
        filename: buildFilename('pdf'),
      });
    } catch (err) {
      console.error('[handleExportPDF]', err);
    }
  };

  const handleExportWord = () => {
    setExportMenuOpen(false);
    if (!reportRef.current) return;
    const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
      .map((n) => n.outerHTML).join('\n');
    const html = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'>${styles}</head><body>${reportRef.current.innerHTML}</body></html>`;
    const blob = new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('doc');
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportJSON = () => {
    setExportMenuOpen(false);
    if (!octReportData) return;
    const blob = new Blob([JSON.stringify(octReportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = buildFilename('json').replace(/\.json$/, '') + '_data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleWhatsApp = () => {
    if (selectedPatient?.tel) {
      sendViaWhatsApp(selectedPatient.tel, '#');
    }
  };

  const handleEmail = () => {
    if (selectedPatient?.email) {
      sendViaEmail(selectedPatient.email, '#');
    }
  };

  const handleNewDay = async () => {
    setIsPurgingDay(true);
    try {
      const result = await archiveAllWaitingPatients();
      clearAllDrafts();
      setSelectedPatient(null);
      setShowNewDayModal(false);
      const n = result.archived;
      setPurgeToast(`${n} patient${n > 1 ? 's' : ''} archivé${n > 1 ? 's' : ''} — nouvelle journée démarrée`);
      setTimeout(() => setPurgeToast(''), 4000);
    } catch (err) {
      console.error('[Consultation] Erreur nouvelle journée:', err);
      setShowNewDayModal(false);
      alert('Erreur lors de l\'archivage des patients.');
    } finally {
      setIsPurgingDay(false);
    }
  };

  // Auto-save — se déclenche à chaque modification du formulaire
  useEffect(() => {
    if (!selectedPatient) return;
    saveDraft(selectedPatient.id, {
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
    });
  }, [
    selectedPatient,
    reportType, eyeOD, eyeOG, forceShowAnterior, octaDone,
    hypothesesDiagnostiques, hypotheseLibre, selectedCat, selectedHyp, selectedLat,
    saveDraft,
  ]);

  const isAnteriorBase = reportType === 'OCT du Segment Antérieur';
  const showAnterior = isAnteriorBase || forceShowAnterior;

  const soumettreIA = async () => {
    if (!selectedPatient) return;

    setIsAnalyzing(true);

    try {
      // Étape 1 — Construction du JSON brut d'entrée
      console.info('[IA] Étape 1 — Construction rawInputJson');
      const rawInputJson: RawConsultationData = {
        patient: {
          nom: selectedPatient.nom,
          age: selectedPatient.age,
          date_naissance: selectedPatient.dateNaissance ?? null,
        },
        contexte: {
          prescripteur: selectedPatient.medecinPrescripteur ?? '',
          motifs: selectedPatient.motifs,
          antecedents: selectedPatient.antecedents,
          hypotheses_diagnostiques: hypothesesDiagnostiques,
          hypothese_libre: hypotheseLibre,
        },
        oeil_droit: eyeOD,
        oeil_gauche: eyeOG,
        reportType,
        anteriorSegmentDone: showAnterior,
        octaDone: octaDone,
        acquisitionQualityOD: eyeOD.acquisitionQuality ?? 'bon',
        acquisitionQualityOG: eyeOG.acquisitionQuality ?? 'bon',
      };
      console.info('[IA] rawInputJson:', rawInputJson);

      // Étape 2 — Normalisation clinique
      console.info('[IA] Étape 2 — Normalisation clinique');
      const normalizedJson = normalizeClinicalData(rawInputJson);
      if (!normalizedJson) throw new Error('La normalisation clinique a échoué.');
      console.info('[IA] normalizedJson:', normalizedJson);

      // Étape 3 — Résumé clinique
      console.info('[IA] Étape 3 — Résumé clinique');
      const clinicalSummary = buildClinicalSummary(normalizedJson);
      if (!clinicalSummary) throw new Error('La construction du résumé clinique a échoué.');
      console.info('[IA] clinicalSummary:', clinicalSummary);

      // Étape 4 — Payload IA
      console.info('[IA] Étape 4 — Construction du payload IA');
      const aiPayload = buildAIPayload(normalizedJson, clinicalSummary, reportType);
      if (!aiPayload || Object.keys(aiPayload).length === 0) {
        throw new Error('Données cliniques insuffisantes pour construire le payload IA.');
      }
      console.info('[IA] aiPayload:', aiPayload);

      // Étape 5 — Appel moteur IA
      console.info('[IA] Étape 5 — Appel moteur IA');
      const { result, validation } = await callNativeAI(aiPayload);
      if (!result) throw new Error('Le moteur IA n\'a retourné aucun résultat.');
      console.info('[IA] result:', result);

      // Étape 6 — Mapping vers OCTReportData
      console.info('[IA] Étape 6 — Mapping vers OCTReportData');
      const selectedDoctor = settings?.doctors.find((d) => d.id === selectedDoctorId);
      const mapped = mapAIResultToOCTReportData(
        rawInputJson,
        result,
        {
          name: selectedDoctor
            ? `${selectedDoctor.prenom} ${selectedDoctor.nom}`.toUpperCase()
            : undefined,
          title: DEFAULT_PRACTITIONER.title,
          specialty: selectedDoctor?.specialite || DEFAULT_PRACTITIONER.specialty,
          email: DEFAULT_PRACTITIONER.email,
          phone: DEFAULT_PRACTITIONER.phone,
        },
        selectedPatient.folderId
      );

      // Injecter le badge de sévérité si activé
      if (showBadge) {
        const label = showBadgeCustom && badgeCustomLabel.trim()
          ? badgeCustomLabel.trim()
          : badgeVariant === 'surveillance' ? 'Surveillance recommandée' : 'Urgence thérapeutique';
        mapped.badge = { label, variant: badgeVariant };
      }

      // Injecter le délai de contrôle comme premier item de suivi
      const resolvedDelay = nextControlDelay === '__custom__' ? customDelayText.trim() : nextControlDelay;
      if (resolvedDelay) {
        mapped.suivi = [`Contrôle OCT : ${resolvedDelay}`, ...mapped.suivi];
      }

      setJsonValidation(validation);
      setOctReportData(mapped);
      // Supprimer le brouillon une fois le rapport généré
      if (selectedPatient) deleteDraft(selectedPatient.id);
      setView('report');
      window.scrollTo(0, 0);
    } catch (e) {
      console.error('[IA] Erreur pipeline:', e);
      alert(e instanceof Error ? e.message : 'Erreur réseau pendant la génération IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <>
      <div className="flex h-full bg-slate-50 overflow-hidden">
        {/* File d'attente */}
        <aside className="w-full sm:w-80 md:w-96 lg:w-[400px] bg-white border-r border-slate-200 h-full flex flex-col z-10 shrink-0">
          <div className="p-6 border-b border-slate-200 bg-white flex items-center justify-between sticky top-0">
            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-3">
              <Users className="w-6 h-6 text-teal-600" /> Salle d'attente
            </h2>
            <div className="flex items-center gap-2">
              {patients.length > 0 && (
                <button
                  onClick={() => setShowNewDayModal(true)}
                  title="Nouvelle journée — archiver tous les patients"
                  className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <span className="bg-teal-100 text-teal-800 text-sm font-bold px-3 py-1 rounded-full">
                {patients.length}
              </span>
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-4 space-y-4 bg-slate-50/50">
            {patients.length === 0 ? (
              <div className="text-center py-12 flex flex-col items-center justify-center">
                <UserPlus className="w-12 h-12 text-slate-300 mb-4" />
                <div className="text-slate-500 font-medium">Aucun patient en attente.</div>
              </div>
            ) : (
              patients.map((p) => (
                <div
                  key={p.id}
                  onClick={() => !isAnalyzing && handlePatientSelect(p)}
                  className={`p-5 rounded-2xl border-2 transition-all select-none ${
                    isAnalyzing
                      ? 'opacity-50 cursor-not-allowed'
                      : 'cursor-pointer active:scale-95'
                  } ${
                    selectedPatient?.id === p.id
                      ? 'bg-teal-50 border-teal-500 shadow-sm'
                      : 'bg-white border-transparent shadow-sm hover:border-teal-200 hover:shadow'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-extrabold text-slate-800 text-lg sm:text-xl">{p.nom}</h3>
                    <span className="text-sm font-bold text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                      <Clock className="w-4 h-4" />{' '}
                      {p.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className="text-sm font-medium text-slate-500 mb-3">
                    {p.age} ans {p.folderId && `• Dossier : ${p.folderId}`}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.motifs?.slice(0, 2).map((m) => (
                      <span
                        key={m}
                        className="px-3 py-1.5 bg-orange-50/80 text-orange-700 text-xs font-bold rounded-lg"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>

        {/* Zone de travail */}
        <main className="flex-1 relative overflow-y-auto hidden sm:block bg-slate-100">
          {isAnalyzing && (
            <div className="absolute inset-0 z-50 bg-slate-100/80 backdrop-blur-md flex flex-col items-center justify-center">
              <div className="bg-white p-8 rounded-3xl shadow-2xl flex flex-col items-center border border-teal-100">
                <RefreshCw className="w-16 h-16 text-teal-500 animate-spin mb-6" />
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  Analyse clinique en cours...
                </h3>
                <p className="text-slate-500 font-medium mt-2">
                  Le moteur IA rédige votre compte-rendu.
                </p>
              </div>
            </div>
          )}

          {!selectedPatient ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-6">
              <div className="w-32 h-32 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center">
                <Activity className="w-16 h-16 text-teal-300" />
              </div>
              <p className="text-2xl font-bold text-slate-400">
                Sélectionnez un patient pour démarrer l'examen
              </p>
            </div>
          ) : (
            <div className="p-6 lg:p-8 max-w-7xl mx-auto pb-32 w-full animate-in fade-in">
              {/* Header sticky */}
              <div
                className={`flex justify-between items-center mb-6 sticky top-0 z-20 transition-all py-4 -mx-6 px-6 lg:-mx-8 lg:px-8 border-b no-print ${
                  view === 'report'
                    ? 'bg-white shadow-sm border-slate-200'
                    : 'bg-slate-100/90 backdrop-blur-md border-slate-200/50'
                }`}
              >
                {view === 'report' ? (
                  <button
                    onClick={() => setView('form')}
                    className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl flex items-center gap-2 transition-all active:scale-95 border-2 border-transparent"
                  >
                    <ChevronLeft className="w-5 h-5" /> Retoucher la saisie
                  </button>
                ) : (
                  <div className="text-lg font-black text-slate-800 flex items-center gap-2">
                    {selectedPatient.nom}{' '}
                    {selectedPatient.folderId && (
                      <span className="px-2 py-1 rounded bg-slate-200 text-xs text-slate-500">
                        {selectedPatient.folderId}
                      </span>
                    )}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setIsEditModalOpen(true)}
                    className="px-5 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Pencil className="w-5 h-5" /> Modifier le dossier
                  </button>

                  <button
                    onClick={handlePrint}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <FileDown className="w-5 h-5" /> Imprimer PDF
                  </button>

                  {/* Dropdown Export */}
                  <div className="relative" ref={exportMenuRef}>
                    <button
                      onClick={() => setExportMenuOpen((o) => !o)}
                      className={`px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 border-2 ${
                        exportMenuOpen
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'bg-white border-slate-200 hover:border-amber-300 text-slate-700'
                      }`}
                    >
                      <Download className="w-5 h-5" /> Export
                      <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${exportMenuOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {exportMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                        <button
                          onClick={handleExportPDF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <FileDown className="w-4 h-4 text-red-500" /> PDF
                        </button>
                        <button
                          onClick={handleExportWord}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                        >
                          <FileDown className="w-4 h-4 text-blue-500" /> Word (.doc)
                        </button>
                        <button
                          onClick={handleExportJSON}
                          disabled={!octReportData}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100 disabled:opacity-40"
                        >
                          <Download className="w-4 h-4 text-teal-500" /> JSON
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleWhatsApp}
                    disabled={!selectedPatient.tel}
                    className={`px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all ${
                      selectedPatient.tel
                        ? 'bg-green-500 hover:bg-green-600 text-white active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <MessageCircle className="w-5 h-5" /> WhatsApp
                  </button>

                  <button
                    onClick={handleEmail}
                    disabled={!selectedPatient.email}
                    className={`px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all ${
                      selectedPatient.email
                        ? 'bg-blue-500 hover:bg-blue-600 text-white active:scale-95'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                  >
                    <Mail className="w-5 h-5" /> Email
                  </button>

                  <button
                    onClick={() => setSelectedPatient(null)}
                    className="px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 ml-6 active:scale-95"
                  >
                    <RotateCcw className="w-5 h-5" /> Passer
                  </button>
                </div>
              </div>

              {/* Vue formulaire */}
              {view === 'form' && (
                <>
                  <header className="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-200 mb-6 flex flex-col xl:flex-row gap-6 justify-between items-start xl:items-center">
                    <div className="shrink-0 min-w-[250px]">
                      <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-800 mb-2">
                        {selectedPatient.nom}
                      </h1>
                      <div className="text-slate-500 font-bold text-lg flex flex-wrap gap-3 items-center">
                        <span>{selectedPatient.age} ans</span>
                        {selectedPatient.folderId && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            <span className="text-slate-600 font-mono">
                              {selectedPatient.folderId}
                            </span>
                          </>
                        )}
                        {selectedPatient.tel && (
                          <>
                            <span className="w-2 h-2 rounded-full bg-slate-300" />
                            <span>📞 {selectedPatient.tel}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div
                      className={`grid grid-cols-1 ${
                        selectedPatient.medecinPrescripteur ? 'md:grid-cols-3' : 'md:grid-cols-2'
                      } gap-4 flex-1 min-w-0`}
                    >
                      {selectedPatient.medecinPrescripteur && (
                        <div className="h-full bg-slate-50 rounded-xl p-4 overflow-hidden flex flex-col border border-slate-200">
                          <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                            Médecin Prescripteur
                          </div>
                          <div className="text-sm font-extrabold text-slate-800 leading-snug break-words">
                            {selectedPatient.medecinPrescripteur}
                          </div>
                        </div>
                      )}
                      <div className="h-full bg-orange-50 rounded-xl p-4 overflow-hidden flex flex-col border border-orange-200">
                        <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-1.5">
                          Motifs
                        </div>
                        <div className="text-sm font-extrabold text-orange-950 leading-snug break-words">
                          {selectedPatient.motifs?.join(', ')}
                        </div>
                      </div>
                      <div className="h-full bg-indigo-50 rounded-xl p-4 overflow-hidden flex flex-col border border-indigo-200">
                        <div className="text-xs font-bold text-indigo-600 uppercase tracking-wider mb-1.5">
                          Antécédents
                        </div>
                        <div className="text-sm font-extrabold text-indigo-950 leading-snug break-words">
                          {selectedPatient.antecedents?.join(', ')}
                        </div>
                      </div>
                    </div>
                  </header>

                  {/* Sélecteur de type d'examen + options */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col gap-4">
                    <div className="flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between">
                      <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                        <label className="text-sm font-black uppercase text-slate-500 tracking-wider">
                          Type d'examen
                        </label>
                        <select
                          className="p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none bg-slate-50 w-full sm:w-64"
                          value={reportType}
                          onChange={(e) => {
                            setReportType(e.target.value as ReportType);
                            setForceShowAnterior(false);
                            setForceShowPosterior(false);
                          }}
                        >
                          {REPORT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sélecteur médecin examinateur */}
                      {settings?.doctors && settings.doctors.length > 0 && (
                        <div className="flex flex-wrap items-center gap-4 w-full md:w-auto">
                          <label className="text-sm font-black uppercase text-slate-500 tracking-wider">
                            Médecin examinateur
                          </label>
                          <select
                            className="p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none bg-slate-50 w-full sm:w-64"
                            value={selectedDoctorId}
                            onChange={(e) => setSelectedDoctorId(e.target.value)}
                          >
                            <option value="">— Sélectionner —</option>
                            {settings.doctors.map((d) => (
                              <option key={d.id} value={d.id}>
                                Dr. {d.prenom} {d.nom}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Checkboxes options d'acquisition */}
                    <div className="flex flex-wrap gap-6 pt-3 border-t border-slate-100">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showAnterior}
                          onChange={(e) => {
                            if (isAnteriorBase) setForceShowPosterior(e.target.checked);
                            else setForceShowAnterior(e.target.checked);
                          }}
                          className="w-5 h-5 rounded border-2 border-slate-300 accent-teal-600 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700 text-sm">
                          OCT segment antérieur réalisé
                        </span>
                      </label>
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={octaDone}
                          onChange={(e) => setOctaDone(e.target.checked)}
                          className="w-5 h-5 rounded border-2 border-slate-300 accent-teal-600 cursor-pointer"
                        />
                        <span className="font-medium text-slate-700 text-sm">
                          OCTA réalisé
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Formulaires oculaires — bubble-picker */}
                  <div className="flex flex-col lg:flex-row gap-6 mb-6">
                    <EyeExamSection
                      side="OD"
                      eye={eyeOD}
                      onUpdate={setEyeOD}
                      isOCT={reportType.includes('OCT')}
                      showOpticNerve={reportType === 'Compte rendu Rétinographie'}
                      showAnterior={showAnterior}
                      octaDone={octaDone}
                      onNewSuggestion={(category, item) => {
                        const stored = settings?.formulario?.[category];
                        const effective = stored ?? DEFAULT_SUGGESTIONS[category] ?? [];
                        if (!effective.includes(item)) updateBulles(category, [...effective, item]);
                      }}
                    />
                    <EyeExamSection
                      side="OG"
                      eye={eyeOG}
                      onUpdate={setEyeOG}
                      isOCT={reportType.includes('OCT')}
                      showOpticNerve={reportType === 'Compte rendu Rétinographie'}
                      showAnterior={showAnterior}
                      octaDone={octaDone}
                      onNewSuggestion={(category, item) => {
                        const stored = settings?.formulario?.[category];
                        const effective = stored ?? DEFAULT_SUGGESTIONS[category] ?? [];
                        if (!effective.includes(item)) updateBulles(category, [...effective, item]);
                      }}
                    />
                  </div>

                  {/* Hypothèses diagnostiques */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-10 w-full">
                    <div className="flex items-center gap-2 mb-4">
                      <Stethoscope className="w-5 h-5 text-teal-600" />
                      <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
                        Hypothèse(s) diagnostique(s) du praticien
                      </h3>
                    </div>

                    <div className="flex flex-row flex-wrap items-end gap-3 mb-4">
                      <div className="w-full md:w-auto md:flex-[1.2] min-w-[150px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Catégorie
                        </label>
                        <select
                          value={selectedCat}
                          onChange={(e) => {
                            setSelectedCat(e.target.value);
                            setSelectedHyp(HYPOTHESES_DIAGNOSTIQUES[e.target.value][0]);
                          }}
                          className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors"
                        >
                          {Object.keys(HYPOTHESES_DIAGNOSTIQUES).map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-auto md:flex-[0.7] min-w-[100px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Latéralité
                        </label>
                        <select
                          value={selectedLat}
                          onChange={(e) =>
                            setSelectedLat(e.target.value as 'OD et OG' | 'OD' | 'OG')
                          }
                          className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors"
                        >
                          <option value="OD et OG">OD et OG</option>
                          <option value="OD">OD</option>
                          <option value="OG">OG</option>
                        </select>
                      </div>

                      <div className="w-full md:w-auto md:flex-[2.5] min-w-[200px]">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                          Hypothèse clinique
                        </label>
                        <select
                          value={selectedHyp}
                          onChange={(e) => setSelectedHyp(e.target.value)}
                          className="w-full p-2.5 lg:p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-slate-50 text-slate-700 outline-none focus:border-teal-400 focus:bg-white transition-colors truncate"
                        >
                          {HYPOTHESES_DIAGNOSTIQUES[selectedCat].map((hyp) => (
                            <option key={hyp} value={hyp}>
                              {hyp}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="w-full md:w-auto shrink-0">
                        <button
                          onClick={handleAddHypothese}
                          className="w-full md:w-auto px-5 py-2.5 lg:py-3 bg-teal-50 text-teal-700 font-bold rounded-xl hover:bg-teal-100 transition-colors border border-teal-200 flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Plus className="w-4 h-4" /> Ajouter
                        </button>
                      </div>
                    </div>

                    {hypoError && (
                      <div className="mb-4 text-sm font-bold text-red-500 bg-red-50 py-2.5 px-4 rounded-xl border border-red-100 flex items-center gap-2">
                        <span className="text-lg">⚠️</span> {hypoError}
                      </div>
                    )}

                    {hypoWarning && (
                      <div className="mb-4 text-sm font-bold text-amber-600 bg-amber-50 py-2.5 px-4 rounded-xl border border-amber-200 flex items-center gap-2">
                        <span className="text-lg">ℹ️</span> {hypoWarning}
                      </div>
                    )}

                    {hypothesesDiagnostiques.length > 0 && (
                      <div className="flex flex-wrap gap-2 mb-4 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                        {hypothesesDiagnostiques.map((h, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-2 px-3 py-1.5 bg-teal-600 text-white text-sm font-bold rounded-lg shadow-sm"
                          >
                            {h.libelle}, {h.lateralite}
                            <button
                              onClick={() => handleRemoveHypothese(h.libelle, h.lateralite)}
                              className="hover:bg-teal-700 bg-teal-500/50 p-1 rounded-full transition-colors active:scale-90"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Hypothèse libre / note clinique
                      </label>
                      <textarea
                        value={hypotheseLibre}
                        onChange={(e) => setHypotheseLibre(e.target.value)}
                        placeholder="Saisissez une nuance, réserve ou commentaire clinique additionnel..."
                        className="w-full p-4 border-2 border-slate-200 rounded-2xl text-sm font-medium bg-slate-50 outline-none focus:border-teal-400 focus:bg-white transition-colors min-h-[80px]"
                      />
                    </div>
                  </div>

                  {/* ── Paramètres du compte rendu ── */}
                  <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-10 w-full">
                    <div className="flex items-center gap-2 mb-5">
                      <AlertTriangle className="w-5 h-5 text-slate-400" />
                      <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">Paramètres du compte rendu</h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                      {/* Badge de sévérité */}
                      <div className="space-y-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Badge de sévérité</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => { setShowBadge(false); setShowBadgeCustom(false); }}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${!showBadge ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                          >Non</button>
                          <button
                            onClick={() => setShowBadge(true)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${showBadge ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
                          >Oui</button>
                        </div>

                        {showBadge && (
                          <div className="space-y-2 animate-in slide-in-from-top-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            {/* Surveillance */}
                            <button
                              onClick={() => { setBadgeVariant('surveillance'); setShowBadgeCustom(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${badgeVariant === 'surveillance' && !showBadgeCustom ? 'border-orange-300 bg-orange-50' : 'border-transparent bg-white hover:bg-slate-50'}`}
                            >
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 uppercase tracking-wider whitespace-nowrap">Surveillance recommandée</span>
                            </button>
                            {/* Urgence */}
                            <button
                              onClick={() => { setBadgeVariant('alerte'); setShowBadgeCustom(false); }}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${badgeVariant === 'alerte' && !showBadgeCustom ? 'border-red-300 bg-red-50' : 'border-transparent bg-white hover:bg-slate-50'}`}
                            >
                              <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 uppercase tracking-wider whitespace-nowrap">Urgence thérapeutique</span>
                            </button>
                            {/* Personnalisé */}
                            {showBadgeCustom ? (
                              <div className="flex gap-2 items-center">
                                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${badgeVariant === 'alerte' ? 'bg-red-400' : 'bg-orange-400'}`} />
                                <input
                                  autoFocus
                                  value={badgeCustomLabel}
                                  onChange={(e) => setBadgeCustomLabel(e.target.value)}
                                  placeholder="Libellé personnalisé…"
                                  className="flex-1 p-2 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-400 bg-white"
                                />
                                <div className="flex gap-1">
                                  <button onClick={() => setBadgeVariant('surveillance')} className={`w-5 h-5 rounded-full bg-orange-300 border-2 transition-colors ${badgeVariant === 'surveillance' ? 'border-orange-600' : 'border-transparent'}`} title="Orange" />
                                  <button onClick={() => setBadgeVariant('alerte')} className={`w-5 h-5 rounded-full bg-red-400 border-2 transition-colors ${badgeVariant === 'alerte' ? 'border-red-700' : 'border-transparent'}`} title="Rouge" />
                                </div>
                                <button onClick={() => setShowBadgeCustom(false)} className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setShowBadgeCustom(true)}
                                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:bg-white text-sm font-bold transition-all"
                              >
                                <Plus className="w-3.5 h-3.5" /> Indication personnalisée
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Délai prochain contrôle OCT */}
                      <div className="space-y-3">
                        <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Délai prochain contrôle OCT</p>
                        <select
                          value={nextControlDelay}
                          onChange={(e) => { setNextControlDelay(e.target.value); setCustomDelayText(''); }}
                          className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white outline-none focus:border-teal-400 transition-colors"
                        >
                          <option value="">— Aucun délai précisé —</option>
                          <option value="dans 1 an">Dans 1 an</option>
                          <option value="dans 6 mois">Dans 6 mois</option>
                          <option value="dans 3 mois">Dans 3 mois</option>
                          <option value="dans 1 à 2 mois">Dans 1 à 2 mois</option>
                          <option value="dans 1 mois">Dans 1 mois</option>
                          <option value="suivi clinique simple">Suivi clinique simple</option>
                          <option value="__custom__">Personnalisé…</option>
                        </select>
                        {nextControlDelay === '__custom__' && (
                          <input
                            autoFocus
                            value={customDelayText}
                            onChange={(e) => setCustomDelayText(e.target.value)}
                            placeholder="Ex : dans 3 semaines…"
                            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-400 bg-white animate-in slide-in-from-top-2"
                          />
                        )}
                        {nextControlDelay && nextControlDelay !== '__custom__' && (
                          <p className="text-xs text-slate-400 font-medium">
                            → Ajouté en premier item de <span className="font-bold text-indigo-600">Suivi &amp; examens complémentaires</span>
                          </p>
                        )}
                        {nextControlDelay === '__custom__' && customDelayText.trim() && (
                          <p className="text-xs text-slate-400 font-medium">
                            → Ajouté en premier item de <span className="font-bold text-indigo-600">Suivi &amp; examens complémentaires</span>
                          </p>
                        )}
                      </div>

                    </div>
                  </div>

                  <div className="flex justify-center border-t-2 border-slate-200 pt-8">
                    <button
                      onClick={soumettreIA}
                      disabled={isAnalyzing}
                      className="bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-black text-xl px-20 py-8 rounded-3xl shadow-xl shadow-teal-500/30 active:scale-95 transition-all flex items-center justify-center gap-4 border-b-4 border-teal-800 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <Stethoscope className="w-10 h-10" />
                      SOUMETTRE À L'I.A.
                    </button>
                  </div>
                </>
              )}

              {/* Vue rapport */}
              {view === 'report' && octReportData && (
                <div className="animate-in slide-in-from-bottom-8">
                  <div className="mb-6 no-print">
                    <ValidationBadge validation={jsonValidation} />
                  </div>

                  <div ref={reportRef}>
                    <OCTReport data={octReportData} />
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <PatientEditModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        patient={selectedPatient}
        onUpdate={setSelectedPatient}
      />

      {/* Modale confirmation nouvelle journée */}
      {showNewDayModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full">
            <h3 className="text-xl font-extrabold text-slate-800 mb-2">Nouvelle journée ?</h3>
            <p className="text-slate-500 text-sm font-medium mb-1">
              {patients.length} patient{patients.length > 1 ? 's' : ''} en attente
              {patients.length > 1 ? ' seront archivés' : ' sera archivé'}.
            </p>
            <p className="text-red-500 text-xs font-bold mb-6">Cette action est irréversible.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowNewDayModal(false)}
                disabled={isPurgingDay}
                className="flex-1 px-4 py-3 rounded-xl border-2 border-slate-200 font-bold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
              <button
                onClick={handleNewDay}
                disabled={isPurgingDay}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isPurgingDay ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Archivage…
                  </>
                ) : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast nouvelle journée */}
      {purgeToast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl">
          {purgeToast}
        </div>
      )}
    </>
  );
}
