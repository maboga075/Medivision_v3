import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, UserRound, Clock, CheckCircle, Stethoscope, FolderOpen } from 'lucide-react';
import { db, collection, query, orderBy, limit, getDocs, doc, updateDoc, serverTimestamp } from '../services/firebase';
import { useConsultationDrafts } from '../hooks/useConsultationDrafts';
import { useToast } from '../components/shared/ToastProvider';
import { calculateAge } from '../utils/age';
import type { PatientFirestore } from '../types/patient';

// Plafond de lecture pour éviter de charger toute la collection (coût/latence).
const PATIENTS_FETCH_LIMIT = 300;

export default function Patients() {
  const navigate = useNavigate();
  const { deleteDraft } = useConsultationDrafts();
  const { notify } = useToast();

  const [patients, setPatients] = useState<PatientFirestore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAll() {
      try {
        const q = query(collection(db, 'patients'), orderBy('createdAt', 'desc'), limit(PATIENTS_FETCH_LIMIT));
        const snap = await getDocs(q);
        const list: PatientFirestore[] = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<PatientFirestore, 'id' | 'date'>),
          date: d.data().createdAt ? d.data().createdAt.toDate() : new Date(),
        }));
        setPatients(list);
      } catch (err) {
        console.error('[Patients] Erreur chargement:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchAll();
  }, []);

  const filtered = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return patients;
    return patients.filter(
      (p) =>
        p.nom.toLowerCase().includes(term) ||
        (p.folderId ?? '').toLowerCase().includes(term)
    );
  }, [patients, searchTerm]);

  const handleNewConsultation = async (patient: PatientFirestore) => {
    if (patient.statut === 'en_attente') {
      navigate('/consultation');
      return;
    }
    setActionLoading(patient.id);
    try {
      // Remettre en salle d'attente avec un nouveau timestamp (apparaît en tête de liste)
      await updateDoc(doc(db, 'patients', patient.id), {
        statut: 'en_attente',
        createdAt: serverTimestamp(),
      });
      // Effacer le brouillon de la consultation précédente
      deleteDraft(patient.id);
      navigate('/consultation');
    } catch (err) {
      console.error('[Patients] Erreur nouvelle consultation:', err);
      notify('Erreur lors de la mise à jour du patient.', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-slate-50">
      <div className="max-w-5xl mx-auto p-6 lg:p-8 space-y-6">

        {/* En-tête */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
              <div className="p-2 bg-teal-50 rounded-xl">
                <UserRound className="w-6 h-6 text-teal-600" />
              </div>
              Patients
            </h1>
            <p className="text-slate-500 text-sm font-medium mt-1">
              Historique complet — retrouvez un patient et démarrez une nouvelle consultation.
            </p>
          </div>
          <span className="self-start sm:self-auto bg-teal-100 text-teal-800 text-sm font-bold px-4 py-2 rounded-full">
            {patients.length} patient{patients.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Barre de recherche */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher par nom ou numéro de dossier…"
            className="w-full pl-11 pr-4 py-3 border-2 border-slate-200 rounded-2xl text-sm font-medium bg-white outline-none focus:border-teal-500 transition-colors"
          />
          {searchTerm && (
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">
              {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Contenu */}
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            <span className="font-medium">Chargement des patients…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-slate-400">
            <UserRound className="w-14 h-14 mx-auto mb-4 opacity-30" />
            <p className="font-medium text-lg">
              {searchTerm ? 'Aucun patient ne correspond à la recherche.' : 'Aucun patient enregistré.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filtered.map((patient) => {
              const isWaiting = patient.statut === 'en_attente';
              const age = patient.age ?? calculateAge(patient.dateNaissance);
              const isLoading = actionLoading === patient.id;
              return (
                <div
                  key={patient.id}
                  className={`bg-white rounded-2xl border-2 p-5 transition-all ${
                    isWaiting ? 'border-teal-200' : 'border-slate-200'
                  }`}
                >
                  {/* En-tête carte */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-slate-800">{patient.nom}</h3>
                      <p className="text-slate-500 text-sm font-medium">{age} ans</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      {patient.folderId && (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <FolderOpen className="w-3 h-3" /> {patient.folderId}
                        </span>
                      )}
                      {isWaiting ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 bg-teal-100 px-2.5 py-1 rounded-lg">
                          <Clock className="w-3 h-3" /> En salle d'attente
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg">
                          <CheckCircle className="w-3 h-3" /> Traité
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Motifs */}
                  {patient.motifs?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {patient.motifs.map((m) => (
                        <span key={m} className="text-xs font-bold text-orange-700 bg-orange-50 border border-orange-100 px-2.5 py-1 rounded-lg">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Antécédents */}
                  {patient.antecedents?.length > 0 && (
                    <p className="text-xs text-slate-500 font-medium mb-4 leading-relaxed">
                      <span className="font-bold text-slate-600">Atcd :</span>{' '}
                      {patient.antecedents.join(', ')}
                    </p>
                  )}

                  {/* Action */}
                  <button
                    onClick={() => handleNewConsultation(patient)}
                    disabled={isLoading}
                    className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all active:scale-95 disabled:opacity-60 ${
                      isWaiting
                        ? 'bg-teal-50 border-2 border-teal-300 text-teal-700 hover:bg-teal-100'
                        : 'bg-teal-600 hover:bg-teal-700 text-white'
                    }`}
                  >
                    {isLoading ? (
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Stethoscope className="w-4 h-4" />
                    )}
                    {isLoading ? 'Mise à jour…' : isWaiting ? 'Aller à la consultation' : 'Nouvelle consultation'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
