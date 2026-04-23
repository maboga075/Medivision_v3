import { useState, type Dispatch, type SetStateAction } from 'react';
import { UserPlus, FileText, Activity, Plus, X, Pill, CheckCircle } from 'lucide-react';
import { db, collection, addDoc, serverTimestamp } from '../services/firebase';
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
  dateNaissance: '',
  motifs: [],
  antecedents: [],
  tel: '',
  email: '',
  hasTraitement: false,
  traitementTexte: '',
  medecinPrescripteur: '',
  dateExamen: new Date().toISOString().split('T')[0],
};

export default function Accueil() {
  const [formData, setFormData] = useState<PatientFormData>(EMPTY_FORM);
  const [isSuccess, setIsSuccess] = useState(false);

  const [customMotifs, setCustomMotifs] = useState<string[]>([]);
  const [showAddMotif, setShowAddMotif] = useState(false);
  const [newMotif, setNewMotif] = useState('');

  const [customAtcd, setCustomAtcd] = useState<string[]>([]);
  const [showAddAtcd, setShowAddAtcd] = useState(false);
  const [newAtcd, setNewAtcd] = useState('');

  const [customDoctors, setCustomDoctors] = useState<string[]>([]);
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [newDoc, setNewDoc] = useState('');

  const toggleArrayItem = (field: 'motifs' | 'antecedents', item: string) => {
    setFormData((prev) => {
      const arr = prev[field];
      if (arr.includes(item)) return { ...prev, [field]: arr.filter((i) => i !== item) };
      return { ...prev, [field]: [...arr, item] };
    });
  };

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
    } else {
      setFormData((prev) => ({
        ...prev,
        [field]: [...new Set([...prev[field as 'motifs' | 'antecedents'], trimmed])],
      }));
    }
    setVal('');
    setShow(false);
  };

  const handleSave = async () => {
    if (
      !formData.nom ||
      !formData.dateNaissance ||
      formData.motifs.length === 0 ||
      formData.antecedents.length === 0
    ) {
      alert('Veuillez remplir les champs obligatoires (Nom, Date de naissance, Motifs, Antécédents).');
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
      alert("Erreur lors de l'enregistrement. L'application synchronisera lors du retour réseau.");
    }
  };

  const handleReset = () => {
    setFormData({ ...EMPTY_FORM, dateExamen: new Date().toISOString().split('T')[0] });
    setCustomMotifs([]);
    setCustomAtcd([]);
    setCustomDoctors([]);
    setIsSuccess(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 overflow-y-auto h-full">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
            <UserPlus className="w-8 h-8 text-teal-600" />
            Nouveau Dossier Patient
          </h1>
          <p className="text-slate-500 mt-2 font-medium">
            Saisie secrétariat pour l'entrée en salle d'attente.
          </p>
        </div>

        <div className="p-6 sm:p-8 space-y-10">
          {/* Identité */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-1 border-2 border-slate-100 p-4 rounded-3xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                N° Dossier (Optionnel)
              </label>
              <input
                type="text"
                value={formData.folderId}
                onChange={(e) => setFormData({ ...formData, folderId: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg bg-white"
                placeholder="Ex: DP-2026-001"
              />
            </div>
            <div className="md:col-span-1 border-2 border-slate-100 p-4 rounded-3xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Nom & Prénom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nom}
                onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg bg-white"
                placeholder="Ex: Jean Dupont"
              />
            </div>
            <div className="md:col-span-1 border-2 border-slate-100 p-4 rounded-3xl bg-slate-50/50">
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Date de naissance{' '}
                {formData.dateNaissance && (
                  <span className="text-teal-600">
                    ({calculateAge(formData.dateNaissance)} ans)
                  </span>
                )}{' '}
                <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formData.dateNaissance}
                onChange={(e) => setFormData({ ...formData, dateNaissance: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg bg-white"
              />
            </div>
          </section>

          {/* Clinique */}
          <section className="space-y-8 border-t border-slate-100 pt-8">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-teal-600" /> Motif(s) principal(aux){' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-4 items-center">
                {[...COMMON_MOTIFS, ...customMotifs].map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleArrayItem('motifs', m)}
                    className={`px-5 py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-95 border-2 ${
                      formData.motifs.includes(m)
                        ? 'bg-teal-500 text-white shadow-md border-teal-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
                    }`}
                  >
                    {m}
                  </button>
                ))}

                {showAddMotif ? (
                  <div className="flex items-center gap-2 bg-teal-50 p-2 rounded-2xl border border-teal-100">
                    <input
                      autoFocus
                      className="px-4 py-3 border-2 border-teal-300 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
                      placeholder="Nouveau motif..."
                      value={newMotif}
                      onChange={(e) => setNewMotif(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleAddCustom('motifs', newMotif, setCustomMotifs, setShowAddMotif, setNewMotif);
                        if (e.key === 'Escape') setShowAddMotif(false);
                      }}
                    />
                    <button
                      onClick={() =>
                        handleAddCustom('motifs', newMotif, setCustomMotifs, setShowAddMotif, setNewMotif)
                      }
                      className="bg-teal-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-teal-600 transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setShowAddMotif(false)}
                      className="text-slate-400 hover:text-slate-600 p-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddMotif(true)}
                    className="px-5 py-4 rounded-2xl text-[15px] font-bold border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Autre
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-600" /> Antécédents{' '}
                <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-4 items-center">
                {[...COMMON_ANTECEDENTS, ...customAtcd].map((a) => (
                  <button
                    key={a}
                    onClick={() => toggleArrayItem('antecedents', a)}
                    className={`px-5 py-4 rounded-2xl text-[15px] font-bold transition-all active:scale-95 border-2 ${
                      formData.antecedents.includes(a)
                        ? 'bg-indigo-500 text-white shadow-md border-indigo-500'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {a}
                  </button>
                ))}

                {showAddAtcd ? (
                  <div className="flex items-center gap-2 bg-indigo-50 p-2 rounded-2xl border border-indigo-100">
                    <input
                      autoFocus
                      className="px-4 py-3 border-2 border-indigo-300 rounded-xl text-sm font-bold outline-none focus:border-indigo-500"
                      placeholder="Nouvel antécédent..."
                      value={newAtcd}
                      onChange={(e) => setNewAtcd(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter')
                          handleAddCustom('antecedents', newAtcd, setCustomAtcd, setShowAddAtcd, setNewAtcd);
                        if (e.key === 'Escape') setShowAddAtcd(false);
                      }}
                    />
                    <button
                      onClick={() =>
                        handleAddCustom('antecedents', newAtcd, setCustomAtcd, setShowAddAtcd, setNewAtcd)
                      }
                      className="bg-indigo-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-600 transition-colors"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setShowAddAtcd(false)}
                      className="text-slate-400 hover:text-slate-600 p-2"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowAddAtcd(true)}
                    className="px-5 py-4 rounded-2xl text-[15px] font-bold border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 transition-all flex items-center gap-2"
                  >
                    <Plus className="w-5 h-5" /> Autre
                  </button>
                )}
              </div>
            </div>

            {/* Traitement */}
            <div className="bg-slate-50 rounded-3xl p-6 border border-slate-200">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div>
                  <label className="block text-sm font-bold text-slate-800 flex items-center gap-2">
                    <Pill className="w-5 h-5 text-amber-500" /> Traitement(s) médical(aux) en cours ?
                  </label>
                  <p className="text-xs text-slate-500 mt-1">
                    Gouttes, comprimés, traitement général...
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setFormData({ ...formData, hasTraitement: true })}
                    className={`px-6 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      formData.hasTraitement
                        ? 'bg-amber-500 border-amber-500 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-amber-300'
                    }`}
                  >
                    Oui
                  </button>
                  <button
                    onClick={() =>
                      setFormData({ ...formData, hasTraitement: false, traitementTexte: '' })
                    }
                    className={`px-6 py-3 rounded-xl text-sm font-bold border-2 transition-all ${
                      !formData.hasTraitement
                        ? 'bg-slate-600 border-slate-600 text-white shadow-md'
                        : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    Non
                  </button>
                </div>
              </div>

              {formData.hasTraitement && (
                <div className="mt-4">
                  <textarea
                    className="w-full p-4 border-2 border-amber-200 rounded-2xl text-sm font-medium outline-none focus:border-amber-400 bg-amber-50/50 shadow-inner min-h-[100px]"
                    placeholder="Ex: Monoprost 1 goutte le soir pour ODG, Metformine..."
                    value={formData.traitementTexte}
                    onChange={(e) => setFormData({ ...formData, traitementTexte: e.target.value })}
                  />
                </div>
              )}
            </div>
          </section>

          {/* Prescripteur & Date */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-8">
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
                        handleAddCustom(
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
                      handleAddCustom(
                        'medecinPrescripteur',
                        newDoc,
                        setCustomDoctors,
                        setShowAddDoc,
                        setNewDoc
                      )
                    }
                    className="bg-indigo-500 text-white px-4 py-3 rounded-xl text-sm font-bold hover:bg-indigo-600"
                  >
                    OK
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
                  <select
                    value={formData.medecinPrescripteur}
                    onChange={(e) =>
                      setFormData({ ...formData, medecinPrescripteur: e.target.value })
                    }
                    className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg bg-white appearance-none cursor-pointer"
                  >
                    <option value="">— Non spécifié —</option>
                    {[...INITIAL_DOCTORS, ...customDoctors].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
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
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg bg-white"
              />
            </div>
          </section>

          {/* Contact */}
          <section className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-8">
            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">
                Téléphone (Optionnel)
              </label>
              <input
                type="tel"
                value={formData.tel}
                onChange={(e) => setFormData({ ...formData, tel: e.target.value })}
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg"
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
                className="w-full px-5 py-4 rounded-2xl border-2 border-slate-200 focus:ring-0 focus:border-teal-500 outline-none transition-all text-lg"
                placeholder="patient@mail.com"
              />
            </div>
          </section>

          {/* Actions */}
          <div className="pt-8 flex flex-col sm:flex-row gap-4">
            {!isSuccess ? (
              <button
                onClick={handleSave}
                className="w-full sm:w-auto flex-1 px-10 py-5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-extrabold text-xl shadow-lg hover:shadow-teal-500/30 transition-all active:scale-95 flex items-center justify-center gap-3"
              >
                <UserPlus className="w-7 h-7" />
                Enregistrer le patient
              </button>
            ) : (
              <div className="w-full sm:w-auto flex-1 px-10 py-5 bg-green-500 text-white rounded-2xl font-extrabold text-xl shadow-md flex items-center justify-center gap-3 cursor-default">
                <CheckCircle className="w-7 h-7" />
                Patient enregistré ✔
              </div>
            )}

            <button
              onClick={handleReset}
              className="w-full sm:w-auto px-10 py-5 bg-slate-100 hover:bg-slate-200 text-slate-700 border-2 border-slate-200 rounded-2xl font-extrabold text-xl transition-all active:scale-95 flex items-center justify-center gap-3 shadow-sm hover:shadow-md"
            >
              <UserPlus className="w-7 h-7 text-slate-400" />
              Nouveau patient
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
