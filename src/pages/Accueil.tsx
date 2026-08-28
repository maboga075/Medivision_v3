import { useState, type Dispatch, type SetStateAction } from 'react';
import { UserPlus, FileText, Activity, Plus, X, Pill, CheckCircle, Save } from 'lucide-react';
import { db, collection, addDoc, serverTimestamp } from '../services/firebase';
import { useSettings } from '../hooks/useSettings';
import { useToast } from '../components/shared/ToastProvider';
import TagAutocomplete from '../components/forms/TagAutocomplete';
import PrescriberCombobox from '../components/forms/PrescriberCombobox';
import DateInput from '../components/forms/DateInput';
import type { PatientFormData } from '../types/patient';

const COMMON_MOTIFS = [
  "Bilan visuel",
  "Suspicion de glaucome",
  "Baisse d'acuité visuelle",
  "Suivi diabétique",
  "DMLA",
  "Œil rouge",
];
const COMMON_ANTECEDENTS = [
  "Sans particularité",
  "Diabète",
  "HTA",
  "Myopie forte",
  "Glaucome familial",
  "Chirurgie cataracte",
];
const COMMON_MEDICAMENTS = [
  "Monoprost",
  "Cosopt",
  "Azarga",
  "Lumigan",
  "Ganfort",
  "Metformine",
  "Insuline",
];
const INITIAL_DOCTORS = [
  "Dr. Milebou",
  "Dr. Kougou Ntoutoume",
  "Dr. Bongo",
  "Dr. Nyinko Aboughe",
  "Dr. Gabin",
  "Dr. Mekyna",
  "Dr. Matsanga",
  "Dr. Njilekissa",
  "Dr. Apedo",
  "Dr. Souleyman",
  "Pr. Mba Aki",
  "Dr. Baye",
  "Dr. Mboussou",
];

const calculateAge = (dob: string): number => {
  const diff = Date.now() - new Date(dob).getTime();
  return Math.abs(new Date(diff).getUTCFullYear() - 1970);
};

const EMPTY_FORM: PatientFormData = {
  folderId: '',
  nom: '',
  sexe: '',
  dateNaissance: '',
  motifs: [],
  antecedents: ['Sans particularité'],
  tel: '',
  email: '',
  traitements: [],
  medecinPrescripteur: '',
  dateExamen: new Date().toISOString().split('T')[0],
};

export default function Accueil() {
  const { settings, updatePrescripteurs, updateBulles } = useSettings();
  const { notify } = useToast();
  const availableDoctors = settings?.prescripteurs ?? INITIAL_DOCTORS;
  const availableMotifs = settings?.formulario?.motifs ?? COMMON_MOTIFS;
  const availableAntecedents = settings?.formulario?.antecedents ?? COMMON_ANTECEDENTS;
  const availableMedicaments = settings?.formulario?.medicaments ?? COMMON_MEDICAMENTS;

  const [formData, setFormData] = useState<PatientFormData>(EMPTY_FORM);
  const [isSuccess, setIsSuccess] = useState(false);

  const [customDoctors, setCustomDoctors] = useState<string[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState('');

  const SP = 'Sans particularité';

  // Persiste une nouvelle suggestion (motif / antécédent) pour les prochaines sessions.
  const persistMotif = (item: string) => {
    if (!availableMotifs.some((m) => m.toLowerCase() === item.toLowerCase()))
      updateBulles('motifs', [...availableMotifs, item]).catch(console.error);
  };
  const persistAtcd = (item: string) => {
    if (!availableAntecedents.some((a) => a.toLowerCase() === item.toLowerCase()))
      updateBulles('antecedents', [...availableAntecedents, item]).catch(console.error);
  };
  const persistMedicament = (item: string) => {
    if (!availableMedicaments.some((m) => m.toLowerCase() === item.toLowerCase()))
      updateBulles('medicaments', [...availableMedicaments, item]).catch(console.error);
  };

  // Ajoute à la session courante uniquement (pas de sauvegarde dans les suggestions)
  const handleAddCustomSessionOnly = (
    field: 'motifs' | 'antecedents' | 'medecinPrescripteur',
    value: string,
    setCustomList: Dispatch<SetStateAction<string[]>>,
    setShow: Dispatch<SetStateAction<boolean>>,
    setVal: Dispatch<SetStateAction<string>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setCustomList((prev) => [...new Set([...prev, trimmed])]);
    if (field === 'medecinPrescripteur') {
      setFormData((prev) => ({ ...prev, medecinPrescripteur: trimmed }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: [...new Set([...prev[field as 'motifs' | 'antecedents'].filter((i) => i !== SP), trimmed])],
      }));
    }
    setVal('');
    setShow(false);
  };

  // Ajoute à la session ET enregistre dans les suggestions futures (Firebase)
  const handleAddCustom = (
    field: 'motifs' | 'antecedents' | 'medecinPrescripteur',
    value: string,
    setCustomList: Dispatch<SetStateAction<string[]>>,
    setShow: Dispatch<SetStateAction<boolean>>,
    setVal: Dispatch<SetStateAction<string>>
  ) => {
    const trimmed = value.trim();
    if (!trimmed) return;

    setCustomList((prev) => [...new Set([...prev, trimmed])]);
    if (field === 'medecinPrescripteur') {
      setFormData((prev) => ({ ...prev, medecinPrescripteur: trimmed }));
      if (!availableDoctors.some((p) => p.toLowerCase() === trimmed.toLowerCase())) {
        updatePrescripteurs([...availableDoctors, trimmed]).catch(console.error);
      }
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: [...new Set([...prev[field as 'motifs' | 'antecedents'].filter((i) => i !== SP), trimmed])],
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

  const handleSave = async () => {
    if (
      !formData.nom ||
      !formData.sexe ||
      !formData.dateNaissance ||
      formData.motifs.length === 0 ||
      formData.antecedents.length === 0
    ) {
      notify('Veuillez remplir les champs obligatoires (Nom, Sexe, Date de naissance, Motifs, Antécédents).', 'error');
      return;
    }

    try {
      await addDoc(collection(db, 'patients'), {
        ...formData,
        age: calculateAge(formData.dateNaissance),
        statut: 'en_attente',
        createdAt: serverTimestamp(),
      });
      setIsSuccess(true);
    } catch (e) {
      console.error('Erreur Firebase:', e);
      notify("Erreur lors de l'enregistrement. L'application synchronisera lors du retour réseau.", 'error');
    }
  };

  const handleReset = () => {
    setFormData({ ...EMPTY_FORM, dateExamen: new Date().toISOString().split('T')[0] });
    setCustomDoctors([]);
    setIsSuccess(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 bg-slate-50 border-b border-slate-200">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <UserPlus className="w-7 h-7 text-teal-600" />
            Nouveau Dossier Patient
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Saisie secrétariat pour l'entrée en salle d'attente.
          </p>
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {/* Identité — 4 champs regroupés sur une seule ligne (desktop) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                N° Dossier (Optionnel)
              </label>
              <input
                type="text"
                value={formData.folderId}
                onChange={(e) => setFormData({ ...formData, folderId: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base bg-white"
                placeholder="Ex: DP-2026-001"
              />
            </div>
            <div className="border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nom & Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base bg-white"
                placeholder="Ex: Jean Dupont"
              />
            </div>
            <div className="border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Sexe <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexe: 'M' })}
                  aria-label="Homme"
                  title="Homme"
                  className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-base font-bold border-2 transition-all active:scale-95 ${
                    formData.sexe === 'M'
                      ? 'bg-teal-500 border-teal-500 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                  }`}
                >
                  H
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, sexe: 'F' })}
                  aria-label="Femme"
                  title="Femme"
                  className={`flex-1 min-w-0 px-3 py-2.5 rounded-xl text-base font-bold border-2 transition-all active:scale-95 ${
                    formData.sexe === 'F'
                      ? 'bg-teal-500 border-teal-500 text-white shadow-md'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                  }`}
                >
                  F
                </button>
              </div>
            </div>
            <div className="border border-slate-200 p-3 rounded-2xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Date de naissance{' '}
                {formData.dateNaissance && (
                  <span className="text-teal-600">
                    ({calculateAge(formData.dateNaissance)} ans)
                  </span>
                )}{' '}
                <span className="text-red-500">*</span>
              </label>
              <DateInput
                aria-label="Date de naissance"
                value={formData.dateNaissance}
                onChange={(iso) => setFormData({ ...formData, dateNaissance: iso })}
                className="w-full pl-4 pr-11 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base bg-white"
              />
            </div>
          </section>

          {/* Clinique */}
          <section className="space-y-5 border-t border-slate-100 pt-6">
            <TagAutocomplete
              label={<><Activity className="w-5 h-5 text-teal-600" /> Motif(s) principal(aux)</>}
              required
              accent="teal"
              selectedItems={formData.motifs}
              suggestions={availableMotifs}
              onChange={(motifs) => setFormData((prev) => ({ ...prev, motifs }))}
              onPersistNew={persistMotif}
              placeholder="Rechercher ou saisir un motif…"
            />

            <TagAutocomplete
              label={<><FileText className="w-5 h-5 text-indigo-600" /> Antécédents</>}
              required
              accent="indigo"
              selectedItems={formData.antecedents}
              suggestions={availableAntecedents}
              onChange={(antecedents) => setFormData((prev) => ({ ...prev, antecedents }))}
              onPersistNew={persistAtcd}
              exclusiveItem="Sans particularité"
              placeholder="Rechercher ou saisir un antécédent…"
            />

            {/* Traitement — champ auto-complétant à mémoire (façon motifs / antécédents).
                Par défaut vide → « Traitement non renseigné » affiché en indice. */}
            <div>
              <TagAutocomplete
                label={<><Pill className="w-5 h-5 text-amber-500" /> Traitement(s) en cours</>}
                accent="teal"
                selectedItems={formData.traitements}
                suggestions={availableMedicaments}
                onChange={(traitements) => setFormData((prev) => ({ ...prev, traitements }))}
                onPersistNew={persistMedicament}
                placeholder="Rechercher ou saisir un médicament…"
              />
              {formData.traitements.length === 0 && (
                <p className="text-xs text-slate-400 italic mt-1.5 ml-1">
                  Aucun renseigné · le compte rendu indiquera « Traitement non renseigné »
                </p>
              )}
            </div>
          </section>

          {/* Prescripteur, Date & Contact — regroupés en une grille compacte */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-6">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Médecin Prescripteur
              </label>
              {showAddDoc ? (
                <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-2xl border border-indigo-100">
                  <input
                    autoFocus
                    className="w-full px-4 py-3 border-2 border-indigo-300 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                    placeholder="Dr. Nom..."
                    value={newDoc}
                    onChange={(e) => setNewDoc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')
                        handleAddCustomSessionOnly(
                          'medecinPrescripteur',
                          newDoc,
                          setCustomDoctors,
                          setShowAddDoc,
                          setNewDoc
                        );
                      if (e.key === 'Escape') setShowAddDoc(false);
                    }}
                  />
                  <button
                    onClick={() =>
                      handleAddCustomSessionOnly(
                        'medecinPrescripteur',
                        newDoc,
                        setCustomDoctors,
                        setShowAddDoc,
                        setNewDoc
                      )
                    }
                    title="Pour cette session uniquement"
                    className="bg-indigo-400 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-500 whitespace-nowrap"
                  >
                    Session
                  </button>
                  <button
                    onClick={() =>
                      handleAddCustom(
                        'medecinPrescripteur',
                        newDoc,
                        setCustomDoctors,
                        setShowAddDoc,
                        setNewDoc
                      )
                    }
                    title="Enregistrer pour les prochaines sessions"
                    className="bg-indigo-600 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-700 whitespace-nowrap flex items-center gap-1.5"
                  >
                    <Save className="w-4 h-4" /> Garder
                  </button>
                  <button
                    onClick={() => setShowAddDoc(false)}
                    className="text-slate-400 hover:text-slate-600 p-2"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <PrescriberCombobox
                    options={[...availableDoctors, ...customDoctors.filter((d) => !availableDoctors.includes(d))]}
                    value={formData.medecinPrescripteur}
                    onChange={(v) => setFormData({ ...formData, medecinPrescripteur: v })}
                  />
                  <button
                    onClick={() => setShowAddDoc(true)}
                    className="px-5 py-4 rounded-2xl border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition-all flex items-center justify-center shrink-0"
                  >
                    <Plus className="w-6 h-6" />
                  </button>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Date de l'examen
              </label>
              <input
                type="date"
                value={formData.dateExamen}
                onChange={(e) => setFormData({ ...formData, dateExamen: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base bg-white"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Téléphone (Optionnel)
              </label>
              <input
                type="tel"
                value={formData.tel}
                onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base"
                placeholder="+241 12 34 56 78"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Email (Optionnel)
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-base"
                placeholder="patient@mail.com"
              />
            </div>
          </section>

          {/* Actions */}
          <div className="pt-6 border-t border-slate-100 flex flex-col sm:flex-row gap-3">
            {!isSuccess ? (
              <button
                onClick={handleSave}
                className="w-full sm:w-auto flex-1 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-extrabold text-lg shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <UserPlus className="w-6 h-6" />
                Enregistrer le patient
              </button>
            ) : (
              <div className="w-full sm:w-auto flex-1 px-8 py-3.5 bg-green-500 text-white rounded-xl font-extrabold text-lg shadow-md flex items-center justify-center gap-3 cursor-default">
                <CheckCircle className="w-6 h-6" />
                Patient enregistré ✔
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-8 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200 rounded-xl font-extrabold text-lg transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
            >
              <UserPlus className="w-6 h-6 text-slate-400" />
              Nouveau patient
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
