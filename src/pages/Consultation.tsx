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
  RefreshCw,
  Pencil,
  X,
  Plus,
} from 'lucide-react';
import { db, collection, onSnapshot, query, orderBy, where } from '../services/firebase';
import PatientEditModal from '../components/modals/PatientEditModal';
import { sendViaWhatsApp, sendViaEmail } from '../services/communication';
import { callNativeAI } from '../services/aiManager';
import EyeForm from '../components/forms/EyeForm';
import { createEyeState } from '../utils/clinicalData';
import { usePrefs } from '../hooks/usePrefs';
import { normalizeClinicalData } from '../utils/clinicalPayload';
import { processHypothesisAddition } from '../utils/hypothesisValidation';
import { HYPOTHESES_DIAGNOSTIQUES, REPORT_TYPES } from '../utils/constants';
import { buildClinicalSummary } from '../utils/clinicalSummary';
import { buildAIPayload } from '../utils/aiPayload';
import OCTReport, { type OCTReportData } from '../components/reports/OCTReport';
import ValidationBadge from '../components/shared/ValidationBadge';
import { mapAIResultToOCTReportData, DEFAULT_PRACTITIONER } from '../utils/reportDataMapper';

import type { PatientFirestore } from '../types/patient';
import type { EyeState, HypotheseDiagnostique, RawConsultationData } from '../types/clinical';
import type { ValidationResult } from '../types/ai';
import type { ReportType } from '../utils/constants';

type ConsultationView = 'form' | 'report';

export default function Consultation() {
  const [patients, setPatients] = useState<PatientFirestore[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientFirestore | null>(null);
  const { prefs, updatePrefs } = usePrefs();

  const [view, setView] = useState<ConsultationView>('form');
  const [reportType, setReportType] = useState<ReportType>('Compte rendu OCT');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [eyeOD, setEyeOD] = useState<EyeState>(createEyeState());
  const [eyeOG, setEyeOG] = useState<EyeState>(createEyeState());
  const [forceShowAnterior, setForceShowAnterior] = useState(false);
  const [forceShowPosterior, setForceShowPosterior] = useState(false);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [jsonValidation, setJsonValidation] = useState<ValidationResult | null>(null);
  const [octReportData, setOctReportData] = useState<OCTReportData | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  const [hypothesesDiagnostiques, setHypothesesDiagnostiques] = useState<HypotheseDiagnostique[]>([]);
  const [hypotheseLibre, setHypotheseLibre] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>(Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]);
  const [selectedHyp, setSelectedHyp] = useState<string>(
    HYPOTHESES_DIAGNOSTIQUES[Object.keys(HYPOTHESES_DIAGNOSTIQUES)[0]][0]
  );
  const [selectedLat, setSelectedLat] = useState<'OD et OG' | 'OD' | 'OG'>('OD et OG');
  const [hypoError, setHypoError] = useState('');
  const [hypoWarning, setHypoWarning] = useState('');

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
    setEyeOD(createEyeState());
    setEyeOG(createEyeState());
    setForceShowAnterior(false);
    setForceShowPosterior(false);
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

  const handlePatientSelect = (p: PatientFirestore) => {
    setSelectedPatient(p);
    resetExam();
  };

  const handlePrint = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    try {
      window.print();
    } catch {
      alert('Appuyez sur Ctrl+P ou Cmd+P.');
    }
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

  const isAnteriorBase = reportType === 'OCT du Segment Antérieur';
  const showAnterior = isAnteriorBase || forceShowAnterior;
  const showPosterior = !isAnteriorBase || forceShowPosterior;

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
      const mapped = mapAIResultToOCTReportData(rawInputJson, result, {
        title: DEFAULT_PRACTITIONER.title,
        specialty: DEFAULT_PRACTITIONER.specialty,
        email: DEFAULT_PRACTITIONER.email,
        phone: DEFAULT_PRACTITIONER.phone,
      });

      setJsonValidation(validation);
      setOctReportData(mapped);
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
            <span className="bg-teal-100 text-teal-800 text-sm font-bold px-3 py-1 rounded-full">
              {patients.length}
            </span>
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

                  {/* Sélecteur de type d'examen */}
                  <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row flex-wrap gap-4 items-center justify-between">
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
                    <div className="flex flex-wrap gap-4 items-center">
                      {isAnteriorBase && (
                        <button
                          onClick={() => setForceShowPosterior(!forceShowPosterior)}
                          className={`text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all ${
                            forceShowPosterior
                              ? 'bg-indigo-500 text-white border-2 border-indigo-500 shadow-md'
                              : 'bg-white border-2 border-indigo-200 text-indigo-600'
                          }`}
                        >
                          + Rétine/Postérieur
                        </button>
                      )}
                      {!isAnteriorBase && (
                        <button
                          onClick={() => setForceShowAnterior(!forceShowAnterior)}
                          className={`text-sm font-bold px-4 py-2 rounded-xl active:scale-95 transition-all ${
                            forceShowAnterior
                              ? 'bg-teal-500 text-white border-2 border-teal-500 shadow-md'
                              : 'bg-white border-2 border-teal-200 text-teal-600'
                          }`}
                        >
                          + Cornée/Antérieur
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Formulaires oculaires */}
                  <div className="flex flex-col lg:flex-row gap-6 mb-6">
                    <EyeForm
                      side="OD"
                      label="ŒIL DROIT"
                      color="#0C2233"
                      eye={eyeOD}
                      onChange={setEyeOD}
                      isOCT={reportType.includes('OCT')}
                      prefs={prefs}
                      updatePrefs={updatePrefs}
                      showAnterior={showAnterior}
                      showPosterior={showPosterior}
                    />
                    <EyeForm
                      side="OG"
                      label="ŒIL GAUCHE"
                      color="#13344D"
                      eye={eyeOG}
                      onChange={setEyeOG}
                      isOCT={reportType.includes('OCT')}
                      prefs={prefs}
                      updatePrefs={updatePrefs}
                      showAnterior={showAnterior}
                      showPosterior={showPosterior}
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
    </>
  );
}
