import { useState, useEffect } from 'react';
import { Settings, Key, Shield, Eye, EyeOff, Save, CheckCircle, Building2, Users, Layers, FileDown } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import ClinicTab from '../components/settings/ClinicTab';
import DoctorsTab from '../components/settings/DoctorsTab';
import FormulaireTab from '../components/settings/FormulaireTab';
import ExportTab from '../components/settings/ExportTab';
import type { AIConfig, AIProviderKey } from '../types/ai';

/* ─── IA Config (existant) ──────────────────────────────────────── */

interface ProviderMeta { name: string; models: string[] }

const PROVIDERS: Record<AIProviderKey, ProviderMeta> = {
  openai:    { name: 'OpenAI',    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'] },
  gemini:    { name: 'Gemini',    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'] },
  anthropic: { name: 'Anthropic', models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'] },
  deepseek:  { name: 'DeepSeek',  models: ['deepseek-chat', 'deepseek-reasoner'] },
};

const DEFAULT_CONFIG: AIConfig = {
  activeEngine: 'gemini',
  openai:    { apiKey: '', selectedModel: 'gpt-4o' },
  gemini:    { apiKey: '', selectedModel: 'gemini-2.0-flash' },
  anthropic: { apiKey: '', selectedModel: 'claude-sonnet-4-6' },
  deepseek:  { apiKey: '', selectedModel: 'deepseek-chat' },
};

function IATab() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('medivision_ai_config');
    if (saved) {
      try { setConfig(JSON.parse(saved) as AIConfig); } catch { /* ignore */ }
    }
  }, []);

  const handleProviderChange = (key: AIProviderKey, field: 'apiKey' | 'selectedModel', value: string) => {
    setConfig((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  };

  const handleSave = () => {
    localStorage.setItem('medivision_ai_config', JSON.stringify(config));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-indigo-50 rounded-xl">
          <Key className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Moteurs d'Intelligence Artificielle</h2>
          <p className="text-sm text-slate-500">
            Choisissez le moteur actif et renseignez la clé API correspondante. Les clés sont stockées localement.
          </p>
        </div>
      </div>

      <div className="p-5 border-2 border-slate-200 rounded-2xl bg-slate-50 space-y-6">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">Moteur actif</span>
          </div>
          <select
            value={config.activeEngine}
            onChange={(e) => setConfig({ ...config, activeEngine: e.target.value as AIProviderKey })}
            className="w-full md:w-1/2 px-4 py-3 rounded-xl border-2 border-slate-200 bg-white text-sm font-bold text-slate-800 focus:outline-none focus:border-teal-500"
          >
            {(Object.entries(PROVIDERS) as [AIProviderKey, ProviderMeta][]).map(([k, p]) => (
              <option key={k} value={k}>{p.name}</option>
            ))}
          </select>
        </div>

        <div className="border-t border-slate-200 pt-5 grid gap-4">
          {(Object.entries(PROVIDERS) as [AIProviderKey, ProviderMeta][]).map(([key, provider]) => (
            <div
              key={key}
              className={`p-4 rounded-2xl border-2 transition-colors ${
                config.activeEngine === key ? 'border-teal-400 bg-teal-50/30' : 'border-slate-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2.5 h-2.5 rounded-full ${config.activeEngine === key ? 'bg-teal-500' : 'bg-slate-300'}`} />
                <h3 className="font-bold text-slate-800">{provider.name}</h3>
                {config.activeEngine === key && (
                  <span className="text-[10px] font-black text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Modèle</label>
                  <select
                    value={config[key]?.selectedModel ?? provider.models[0]}
                    onChange={(e) => handleProviderChange(key, 'selectedModel', e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:border-teal-500"
                  >
                    {provider.models.map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Clé API</label>
                  <div className="relative">
                    <input
                      type={showKeys[key] ? 'text' : 'password'}
                      value={config[key]?.apiKey ?? ''}
                      onChange={(e) => handleProviderChange(key, 'apiKey', e.target.value)}
                      placeholder={`Clé ${provider.name}…`}
                      className="w-full px-3 py-2.5 pr-10 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm font-mono focus:outline-none focus:border-teal-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowKeys((p) => ({ ...p, [key]: !p[key] }))}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      {showKeys[key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
        >
          {saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? 'Sauvegardé !' : 'Enregistrer les clés API'}
        </button>
      </div>
    </div>
  );
}

/* ─── Page principale ────────────────────────────────────────────── */

type TabKey = 'ia' | 'clinic' | 'doctors' | 'formulaire' | 'export';

interface TabMeta { label: string; icon: React.ReactNode }

const TABS: Record<TabKey, TabMeta> = {
  ia:         { label: 'IA',          icon: <Key className="w-4 h-4" /> },
  clinic:     { label: 'Clinique',    icon: <Building2 className="w-4 h-4" /> },
  doctors:    { label: 'Médecins',    icon: <Users className="w-4 h-4" /> },
  formulaire: { label: 'Formulaire',  icon: <Layers className="w-4 h-4" /> },
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
              {activeTab === 'doctors'    && <DoctorsTab    settings={settings} />}
              {activeTab === 'formulaire' && <FormulaireTab settings={settings} />}
              {activeTab === 'export'     && <ExportTab     settings={settings} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
