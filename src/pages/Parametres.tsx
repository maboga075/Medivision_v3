import { useState, useEffect } from 'react';
import { Settings, Key, Shield, Eye, EyeOff, Save, CheckCircle } from 'lucide-react';
import type { AIConfig, AIProviderKey } from '../types/ai';

interface ProviderMeta {
  name: string;
  models: string[];
}

const PROVIDERS: Record<AIProviderKey, ProviderMeta> = {
  openai: {
    name: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  gemini: {
    name: 'Gemini',
    models: ['gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'],
  },
  anthropic: {
    name: 'Anthropic',
    models: ['claude-sonnet-4-6', 'claude-opus-4-7', 'claude-haiku-4-5-20251001'],
  },
  deepseek: {
    name: 'DeepSeek',
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
};

const DEFAULT_CONFIG: AIConfig = {
  activeEngine: 'gemini',
  openai: { apiKey: '', selectedModel: 'gpt-4o' },
  gemini: { apiKey: '', selectedModel: 'gemini-2.0-flash' },
  anthropic: { apiKey: '', selectedModel: 'claude-sonnet-4-6' },
  deepseek: { apiKey: '', selectedModel: 'deepseek-chat' },
};

export default function Parametres() {
  const [config, setConfig] = useState<AIConfig>(DEFAULT_CONFIG);
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('medivision_ai_config');
    if (saved) {
      try {
        setConfig(JSON.parse(saved) as AIConfig);
      } catch {
        console.error('Format de configuration invalide');
      }
    }
  }, []);

  const handleProviderChange = (providerKey: AIProviderKey, field: 'apiKey' | 'selectedModel', value: string) => {
    setConfig((prev) => ({
      ...prev,
      [providerKey]: { ...prev[providerKey], [field]: value },
    }));
  };

  const handleSave = () => {
    localStorage.setItem('medivision_ai_config', JSON.stringify(config));
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 h-full overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden mb-8">
        <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-extrabold text-slate-800 flex items-center gap-3">
              <Settings className="w-8 h-8 text-teal-600" />
              Paramètres IA
            </h1>
            <p className="text-slate-500 mt-2 font-medium">
              Configuration des fournisseurs d'IA. Les clés sont stockées localement sur ce poste.
            </p>
          </div>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-6 py-3 rounded-xl font-bold transition-colors shadow-sm"
          >
            {saveSuccess ? <CheckCircle className="w-5 h-5" /> : <Save className="w-5 h-5" />}
            {saveSuccess ? 'Sauvegardé' : 'Enregistrer'}
          </button>
        </div>

        <div className="p-6 sm:p-8 space-y-10">
          <section className="space-y-6">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
              <div className="p-2 bg-indigo-50 rounded-lg">
                <Key className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-800">Moteurs d'Intelligence Artificielle</h2>
                <p className="text-sm text-slate-500">
                  Choisissez le moteur actif et renseignez la clé API correspondante.
                </p>
              </div>
            </div>

            <div className="p-6 border-2 border-slate-200 rounded-3xl bg-slate-50 space-y-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-teal-600" />
                  <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">Moteur actif</span>
                </div>
                <select
                  value={config.activeEngine}
                  onChange={(e) => setConfig({ ...config, activeEngine: e.target.value as AIProviderKey })}
                  className="w-full md:w-1/2 px-5 py-4 rounded-2xl border-2 border-slate-200 bg-white text-lg font-bold text-slate-800 focus:outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-50"
                >
                  {(Object.entries(PROVIDERS) as [AIProviderKey, ProviderMeta][]).map(([key, provider]) => (
                    <option key={key} value={key}>{provider.name}</option>
                  ))}
                </select>
                <p className="text-sm text-slate-500 mt-2 ml-1">
                  Ce moteur sera utilisé pour l'analyse de tous les examens.
                </p>
              </div>

              <div className="border-t border-slate-200 pt-8 grid gap-8">
                {(Object.entries(PROVIDERS) as [AIProviderKey, ProviderMeta][]).map(([key, provider]) => (
                  <div
                    key={key}
                    className={`p-5 rounded-2xl border-2 transition-colors ${
                      config.activeEngine === key
                        ? 'border-teal-400 bg-teal-50/20 shadow-sm'
                        : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <div className={`w-3 h-3 rounded-full ${config.activeEngine === key ? 'bg-teal-500' : 'bg-slate-300'}`} />
                        {provider.name}
                        {config.activeEngine === key && (
                          <span className="text-[10px] font-black text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full uppercase tracking-wider">
                            Actif
                          </span>
                        )}
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Modèle</label>
                        <select
                          value={config[key]?.selectedModel ?? provider.models[0]}
                          onChange={(e) => handleProviderChange(key, 'selectedModel', e.target.value)}
                          className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 font-medium focus:outline-none focus:border-teal-500"
                        >
                          {provider.models.map((model) => (
                            <option key={model} value={model}>{model}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">Clé API</label>
                        <div className="relative">
                          <input
                            type={showKeys[key] ? 'text' : 'password'}
                            value={config[key]?.apiKey ?? ''}
                            onChange={(e) => handleProviderChange(key, 'apiKey', e.target.value)}
                            placeholder={`Clé ${provider.name}...`}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 bg-slate-50 text-slate-800 focus:outline-none focus:border-teal-500 pr-12 font-mono text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => setShowKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                          >
                            {showKeys[key] ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
