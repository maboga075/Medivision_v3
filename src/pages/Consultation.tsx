import { useState, useEffect, useRef } from 'react';
import {
  ChevronLeft,
  ChevronDown,
  RefreshCw,
  Pencil,
  FileDown,
  MessageCircle,
  Mail,
  RotateCcw,
  Download,
  Stethoscope,
  Activity,
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, where } from '../services/firebase';
import PatientEditModal from '../components/modals/PatientEditModal';
import { callNativeAI } from '../services/aiManager';
import EyeExamSection from '../components/forms/EyeExamSection';
import { useConsultationDrafts } from '../hooks/useConsultationDrafts';
import { normalizeClinicalData } from '../utils/clinicalPayload';
import { buildClinicalSummary } from '../utils/clinicalSummary';
import { buildAIPayload } from '../utils/aiPayload';
import OCTReport, { type OCTReportData } from '../components/reports/OCTReport';
import PatientReport from '../components/reports/PatientReport';
import ReportAudienceToggle, { type ReportAudience } from '../components/reports/ReportAudienceToggle';
import ValidationBadge from '../components/shared/ValidationBadge';
import { mapAIResultToOCTReportData, DEFAULT_PRACTITIONER } from '../utils/reportDataMapper';
import { useSettings } from '../hooks/useSettings';
import { DEFAULT_SUGGESTIONS } from '../constants/defaultSuggestions';
import { useReports } from '../features/reports/hooks/useReports';
import { useConsultationForm } from '../features/consultation/hooks/useConsultationForm';
import { useExportActions } from '../features/consultation/hooks/useExportActions';
import WaitingQueue from '../features/consultation/components/WaitingQueue';
import ExamTypeSelector from '../features/consultation/components/ExamTypeSelector';
import HypothesesSection from '../features/consultation/components/HypothesesSection';
import ReportParamsSection from '../features/consultation/components/ReportParamsSection';

import type { PatientFirestore } from '../types/patient';
import type { ValidationResult } from '../types/ai';
import type { RawConsultationData } from '../types/clinical';

type ConsultationView = 'form' | 'report';

export default function Consultation() {
  const { settings, updateBulles } = useSettings();
  const { saveReport } = useReports();

  // ── Sélection du médecin examinateur ──────────────────────────────────────
  const [selectedDoctorId, setSelectedDoctorId] = useState<string>('');
  useEffect(() => {
    if (settings?.medecinPrescripteurParDefaut && !selectedDoctorId) {
      setSelectedDoctorId(settings.medecinPrescripteurParDefaut);
    }
  }, [settings, selectedDoctorId]);

  // ── File d'attente ─────────────────────────────────────────────────────────
  const [patients, setPatients] = useState<PatientFirestore[]>([]);
  useEffect(() => {
    const q = query(
      collection(db, 'patients'),
      where('statut', '==', 'en_attente'),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const live: PatientFirestore[] = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<PatientFirestore, 'id' | 'date'>),
        date: docSnap.data().createdAt ? docSnap.data().createdAt.toDate() : new Date(),
      }));
      setPatients(live);
    });
    return () => unsubscribe();
  }, []);

  // ── État principal ─────────────────────────────────────────────────────────
  const [selectedPatient, setSelectedPatient] = useState<PatientFirestore | null>(null);
  const [view, setView] = useState<ConsultationView>('form');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jsonValidation, setJsonValidation] = useState<ValidationResult | null>(null);
  const [octReportData, setOctReportData] = useState<OCTReportData | null>(null);
  const [reportAudience, setReportAudience] = useState<ReportAudience>('medecin');
  const reportRef = useRef<HTMLDivElement>(null);

  // ── Formulaire clinique ────────────────────────────────────────────────────
  const form = useConsultationForm();

  // ── Brouillons ────────────────────────────────────────────────────────────
  const { loadAllDrafts, saveDraft, getDraft, deleteDraft, clearAllDrafts } = useConsultationDrafts();
  useEffect(() => { loadAllDrafts(); }, [loadAllDrafts]);

  useEffect(() => {
    if (!selectedPatient) return;
    saveDraft(selectedPatient.id, form.snapshotDraft());
  }, [
    selectedPatient,
    form.reportType, form.eyeOD, form.eyeOG, form.forceShowAnterior, form.octaDone,
    form.hypothesesDiagnostiques, form.hypotheseLibre,
    form.selectedCat, form.selectedHyp, form.selectedLat,
    saveDraft, form.snapshotDraft,
  ]);

  // ── Export ─────────────────────────────────────────────────────────────────
  const exportActions = useExportActions({ selectedPatient, octReportData, reportRef });

  // ── Sélection patient ──────────────────────────────────────────────────────
  const handlePatientSelect = (p: PatientFirestore) => {
    if (selectedPatient) saveDraft(selectedPatient.id, form.snapshotDraft());
    setSelectedPatient(p);
    const draft = getDraft(p.id);
    if (draft) {
      form.applyDraft(draft);
      setView('form');
    } else {
      form.reset();
      setView('form');
    }
    setOctReportData(null);
    setJsonValidation(null);
  };

  const handleNewDayConfirmed = () => {
    clearAllDrafts();
    setSelectedPatient(null);
    setOctReportData(null);
    setJsonValidation(null);
    form.reset();
  };

  // ── Pipeline IA ────────────────────────────────────────────────────────────
  const soumettreIA = async () => {
    if (!selectedPatient) return;
    setIsAnalyzing(true);
    try {
      const rawInputJson: RawConsultationData = {
        patient: {
          nom: selectedPatient.nom,
          sexe: selectedPatient.sexe,
          age: selectedPatient.age,
          date_naissance: selectedPatient.dateNaissance ?? null,
        },
        contexte: {
          prescripteur: selectedPatient.medecinPrescripteur ?? '',
          motifs: selectedPatient.motifs,
          antecedents: selectedPatient.antecedents,
          hypotheses_diagnostiques: form.hypothesesDiagnostiques,
          hypothese_libre: form.hypotheseLibre,
        },
        oeil_droit: form.eyeOD,
        oeil_gauche: form.eyeOG,
        reportType: form.reportType,
        anteriorSegmentDone: form.showAnterior,
        octaDone: form.octaDone,
        acquisitionQualityOD: form.eyeOD.acquisitionQuality ?? 'bon',
        acquisitionQualityOG: form.eyeOG.acquisitionQuality ?? 'bon',
      };

      const normalizedJson = normalizeClinicalData(rawInputJson);
      if (!normalizedJson) throw new Error('La normalisation clinique a échoué.');

      const clinicalSummary = buildClinicalSummary(normalizedJson);
      if (!clinicalSummary) throw new Error('La construction du résumé clinique a échoué.');

      const aiPayload = buildAIPayload(normalizedJson, clinicalSummary, form.reportType);
      if (!aiPayload || Object.keys(aiPayload).length === 0) {
        throw new Error('Données cliniques insuffisantes pour construire le payload IA.');
      }

      const { result, validation } = await callNativeAI(aiPayload);
      if (!result) throw new Error("Le moteur IA n'a retourné aucun résultat.");

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

      if (form.showBadge) {
        const label =
          form.showBadgeCustom && form.badgeCustomLabel.trim()
            ? form.badgeCustomLabel.trim()
            : form.badgeVariant === 'surveillance'
              ? 'Surveillance recommandée'
              : 'Urgence thérapeutique';
        mapped.badge = { label, variant: form.badgeVariant };
      }

      const resolvedDelay =
        form.nextControlDelay === '__custom__' ? form.customDelayText.trim() : form.nextControlDelay;
      if (resolvedDelay) {
        mapped.prochainControleOCT = resolvedDelay;
        mapped.suivi = [`Contrôle OCT : ${resolvedDelay}`, ...mapped.suivi];
      }
      const resolvedComplementaryExam = form.complementaryExam.trim();
      if (resolvedComplementaryExam) {
        mapped.examenComplementaire = resolvedComplementaryExam;
      }

      setJsonValidation(validation);
      setOctReportData(mapped);

      saveReport({
        patientId: selectedPatient.id,
        patientNom: selectedPatient.nom,
        folderId: selectedPatient.folderId,
        reportType: form.reportType,
        data: mapped,
        status: 'final',
      });

      deleteDraft(selectedPatient.id);
      setView('report');
      window.scrollTo(0, 0);
    } catch (e) {
      console.error('[IA] Erreur pipeline:', e);
      alert(e instanceof Error ? e.message : 'Erreur réseau pendant la génération IA.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="flex h-full bg-slate-50 overflow-hidden">
        <WaitingQueue
          patients={patients}
          selectedPatient={selectedPatient}
          isAnalyzing={isAnalyzing}
          onSelectPatient={handlePatientSelect}
          onNewDayConfirmed={handleNewDayConfirmed}
        />

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
                    {selectedPatient.nom}
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
                    onClick={exportActions.handlePrint}
                    className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <FileDown className="w-5 h-5" /> Imprimer PDF
                  </button>

                  <div className="relative" ref={exportActions.exportMenuRef}>
                    <button
                      onClick={() => exportActions.setExportMenuOpen((o) => !o)}
                      className={`px-5 py-2.5 font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all active:scale-95 border-2 ${
                        exportActions.exportMenuOpen
                          ? 'bg-amber-50 border-amber-400 text-amber-700'
                          : 'bg-white border-slate-200 hover:border-amber-300 text-slate-700'
                      }`}
                    >
                      <Download className="w-5 h-5" /> Export
                      <ChevronDown
                        className={`w-4 h-4 transition-transform duration-200 ${exportActions.exportMenuOpen ? 'rotate-180' : ''}`}
                      />
                    </button>
                    {exportActions.exportMenuOpen && (
                      <div className="absolute top-full right-0 mt-2 w-44 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in slide-in-from-top-2">
                        <button
                          onClick={exportActions.handleExportPDF}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors"
                        >
                          <FileDown className="w-4 h-4 text-red-500" /> PDF
                        </button>
                        <button
                          onClick={exportActions.handleExportWord}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100"
                        >
                          <FileDown className="w-4 h-4 text-blue-500" /> Word (.doc)
                        </button>
                        <button
                          onClick={exportActions.handleExportJSON}
                          disabled={!octReportData}
                          className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition-colors border-t border-slate-100 disabled:opacity-40"
                        >
                          <Download className="w-4 h-4 text-teal-500" /> JSON
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={exportActions.handleWhatsApp}
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
                    onClick={exportActions.handleEmail}
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
                  {/* En-tête patient */}
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
                            <span className="text-slate-600 font-mono">{selectedPatient.folderId}</span>
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

                  <ExamTypeSelector
                    reportType={form.reportType}
                    onReportTypeChange={form.handleReportTypeChange}
                    selectedDoctorId={selectedDoctorId}
                    onDoctorChange={setSelectedDoctorId}
                    showAnterior={form.showAnterior}
                    isAnteriorBase={form.isAnteriorBase}
                    onAnteriorChange={form.handleAnteriorChange}
                    octaDone={form.octaDone}
                    onOctaDoneChange={form.setOctaDone}
                    doctors={settings?.doctors}
                  />

                  <div className="flex flex-col lg:flex-row gap-6 mb-6">
                    <EyeExamSection
                      side="OD"
                      eye={form.eyeOD}
                      onUpdate={form.setEyeOD}
                      isOCT={form.reportType.includes('OCT')}
                      showOpticNerve={form.reportType === 'Compte rendu Rétinographie'}
                      showAnterior={form.showAnterior}
                      octaDone={form.octaDone}
                      onNewSuggestion={(category, item) => {
                        const stored = settings?.formulario?.[category];
                        const effective = stored ?? DEFAULT_SUGGESTIONS[category] ?? [];
                        if (!effective.includes(item)) updateBulles(category, [...effective, item]);
                      }}
                    />
                    <EyeExamSection
                      side="OG"
                      eye={form.eyeOG}
                      onUpdate={form.setEyeOG}
                      isOCT={form.reportType.includes('OCT')}
                      showOpticNerve={form.reportType === 'Compte rendu Rétinographie'}
                      showAnterior={form.showAnterior}
                      octaDone={form.octaDone}
                      onNewSuggestion={(category, item) => {
                        const stored = settings?.formulario?.[category];
                        const effective = stored ?? DEFAULT_SUGGESTIONS[category] ?? [];
                        if (!effective.includes(item)) updateBulles(category, [...effective, item]);
                      }}
                    />
                  </div>

                  <HypothesesSection
                    hypothesesDiagnostiques={form.hypothesesDiagnostiques}
                    onHypothesesChange={form.setHypothesesDiagnostiques}
                    hypotheseLibre={form.hypotheseLibre}
                    onHypotheseLibreChange={form.setHypotheseLibre}
                    selectedCat={form.selectedCat}
                    onSelectedCatChange={form.setSelectedCat}
                    selectedHyp={form.selectedHyp}
                    onSelectedHypChange={form.setSelectedHyp}
                    selectedLat={form.selectedLat}
                    onSelectedLatChange={form.setSelectedLat}
                    eyeOD={form.eyeOD}
                    eyeOG={form.eyeOG}
                  />

                  <ReportParamsSection
                    showBadge={form.showBadge}
                    onShowBadgeChange={form.setShowBadge}
                    badgeVariant={form.badgeVariant}
                    onBadgeVariantChange={form.setBadgeVariant}
                    badgeCustomLabel={form.badgeCustomLabel}
                    onBadgeCustomLabelChange={form.setBadgeCustomLabel}
                    showBadgeCustom={form.showBadgeCustom}
                    onShowBadgeCustomChange={form.setShowBadgeCustom}
                    nextControlDelay={form.nextControlDelay}
                    onNextControlDelayChange={form.setNextControlDelay}
                    customDelayText={form.customDelayText}
                    onCustomDelayTextChange={form.setCustomDelayText}
                    complementaryExam={form.complementaryExam}
                    onComplementaryExamChange={form.setComplementaryExam}
                  />

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
                  <div className="mb-6 no-print flex items-center justify-between gap-4 flex-wrap">
                    <ValidationBadge validation={jsonValidation} />
                    <ReportAudienceToggle value={reportAudience} onChange={setReportAudience} />
                  </div>
                  <div ref={reportRef}>
                    {reportAudience === 'medecin' ? (
                      <OCTReport data={octReportData} />
                    ) : (
                      <PatientReport data={octReportData} />
                    )}
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
    </>
  );
}
