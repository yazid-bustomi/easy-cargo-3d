import React, { useState } from 'react';
import { usePlannerStore, PRESET_CONTAINERS, ContainerType } from '../store/plannerStore';

export function LayoutSelector() {
  const { setProjectConfig } = usePlannerStore();

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

      <div className="relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 max-w-lg w-full mx-4 border border-gray-700/50 shadow-2xl shadow-black/50">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <span className="text-3xl">📦</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Easy Cargo 3D</h1>
          <p className="text-gray-400 text-sm">Setup your project to begin loading</p>
        </div>

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

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={!projectName.trim()}
          className="w-full py-3 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98]"
        >
          Save & Start Loading →
        </button>
      </div>
    </div>
  );
}
