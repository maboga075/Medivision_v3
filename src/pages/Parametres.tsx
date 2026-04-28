import { useState, useEffect } from 'react';
import { Settings, Key, Shield, Eye, EyeOff, Save, CheckCircle, Building2, Users, Layers, FileDown, Plus, X } from 'lucide-react';
import { useSettings } from '../hooks/useSettings';
import ClinicTab from '../components/settings/ClinicTab';
import DoctorsTab from '../components/settings/DoctorsTab';
import FormulaireTab from '../components/settings/FormulaireTab';
import ExportTab from '../components/settings/ExportTab';
import type { AIConfig, AIProviderKey } from '../types/ai';

/* ─── IA Config (existant) ──────────────────────────────────────── */

interface ProviderMeta { name: string; models: string[] }

const PROVIDERS: Record<AIProviderKey, ProviderMeta> = {
  openai: {
    name: 'OpenAI',
    models: [
      'gpt-4.1',
      'gpt-4.1-mini',
      'gpt-4.1-nano',
      'gpt-4o',
      'gpt-4o-mini',
      'o3',
      'o4-mini',
      'o1',
    ],
  },
  gemini: {
    name: 'Gemini',
    models: [
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-2.0-flash-lite',
      'gemini-1.5-pro',
    ],
  },
  anthropic: {
    name: 'Anthropic',
    models: [
      'claude-opus-4-7',
      'claude-sonnet-4-6',
      'claude-haiku-4-5-20251001',
    ],
  },
  deepseek: {
    name: 'DeepSeek',
    models: [
      'deepseek-chat',
      'deepseek-reasoner',
      'deepseek-v3',
      'deepseek-r1',
    ],
  },
};

const DEFAULT_CONFIG: AIConfig = {
  activeEngine: 'gemini',
  openai:    { apiKey: '', selectedModel: 'gpt-4.1' },
  gemini:    { apiKey: '', selectedModel: 'gemini-2.5-flash' },
  anthropic: { apiKey: '', selectedModel: 'claude-sonnet-4-6' },
  deepseek:  { apiKey: '', selectedModel: 'deepseek-chat' },
};

const CUSTOM_MODELS_KEY = 'medivision_custom_models';

function IATab() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [customModels, setCustomModels] = useState<Record<string, string[]>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [newModelId, setNewModelId] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('medivision_ai_config');
    if (saved) {
      try { setConfig(JSON.parse(saved) as AIConfig); } catch { /* ignore */ }
    }
    const custom = localStorage.getItem(CUSTOM_MODELS_KEY);
    if (custom) {
      try { setCustomModels(JSON.parse(custom) as Record<string, string[]>); } catch { /* ignore */ }
    }
  }, []);

  const handleProviderChange = (key: AIProviderKey, field: 'apiKey' | 'selectedModel', value: string) => {
    setConfig((p) => ({ ...p, [key]: { ...p[key], [field]: value } }));
  };

  const handleAddCustomModel = (providerKey: string) => {
    const id = newModelId.trim();
    if (!id) return;
    const allCurrent = [...(PROVIDERS[providerKey as AIProviderKey]?.models ?? []), ...(customModels[providerKey] ?? [])];
    if (allCurrent.includes(id)) {
      setNewModelId('');
      setAddingFor(null);
      return;
    }
    const updated = { ...customModels, [providerKey]: [...(customModels[providerKey] ?? []), id] };
    setCustomModels(updated);
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(updated));
    handleProviderChange(providerKey as AIProviderKey, 'selectedModel', id);
    setNewModelId('');
    setAddingFor(null);
  };

  const handleRemoveCustomModel = (providerKey: string, modelId: string) => {
    const updated = { ...customModels, [providerKey]: (customModels[providerKey] ?? []).filter((m) => m !== modelId) };
    setCustomModels(updated);
    localStorage.setItem(CUSTOM_MODELS_KEY, JSON.stringify(updated));
    if (config[providerKey as AIProviderKey]?.selectedModel === modelId) {
      handleProviderChange(providerKey as AIProviderKey, 'selectedModel', PROVIDERS[providerKey as AIProviderKey]?.models[0] ?? '');
    }
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
            Choisissez le moteur actif et renseignez la clé API. Les clés sont stockées localement.
          </p>
        </div>
      </div>

      <div className="p-5 border-2 border-slate-200 rounded-2xl bg-slate-50 space-y-6">
        {/* Moteur actif */}
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

        {/* Providers */}
        <div className="border-t border-slate-200 pt-5 grid gap-4">
          {(Object.entries(PROVIDERS) as [AIProviderKey, ProviderMeta][]).map(([key, provider]) => {
            const allModels = [...provider.models, ...(customModels[key] ?? [])];
            const isActive = config.activeEngine === key;

            return (
              <div
                key={key}
                className={`p-4 rounded-2xl border-2 transition-colors ${
                  isActive ? 'border-teal-400 bg-teal-50/30' : 'border-slate-200 bg-white'
                }`}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${isActive ? 'bg-teal-500' : 'bg-slate-300'}`} />
                  <h3 className="font-bold text-slate-800">{provider.name}</h3>
                  {isActive && (
                    <span className="text-[10px] font-black text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">Actif</span>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Sélecteur modèle + bouton + */}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Modèle</label>
                    <div className="flex gap-2">
                      <select
                        value={config[key]?.selectedModel ?? provider.models[0]}
                        onChange={(e) => handleProviderChange(key, 'selectedModel', e.target.value)}
                        className="flex-1 px-3 py-2.5 rounded-xl border-2 border-slate-200 bg-slate-50 text-sm font-bold focus:outline-none focus:border-teal-500 min-w-0"
                      >
                        {allModels.map((m) => (
                          <option key={m} value={m}>
                            {(customModels[key] ?? []).includes(m) ? `✦ ${m}` : m}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        title="Ajouter un identifiant de modèle"
                        onClick={() => { setAddingFor(addingFor === key ? null : key); setNewModelId(''); }}
                        className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border-2 transition-all active:scale-95 ${
                          addingFor === key
                            ? 'border-teal-400 bg-teal-50 text-teal-600'
                            : 'border-slate-200 text-slate-400 hover:border-teal-300 hover:text-teal-600'
                        }`}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Champ d'ajout inline */}
                    {addingFor === key && (
                      <div className="mt-2 flex gap-2 animate-in slide-in-from-top-1 duration-150">
                        <input
                          type="text"
                          value={newModelId}
                          onChange={(e) => setNewModelId(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCustomModel(key);
                            if (e.key === 'Escape') { setAddingFor(null); setNewModelId(''); }
                          }}
                          placeholder="ex: gpt-5, gemini-3-pro…"
                          autoFocus
                          className="flex-1 px-3 py-2 text-sm border-2 border-teal-300 rounded-xl outline-none focus:border-teal-500 font-mono bg-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCustomModel(key)}
                          disabled={!newModelId.trim()}
                          className="px-3 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold disabled:opacity-40 transition-colors"
                        >
                          OK
                        </button>
                      </div>
                    )}

                    {/* Modèles personnalisés avec suppression */}
                    {(customModels[key] ?? []).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(customModels[key] ?? []).map((m) => (
                          <span
                            key={m}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-mono rounded-lg"
                          >
                            {m}
                            <button
                              type="button"
                              onClick={() => handleRemoveCustomModel(key, m)}
                              className="text-indigo-300 hover:text-red-500 transition-colors"
                              aria-label={`Supprimer ${m}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clé API */}
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
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
        >
          {saveSuccess ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          {saveSuccess ? 'Sauvegardé !' : 'Enregistrer les clés API'}
        </button>
        <p className="text-xs text-slate-400">
          Les modèles marqués <span className="font-mono text-indigo-600">✦</span> sont des identifiants personnalisés.
        </p>
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
              {activeTab === 'doctors'    && <DoctorsTab />}
              {activeTab === 'formulaire' && <FormulaireTab />}
              {activeTab === 'export'     && <ExportTab />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
