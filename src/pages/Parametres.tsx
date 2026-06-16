import { useState, useEffect } from 'react';
import { Settings, Key, Shield, Building2, Users, Layers, FileDown, Palette, Activity } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import ClinicTab from '../components/settings/ClinicTab';
import DoctorsTab from '../components/settings/DoctorsTab';
import FormulaireTab from '../components/settings/FormulaireTab';
import ExportTab from '../components/settings/ExportTab';
import LesionsTab from '../components/settings/LesionsTab';
import PatternsTab from '../components/settings/PatternsTab';

/* ─── IA Config ──────────────────────────────────────────────────── */

interface ServerAIStatus {
  configured: boolean;
  provider?: string;
  model?: string;
  error?: string;
}

function IATab() {
  const [status, setStatus] = useState<ServerAIStatus | null>(null);
  const [checking, setChecking] = useState(false);

  const checkStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch('/api/ai/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ __ping: true }),
      });
      if (!res.ok) {
        const body = await res.json() as { error: string };
        setStatus({ configured: false, error: body.error });
      } else {
        const body = await res.json() as ServerAIStatus;
        setStatus({
          configured: true,
          provider: body.provider,
          model: body.model,
        });
      }
    } catch {
      setStatus({ configured: false, error: 'Impossible de joindre le serveur IA.' });
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => { void checkStatus(); }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Key className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Moteur d'Intelligence Artificielle</h2>
          <p className="text-sm text-slate-500">
            La configuration IA est gérée par variables d'environnement côté serveur.
          </p>
        </div>
      </div>

      <div className="p-5 border-2 border-slate-200 rounded-2xl bg-slate-50 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-teal-600" />
          <span className="text-xs font-black text-slate-700 uppercase tracking-wider">État du serveur IA</span>
        </div>

        {status === null && !checking && (
          <p className="text-sm text-slate-400 font-medium">Non vérifié.</p>
        )}

        {checking && (
          <div className="flex items-center gap-3 text-slate-500 text-sm font-medium">
            <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            Vérification en cours…
          </div>
        )}

        {status && !checking && (
          status.configured ? (
            <div className="flex items-start gap-3 p-4 bg-teal-50 border border-teal-200 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-teal-500 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-bold text-teal-800">Serveur IA opérationnel</p>
                <p className="text-xs text-teal-600 mt-0.5">
                  {status.provider && status.model
                    ? `${status.provider} · ${status.model}`
                    : "Le moteur est configuré via les variables d'environnement du serveur."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 mt-1 shrink-0" />
              <div>
                <p className="text-sm font-bold text-red-800">Configuration IA serveur requise</p>
                {status.error && (
                  <p className="text-xs text-red-600 mt-0.5">{status.error}</p>
                )}
              </div>
            </div>
          )
        )}

        <button
          onClick={() => void checkStatus()}
          disabled={checking}
          className="text-xs font-bold text-slate-500 hover:text-teal-600 underline underline-offset-2 disabled:opacity-40 transition-colors"
        >
          Vérifier à nouveau
        </button>
      </div>

      <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-sm">
        <p className="font-bold text-amber-800 mb-1">Configuration requise</p>
        <p className="text-amber-700 text-xs leading-relaxed">
          Définissez les variables <code className="font-mono bg-amber-100 px-1 rounded">AI_PROVIDER</code>,{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">AI_MODEL</code> et la clé correspondante
          (<code className="font-mono bg-amber-100 px-1 rounded">GEMINI_API_KEY</code>,{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">OPENAI_API_KEY</code>,{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">ANTHROPIC_API_KEY</code> ou{' '}
          <code className="font-mono bg-amber-100 px-1 rounded">DEEPSEEK_API_KEY</code>)
          dans les variables d'environnement du serveur ou le fichier <code className="font-mono bg-amber-100 px-1 rounded">.env.local</code>.
        </p>
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────── */

type TabKey = 'ia' | 'clinic' | 'doctors' | 'formulaire' | 'lesions' | 'patterns' | 'export';

interface TabMeta { label: string; icon: React.ReactNode }

const TABS: Record<TabKey, TabMeta> = {
  ia:         { label: 'IA',          icon: <Key      className="w-4 h-4" /> },
  clinic:     { label: 'Clinique',    icon: <Building2 className="w-4 h-4" /> },
  doctors:    { label: 'Médecins',    icon: <Users    className="w-4 h-4" /> },
  formulaire: { label: 'Formulaire',  icon: <Layers   className="w-4 h-4" /> },
  lesions:    { label: 'Lésions',     icon: <Palette  className="w-4 h-4" /> },
  patterns:   { label: 'Formes clin.',icon: <Activity className="w-4 h-4" /> },
  export:     { label: 'Export',      icon: <FileDown className="w-4 h-4" /> },
};

export default function Parametres() {
  const [activeTab, setActiveTab] = useState<TabKey>('ia');
  const { settings, loading, error } = useSettings();

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* En-tête */}
        <div className="p-6 bg-slate-50 border-b border-slate-200">
          <h1 className="text-2xl font-extrabold text-slate-800 flex items-center gap-3">
            <Settings className="w-7 h-7 text-teal-600" />
            Paramètres
          </h1>
          <p className="text-slate-500 mt-1 text-sm font-medium">
            Configuration de la clinique, des médecins, du formulaire et de l'IA.
          </p>
        </div>

        {/* Onglets */}
        <div className="flex gap-1 px-6 pt-4 border-b border-slate-200 overflow-x-auto">
          {(Object.entries(TABS) as [TabKey, TabMeta][]).map(([key, { label, icon }]) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-bold rounded-t-xl border-b-2 transition-all whitespace-nowrap ${
                activeTab === key
                  ? 'border-teal-500 text-teal-700 bg-teal-50'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {/* Contenu */}
        <div className="p-6 sm:p-8">
          {activeTab === 'ia' && <IATab />}

          {activeTab !== 'ia' && loading && (
            <div className="flex items-center justify-center py-16 text-slate-400 gap-3">
              <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              <span className="font-medium">Chargement des paramètres…</span>
            </div>
          )}

          {activeTab !== 'ia' && !loading && error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl text-sm font-medium">
              Erreur : {error}
            </div>
          )}

          {activeTab !== 'ia' && !loading && !error && settings && (
            <>
              {activeTab === 'clinic'     && <ClinicTab     settings={settings} />}
              {activeTab === 'doctors'    && <DoctorsTab />}
              {activeTab === 'formulaire' && <FormulaireTab />}
              {activeTab === 'lesions'    && <LesionsTab />}
              {activeTab === 'patterns'   && <PatternsTab />}
              {activeTab === 'export'     && <ExportTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
