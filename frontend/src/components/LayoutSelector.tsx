import React, { useState, useEffect } from 'react';
import { usePlannerStore, PRESET_CONTAINERS, ContainerType } from '../store/plannerStore';
import { projectService } from '../services/api';

export function LayoutSelector() {
  const { setProjectConfig, aiApiKey, setAiApiKey, aiProvider, setAiProvider, loadProject, logout } = usePlannerStore();
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  const [projectName, setProjectName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<number>(PRESET_CONTAINERS[0].id);
  const [useCustom, setUseCustom] = useState(false);
  const [customContainer, setCustomContainer] = useState({
    name: 'Custom Container',
    length_cm: 600,
    width_cm: 240,
    height_cm: 260,
    max_payload_kg: 26000,
  });

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await projectService.getAll();
      if (res.data.success) {
        setSavedProjects(res.data.data);
      }
    } catch (err) {
      console.error('Failed to fetch projects', err);
    }
  };

  const handleSave = () => {
    if (!projectName.trim()) return;

    let container: ContainerType;

    if (useCustom) {
      container = {
        id: 999,
        code: 'CUSTOM',
        name: customContainer.name,
        length_cm: customContainer.length_cm,
        width_cm: customContainer.width_cm,
        height_cm: customContainer.height_cm,
        max_payload_kg: customContainer.max_payload_kg,
        tare_weight_kg: 0,
        is_system: false,
      };
    } else {
      container = PRESET_CONTAINERS.find((c) => c.id === selectedPreset) || PRESET_CONTAINERS[0];
    }

    setProjectConfig({
      name: projectName,
      containerType: container,
    });
  };

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center z-50">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 max-w-4xl w-full mx-4 border border-gray-700/50 shadow-2xl shadow-black/50">
        <div className="absolute top-4 right-4">
          <button onClick={logout} className="px-3 py-1.5 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg text-xs transition-colors">
            Logout
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <span className="text-3xl">📦</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Easy Cargo 3D</h1>
          <p className="text-gray-400 text-sm">Setup new project or open existing one</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* LEFT: New Project */}
          <div>
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-blue-400">⊕</span> Create New Project
            </h2>


        {/* Project Name */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => setProjectName(e.target.value)}
            placeholder="Enter project name..."
            className="w-full px-4 py-3 bg-gray-800/80 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
            autoFocus
          />
        </div>

        {/* Container Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Container Type
          </label>

          {/* Toggle preset/custom */}
          <div className="flex gap-2 mb-3">
            <button
              onClick={() => setUseCustom(false)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                !useCustom
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
            >
              Standard Container
            </button>
            <button
              onClick={() => setUseCustom(true)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                useCustom
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-750'
              }`}
            >
              Custom Size
            </button>
          </div>

          {!useCustom ? (
            <div className="grid grid-cols-2 gap-2">
              {PRESET_CONTAINERS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedPreset(c.id)}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    selectedPreset === c.id
                      ? 'bg-blue-600/20 border-blue-500 shadow-lg shadow-blue-500/10'
                      : 'bg-gray-800/50 border-gray-700/50 hover:border-gray-600'
                  }`}
                >
                  <div className="text-sm font-semibold text-white">{c.name}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {c.length_cm} × {c.width_cm} × {c.height_cm} cm
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">
                    Max: {(c.max_payload_kg / 1000).toFixed(1)}T
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="space-y-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
              <input
                type="text"
                value={customContainer.name}
                onChange={(e) => setCustomContainer({ ...customContainer, name: e.target.value })}
                placeholder="Container name"
                className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
              />
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Length (cm)</label>
                  <input
                    type="number"
                    value={customContainer.length_cm}
                    onChange={(e) => setCustomContainer({ ...customContainer, length_cm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Width (cm)</label>
                  <input
                    type="number"
                    value={customContainer.width_cm}
                    onChange={(e) => setCustomContainer({ ...customContainer, width_cm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Height (cm)</label>
                  <input
                    type="number"
                    value={customContainer.height_cm}
                    onChange={(e) => setCustomContainer({ ...customContainer, height_cm: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Max Payload (kg)</label>
                <input
                  type="number"
                  value={customContainer.max_payload_kg}
                  onChange={(e) => setCustomContainer({ ...customContainer, max_payload_kg: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-blue-500/50"
                />
              </div>
            </div>
          )}
        </div>

        {/* AI API Key Setup */}
        <div className="mb-6 space-y-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Provider (For AI Auto-Pack)
            </label>
            <div className="flex gap-2">
              <button
                onClick={() => setAiProvider('gemini')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  aiProvider === 'gemini'
                    ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/20'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-750'
                }`}
              >
                Gemini (Free)
              </button>
              <button
                onClick={() => setAiProvider('openai')}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  aiProvider === 'openai'
                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
                    : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-750'
                }`}
              >
                OpenAI
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">API Key</label>
            <input
              type="password"
              value={aiApiKey}
              onChange={(e) => setAiApiKey(e.target.value)}
              placeholder={`Enter ${aiProvider === 'gemini' ? 'Gemini' : 'OpenAI'} API Key...`}
              className="w-full px-3 py-2 bg-gray-900/80 border border-gray-600/50 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500/50"
            />
          </div>
        </div>

          {/* Save Button */}
          <button
            onClick={handleSave}
            disabled={!projectName.trim()}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
          >
            Start Loading →
          </button>
        </div>

        {/* RIGHT: Saved Projects */}
        <div className="flex flex-col h-[500px]">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-emerald-400">📂</span> Open Project
          </h2>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
            {savedProjects.length === 0 ? (
              <div className="text-center text-gray-500 text-sm mt-10">
                Belum ada project yang tersimpan
              </div>
            ) : (
              savedProjects.map((p) => (
                <div key={p.id} className="bg-gray-800/60 border border-gray-700/50 rounded-xl p-4 hover:border-blue-500/50 transition-colors group">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-white truncate pr-2">{p.name}</h3>
                    <button
                      onClick={() => loadProject(p.id)}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Open
                    </button>
                  </div>
                  <div className="text-xs text-gray-400 space-y-1">
                    <p>Container: {p.containerName} ({p.containerSize})</p>
                    <p>Items: {p.itemCount} pcs | Weight: {p.totalWeightKg.toLocaleString()} kg</p>
                    <p className="text-[10px] text-gray-500 mt-2">
                      Updated: {new Date(p.updatedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
