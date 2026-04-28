import { useState, type ChangeEvent } from 'react';
import { UserPlus, Trash2, Star, StarOff, Stethoscope, Users, Plus, X } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { DEFAULT_PRESCRIPTEURS } from '../../constants/defaultSuggestions';
import type { Doctor } from '../../types/settings';

const EMPTY_FORM = { nom: '', prenom: '', specialite: 'Ophtalmologiste', numeroOrdre: '' };

export default function DoctorsTab() {
  const { settings, addDoctor, deleteDoctor, setDefaultPrescriber, updatePrescripteurs } = useSettings();

  // — Médecins clinique —
  const [form, setForm] = useState(EMPTY_FORM);
  const [adding, setAdding] = useState(false);

  // — Médecins prescripteurs —
  const [newPrescripteur, setNewPrescripteur] = useState('');
  const [addingPresc, setAddingPresc] = useState(false);

  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  /* ─── Clinique ─────────────────────────────────────────────────── */

  const handleChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((p) => ({ ...p, [name]: value }));
  };

  const handleAdd = async () => {
    if (!form.nom.trim() || !form.prenom.trim()) {
      showToast('Nom et prénom requis');
      return;
    }
    setAdding(true);
    try {
      await addDoctor(form);
      setForm(EMPTY_FORM);
      showToast('Médecin ajouté');
    } catch {
      showToast("Erreur lors de l'ajout");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (d: Doctor) => {
    if (!window.confirm(`Supprimer Dr. ${d.prenom} ${d.nom} ?`)) return;
    try {
      await deleteDoctor(d.id);
      showToast('Médecin supprimé');
    } catch {
      showToast('Erreur lors de la suppression');
    }
  };

  const handleToggleDefault = async (d: Doctor) => {
    const next = settings?.medecinPrescripteurParDefaut === d.id ? undefined : d.id;
    await setDefaultPrescriber(next);
    showToast(
      next
        ? `Dr. ${d.prenom} ${d.nom} défini comme prescripteur par défaut`
        : 'Prescripteur par défaut retiré'
    );
  };

  /* ─── Prescripteurs ─────────────────────────────────────────────── */

  const prescripteurs = settings?.prescripteurs ?? DEFAULT_PRESCRIPTEURS;

  const handleAddPrescripteur = async () => {
    const name = newPrescripteur.trim();
    if (!name) return;
    if (prescripteurs.some((p) => p.toLowerCase() === name.toLowerCase())) {
      showToast('Ce médecin est déjà dans la liste');
      return;
    }
    setAddingPresc(true);
    try {
      await updatePrescripteurs([...prescripteurs, name]);
      setNewPrescripteur('');
      showToast(`"${name}" ajouté`);
    } catch {
      showToast("Erreur lors de l'ajout");
    } finally {
      setAddingPresc(false);
    }
  };

  const handleRemovePrescripteur = async (name: string) => {
    try {
      await updatePrescripteurs(prescripteurs.filter((p) => p !== name));
      showToast('Médecin retiré de la liste');
    } catch {
      showToast('Erreur lors de la suppression');
    }
  };

  return (
    <div className="space-y-10">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      {/* ── Section 1 : Médecins de la clinique ───────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Stethoscope className="w-5 h-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-800">Médecins de la clinique</h2>
            <p className="text-xs text-slate-400 mt-0.5">Signataires des comptes rendus. L'étoile ⭐ désigne le signataire par défaut.</p>
          </div>
        </div>

        {/* Formulaire ajout */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-teal-600" />
            <h3 className="font-bold text-slate-700 text-sm">Ajouter un médecin</h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { field: 'nom',          label: 'Nom',         placeholder: 'MBOUSSOU' },
              { field: 'prenom',       label: 'Prénom',      placeholder: 'Yoan' },
              { field: 'specialite',   label: 'Spécialité',  placeholder: 'Ophtalmologiste' },
              { field: 'numeroOrdre',  label: 'N° Ordre',    placeholder: 'GA-12345' },
            ].map(({ field, label, placeholder }) => (
              <div key={field}>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">{label}</label>
                <input
                  type="text"
                  name={field}
                  value={form[field as keyof typeof form]}
                  onChange={handleChange}
                  placeholder={placeholder}
                  onKeyDown={(e) => field === 'numeroOrdre' && e.key === 'Enter' && handleAdd()}
                  className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500 bg-white"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={adding}
            className="mt-4 flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors disabled:opacity-60"
          >
            <UserPlus className="w-4 h-4" />
            {adding ? 'Ajout…' : 'Ajouter'}
          </button>
        </div>

        {/* Liste clinique */}
        {(settings?.doctors.length ?? 0) === 0 ? (
          <div className="text-center py-10 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Stethoscope className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium text-sm">Aucun médecin enregistré.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(settings?.doctors ?? []).map((d) => {
              const isDefault = settings?.medecinPrescripteurParDefaut === d.id;
              return (
                <div
                  key={d.id}
                  className={`flex items-center justify-between p-4 rounded-2xl border-2 transition-colors ${
                    isDefault ? 'border-teal-300 bg-teal-50' : 'border-slate-200 bg-white'
                  }`}
                >
                  <div>
                    <div className="font-extrabold text-slate-800 flex items-center gap-2 text-sm">
                      Dr. {d.prenom} {d.nom}
                      {isDefault && (
                        <span className="text-[10px] font-black text-teal-700 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          Signataire par défaut
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 font-medium mt-0.5">
                      {d.specialite}{d.numeroOrdre && ` · ${d.numeroOrdre}`}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleDefault(d)}
                      title={isDefault ? 'Retirer comme signataire par défaut' : 'Définir comme signataire par défaut'}
                      className={`p-2 rounded-xl transition-colors ${
                        isDefault
                          ? 'text-teal-600 bg-teal-100 hover:bg-teal-200'
                          : 'text-slate-400 hover:text-amber-500 hover:bg-amber-50'
                      }`}
                    >
                      {isDefault ? <Star className="w-4 h-4 fill-current" /> : <StarOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleDelete(d)}
                      className="p-2 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Supprimer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Section 2 : Médecins prescripteurs ─────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Users className="w-5 h-5 text-indigo-500" />
          <div>
            <h2 className="text-base font-bold text-slate-800">Médecins prescripteurs</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Médecins référents qui adressent les patients. Cette liste est proposée lors de la création ou modification d'un dossier.
            </p>
          </div>
        </div>

        {/* Champ d'ajout */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPrescripteur}
            onChange={(e) => setNewPrescripteur(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddPrescripteur()}
            placeholder="Dr. Nom Prénom…"
            disabled={addingPresc}
            className="flex-1 p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-indigo-400 bg-white disabled:opacity-50"
          />
          <button
            type="button"
            onClick={handleAddPrescripteur}
            disabled={addingPresc || !newPrescripteur.trim()}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </button>
        </div>

        {/* Liste prescripteurs */}
        {prescripteurs.length === 0 ? (
          <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="font-medium text-sm">Aucun prescripteur enregistré.</p>
            <p className="text-xs mt-1 text-slate-400">Les prescripteurs ajoutés dans les dossiers patients seront automatiquement sauvegardés ici.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {prescripteurs.map((name) => (
              <span
                key={name}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm font-medium"
              >
                {name}
                <button
                  type="button"
                  onClick={() => handleRemovePrescripteur(name)}
                  className="text-indigo-300 hover:text-red-500 transition-colors w-4 h-4 flex items-center justify-center"
                  aria-label={`Supprimer ${name}`}
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
