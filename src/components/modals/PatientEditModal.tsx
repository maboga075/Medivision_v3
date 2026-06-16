import React, { useState, useEffect } from 'react';
import { UserPlus, FileText, Activity, Plus, X, Pill, CheckCircle, Save } from 'lucide-react';
import { db, doc, updateDoc } from '../../services/firebase';
import { useSettings } from '../../hooks/useSettings';
import { useToast } from '../shared/ToastProvider';
import TagAutocomplete from '../forms/TagAutocomplete';
import type { PatientFirestore, PatientFormData } from '../../types/patient';

const DEFAULT_MOTIFS = ["Bilan visuel", "Suspicion de glaucome", "Baisse d'acuité visuelle", "Suivi diabétique", "DMLA", "Œil rouge"];
const DEFAULT_ANTECEDENTS = ["Sans particularité", "Diabète", "HTA", "Myopie forte", "Glaucome familial", "Chirurgie cataracte"];
const DEFAULT_DOCTORS = ["Dr. Milebou", "Dr. Kougou Ntoutoume", "Dr. Bongo", "Dr. Nyinko Aboughe", "Dr. Gabin", "Dr. Mekyna", "Dr. Matsanga", "Dr. Njilekissa", "Dr. Apedo", "Dr. Souleyman", "Pr. Mba Aki", "Dr. Baye", "Dr. Mboussou"];

interface PatientEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  patient: PatientFirestore | null;
  onUpdate: (updated: PatientFirestore) => void;
}

const calculateAge = (dob: string): number => {
  if (!dob) return 0;
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};

const INITIAL_FORM: PatientFormData = {
  folderId: '', nom: '', sexe: '', dateNaissance: '', motifs: [], antecedents: [],
  tel: '', email: '', hasTraitement: false, traitementTexte: '',
  medecinPrescripteur: '', dateExamen: '',
};

export default function PatientEditModal({ isOpen, onClose, patient, onUpdate }: PatientEditModalProps) {
  const { settings, updatePrescripteurs, updateBulles } = useSettings();
  const { notify } = useToast();

  const availableMotifs = (() => {
    const custom = settings?.formulario?.motifs ?? [];
    return custom.length > 0 ? custom : DEFAULT_MOTIFS;
  })();

  const availableAntecedents = (() => {
    const custom = settings?.formulario?.antecedents ?? [];
    return custom.length > 0 ? custom : DEFAULT_ANTECEDENTS;
  })();

  const availableDoctors = settings?.prescripteurs ?? DEFAULT_DOCTORS;

  const [formData, setFormData] = useState<PatientFormData>(INITIAL_FORM);
  const [isSuccess, setIsSuccess] = useState(false);
  const [customDoctors, setCustomDoctors] = useState<string[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState('');

  const persistMotif = (item: string) => {
    if (!availableMotifs.some((m) => m.toLowerCase() === item.toLowerCase()))
      updateBulles('motifs', [...availableMotifs, item]).catch(console.error);
  };
  const persistAtcd = (item: string) => {
    if (!availableAntecedents.some((a) => a.toLowerCase() === item.toLowerCase()))
      updateBulles('antecedents', [...availableAntecedents, item]).catch(console.error);
  };

  useEffect(() => {
    if (isOpen && patient) {
      setFormData({
        folderId: patient.folderId ?? '',
        nom: patient.nom ?? '',
        sexe: patient.sexe ?? '',
        dateNaissance: patient.dateNaissance ?? '',
        motifs: patient.motifs ?? [],
        antecedents: patient.antecedents ?? [],
        tel: patient.tel ?? '',
        email: patient.email ?? '',
        hasTraitement: patient.hasTraitement ?? false,
        traitementTexte: patient.traitementTexte ?? '',
        medecinPrescripteur: patient.medecinPrescripteur ?? '',
        dateExamen: patient.dateExamen ?? new Date().toISOString().split('T')[0],
      });
      setIsSuccess(false);
      setCustomDoctors([]);
    }
  }, [isOpen, patient]);

  if (!isOpen || !patient) return null;

  // Ajoute à la session courante uniquement (pas de sauvegarde dans les suggestions)
  const handleAddCustomSessionOnly = (
    field: 'motifs' | 'antecedents' | 'medecinPrescripteur',
    value: string,
    setCustomList: React.Dispatch<React.SetStateAction<string[]>>,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    setVal: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    setCustomList((prev) => [...new Set([...prev, trimmed])]);
    if (field === 'medecinPrescripteur') {
      setFormData((prev) => ({ ...prev, medecinPrescripteur: trimmed }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: [...new Set([...(prev[field] as string[]), trimmed])],
      }));
    }
    setVal('');
    setShow(false);
  };

  // Ajoute à la session ET enregistre dans les suggestions futures (Firebase)
  const handleAddCustom = (
    field: 'motifs' | 'antecedents' | 'medecinPrescripteur',
    value: string,
    setCustomList: React.Dispatch<React.SetStateAction<string[]>>,
    setShow: React.Dispatch<React.SetStateAction<boolean>>,
    setVal: React.Dispatch<React.SetStateAction<string>>
  ) => {
    if (!value.trim()) return;
    const trimmed = value.trim();
    setCustomList((prev) => [...new Set([...prev, trimmed])]);
    if (field === 'medecinPrescripteur') {
      setFormData((prev) => ({ ...prev, medecinPrescripteur: trimmed }));
      if (!availableDoctors.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
        updatePrescripteurs([...availableDoctors, trimmed]).catch(console.error);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: [...new Set([...(prev[field] as string[]), trimmed])],
      }));
      if (field === 'motifs' && !availableMotifs.some((m) => m.toLowerCase() === trimmed.toLowerCase())) {
        updateBulles('motifs', [...availableMotifs, trimmed]).catch(console.error);
      } else if (field === 'antecedents' && !availableAntecedents.some((a) => a.toLowerCase() === trimmed.toLowerCase())) {
        updateBulles('antecedents', [...availableAntecedents, trimmed]).catch(console.error);
      }
    }
    setVal('');
    setShow(false);
  };

  const handleUpdate = async () => {
    if (!formData.nom || !formData.dateNaissance || !formData.motifs.length || !formData.antecedents.length) {
      notify('Veuillez remplir les champs obligatoires (Nom, Date de naissance, Motifs, Antécédents).', 'error');
      return;
    }
    try {
      const updatedData = {
        ...formData,
        sexe: formData.sexe || undefined, // '' → undefined pour rester compatible PatientFirestore
        age: calculateAge(formData.dateNaissance),
      };
      const pRef = doc(db, 'patients', patient.id);
      await updateDoc(pRef, updatedData as Record<string, unknown>);
      setIsSuccess(true);
      onUpdate({ ...patient, ...updatedData });
      setTimeout(() => onClose(), 1000);
    } catch (e) {
      console.error(e);
      notify('Erreur lors de la mise à jour.', 'error');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex justify-center items-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col relative animate-in fade-in zoom-in-95 duration-200">
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-slate-800 transition-colors z-10 bg-white rounded-full p-1 border border-slate-200 shadow-sm active:scale-95"
        >
          <X className="w-8 h-8" />
        </button>

        <div className="p-6 bg-slate-50 border-b border-slate-200 rounded-t-3xl shrink-0">
          <h2 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-indigo-600" /> Modifier le dossier
          </h2>
          <p className="text-slate-500 mt-2 font-medium">Mise à jour rapide des informations d'admission.</p>
        </div>

        <div className="p-6 sm:p-8 space-y-10 overflow-y-auto">
          {/* Identité */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {([ ['folderId', 'N° Dossier', 'text'], ['nom', 'Nom & Prénom *', 'text'], ['dateNaissance', 'Date de naissance *', 'date'] ] as [keyof PatientFormData, string, string][]).map(([field, lbl, type]) => (
              <div key={field} className="border-2 border-slate-100 p-4 rounded-3xl bg-slate-50/50">
                <label className="block text-sm font-bold text-slate-700 mb-2">
                  {lbl}
                  {field === 'dateNaissance' && formData.dateNaissance && (
                    <span className="text-indigo-600 ml-2">({calculateAge(formData.dateNaissance)} ans)</span>
                  )}
                </label>
                <input
                  type={type}
                  value={formData[field] as string}
                  onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                  className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-indigo-500 outline-none transition-all text-lg bg-white"
                />
              </div>
            ))}
            <div className="border-2 border-slate-100 p-4 rounded-3xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">Sexe</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexe: 'M' })}
                  className={`flex-1 px-4 py-4 rounded-2xl text-lg font-bold border-2 transition-all active:scale-95 ${formData.sexe === 'M' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                >
                  Homme
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexe: 'F' })}
                  className={`flex-1 px-4 py-4 rounded-2xl text-lg font-bold border-2 transition-all active:scale-95 ${formData.sexe === 'F' ? 'bg-indigo-500 border-indigo-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'}`}
                >
                  Femme
                </button>
              </div>
            </div>
          </section>

          {/* Motifs */}
          <section className="space-y-8 border-t border-slate-100 pt-8">
            <TagAutocomplete
              label={<><Activity className="w-5 h-5 text-indigo-600" /> Motif(s)</>}
              required
              accent="indigo"
              selectedItems={formData.motifs}
              suggestions={availableMotifs}
              onChange={(motifs) => setFormData((prev) => ({ ...prev, motifs }))}
              onPersistNew={persistMotif}
              placeholder="Rechercher ou saisir un motif…"
            />

            <TagAutocomplete
              label={<><FileText className="w-5 h-5 text-orange-600" /> Antécédents</>}
              required
              accent="indigo"
              selectedItems={formData.antecedents}
              suggestions={availableAntecedents}
              onChange={(antecedents) => setFormData((prev) => ({ ...prev, antecedents }))}
              onPersistNew={persistAtcd}
              exclusiveItem="Sans particularité"
              placeholder="Rechercher ou saisir un antécédent…"
            />

            {/* Traitement */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Pill className="w-5 h-5 text-amber-500" /> Traitement(s) en cours ?
                </label>
                <div className="flex gap-2">
                  <button onClick={() => setFormData({ ...formData, hasTraitement: true })} className={`px-6 py-3 rounded-xl text-sm font-bold border-2 ${formData.hasTraitement ? 'bg-amber-500 border-amber-500 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>Oui</button>
                  <button onClick={() => setFormData({ ...formData, hasTraitement: false, traitementTexte: '' })} className={`px-6 py-3 rounded-xl text-sm font-bold border-2 ${!formData.hasTraitement ? 'bg-slate-600 border-slate-600 text-white shadow-md' : 'bg-white border-slate-200 text-slate-600'}`}>Non</button>
                </div>
              </div>
              {formData.hasTraitement && (
                <div className="mt-4 animate-in slide-in-from-top-2">
                  <textarea className="w-full p-4 border-2 border-amber-200 rounded-2xl text-sm font-medium outline-none focus:border-amber-400 bg-amber-50/50 shadow-inner min-h-[100px]"
                    placeholder="Traitements..." value={formData.traitementTexte}
                    onChange={(e) => setFormData({ ...formData, traitementTexte: e.target.value })} />
                </div>
              )}
            </div>
          </section>

          {/* Prescripteur + Tel */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-8">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Médecin Prescripteur</label>
              {showAddDoc ? (
                <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-2xl border border-indigo-100">
                  <input autoFocus className="w-full px-4 py-3 border-2 border-indigo-300 rounded-xl text-sm font-bold outline-none" value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomSessionOnly('medecinPrescripteur', newDoc, setCustomDoctors, setShowAddDoc, setNewDoc); if (e.key === 'Escape') setShowAddDoc(false); }} />
                  <button onClick={() => handleAddCustomSessionOnly('medecinPrescripteur', newDoc, setCustomDoctors, setShowAddDoc, setNewDoc)} title="Pour cette session uniquement" className="bg-indigo-400 text-white px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap">Session</button>
                  <button onClick={() => handleAddCustom('medecinPrescripteur', newDoc, setCustomDoctors, setShowAddDoc, setNewDoc)} title="Enregistrer pour les prochaines sessions" className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold whitespace-nowrap flex items-center gap-1"><Save className="w-4 h-4" /> Garder</button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <select value={formData.medecinPrescripteur} onChange={(e) => setFormData({ ...formData, medecinPrescripteur: e.target.value })} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 text-lg bg-white">
                    <option value="">— Non spécifié —</option>
                    {[...availableDoctors, ...customDoctors.filter((d) => !availableDoctors.includes(d))].map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <button onClick={() => setShowAddDoc(true)} className="px-5 py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500"><Plus className="w-6 h-6" /></button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Téléphone</label>
              <input type="tel" value={formData.tel} onChange={(e) => setFormData({ ...formData, tel: e.target.value })} className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 text-lg" />
            </div>
          </section>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-200 rounded-b-3xl shrink-0 flex justify-end gap-4">
          <button onClick={onClose} className="px-8 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-colors">
            Annuler
          </button>
          {!isSuccess ? (
            <button onClick={handleUpdate} className="px-10 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-extrabold shadow-lg shadow-indigo-500/30 transition-all flex items-center gap-3">
              <Save className="w-6 h-6" /> Enregistrer la modification
            </button>
          ) : (
            <div className="px-10 py-4 bg-green-500 text-white rounded-2xl font-extrabold shadow-md flex items-center gap-3 cursor-default">
              <CheckCircle className="w-6 h-6" /> Dossier mis à jour
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
