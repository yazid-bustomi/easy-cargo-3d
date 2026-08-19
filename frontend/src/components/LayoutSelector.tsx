import React, { useState, useEffect } from 'react';
import { usePlannerStore, PRESET_CONTAINERS, ContainerType } from '../store/plannerStore';
import { projectService } from '../services/api';
import { Search, Plus, FolderOpen, Trash2, AlertTriangle, Play } from 'lucide-react';

export function LayoutSelector() {
  const { setProjectConfig, aiApiKey, setAiApiKey, aiProvider, setAiProvider, loadProject, logout } = usePlannerStore();
  const [savedProjects, setSavedProjects] = useState<any[]>([]);

  // UI State
  const [activeTab, setActiveTab] = useState<'new' | 'open'>('new');
  const [searchTerm, setSearchTerm] = useState('');
  const [projectToDelete, setProjectToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // New Project State
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

  const handleDeleteConfirm = async () => {
    if (!projectToDelete) return;
    setIsDeleting(true);
    try {
      await projectService.delete(projectToDelete.id);
      await fetchProjects();
    } catch (error) {
      console.error('Failed to delete project', error);
      alert('Gagal menghapus project');
    } finally {
      setIsDeleting(false);
      setProjectToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();
    return `${day}-${month}-${year}`;
  };

  const filteredProjects = savedProjects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.containerName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-gray-950 via-gray-900 to-slate-900 flex items-center justify-center z-50 p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-emerald-600/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      <div className={`relative bg-gray-900/80 backdrop-blur-xl rounded-2xl p-8 w-full border border-gray-700/50 shadow-2xl shadow-black/50 transition-all duration-300 ${activeTab === 'open' ? 'max-w-6xl' : 'max-w-3xl'}`}>
        <div className="absolute top-4 right-4">
          <button onClick={logout} className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-lg text-xs font-medium transition-colors">
            Logout
          </button>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-2xl mb-4 shadow-lg shadow-blue-500/20">
            <span className="text-3xl">📦</span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Easy Cargo 3D</h1>
          <p className="text-gray-400 text-sm">Setup new project or open existing one</p>
        </div>

        {/* Tabs */}
        <div className="flex justify-center gap-4 mb-8">
          <button 
            onClick={() => setActiveTab('new')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'new' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20 transform scale-105' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <Plus className="w-5 h-5"/> Create New Project
          </button>
          <button 
            onClick={() => setActiveTab('open')} 
            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${
              activeTab === 'open' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20 transform scale-105' 
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50 hover:text-white'
            }`}
          >
            <FolderOpen className="w-5 h-5"/> Open Saved Project {savedProjects.length > 0 && `(${savedProjects.length})`}
          </button>
        </div>

        {/* TAB: NEW PROJECT */}
        {activeTab === 'new' && (
          <div className="max-w-xl mx-auto space-y-6">
            {/* Project Name */}
            <div>
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
            <div>
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
            <div className="space-y-3 bg-gray-800/50 p-4 rounded-xl border border-gray-700/50">
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
              className="w-full py-3.5 mt-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all transform hover:scale-[1.02] active:scale-[0.98] text-lg flex items-center justify-center gap-2"
            >
              Start Loading <Play className="w-5 h-5 fill-current" />
            </button>
          </div>
        )}

        {/* TAB: OPEN PROJECT */}
        {activeTab === 'open' && (
          <div className="flex flex-col h-[550px]">
            {/* Search Bar */}
            <div className="relative mb-6">
              <Search className="absolute left-4 top-3.5 text-gray-400 w-5 h-5"/>
              <input 
                type="text" 
                value={searchTerm} 
                onChange={e => setSearchTerm(e.target.value)} 
                placeholder="Search projects by name or container..." 
                className="w-full pl-12 pr-4 py-3 bg-gray-800/80 border border-gray-600/50 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all shadow-inner"
              />
            </div>
            
            {/* Data Table */}
            <div className="flex-1 overflow-auto rounded-xl border border-gray-700/50 bg-gray-800/30 custom-scrollbar shadow-inner relative">
              <table className="w-full text-left text-sm text-gray-300 whitespace-nowrap">
                <thead className="bg-gray-800/90 text-xs uppercase text-gray-400 sticky top-0 z-10 shadow-md">
                  <tr>
                    <th className="px-5 py-4 font-semibold tracking-wider">Project Name</th>
                    <th className="px-5 py-4 font-semibold tracking-wider">Container Type</th>
                    <th className="px-5 py-4 font-semibold tracking-wider">Container Size</th>
                    <th className="px-5 py-4 font-semibold tracking-wider text-right">Items</th>
                    <th className="px-5 py-4 font-semibold tracking-wider text-right">Weight (kg)</th>
                    <th className="px-5 py-4 font-semibold tracking-wider">Created</th>
                    <th className="px-5 py-4 font-semibold tracking-wider">Last Updated</th>
                    <th className="px-5 py-4 font-semibold tracking-wider text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                  {filteredProjects.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-5 py-12 text-center text-gray-500">
                        <div className="flex flex-col items-center justify-center">
                          <FolderOpen className="w-12 h-12 mb-3 text-gray-600" />
                          <p className="text-lg">No projects found</p>
                          {searchTerm && <p className="text-sm mt-1 text-gray-500">Try adjusting your search criteria</p>}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredProjects.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-700/30 transition-colors group">
                        <td className="px-5 py-4 font-medium text-white">{p.name}</td>
                        <td className="px-5 py-4">
                          <span className="inline-flex items-center px-2 py-1 rounded bg-gray-800 text-gray-300 text-xs font-medium border border-gray-600/30">
                            {p.containerName}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-gray-400">{p.containerSize || '-'}</td>
                        <td className="px-5 py-4 text-right tabular-nums">{p.itemCount}</td>
                        <td className="px-5 py-4 text-right tabular-nums text-emerald-400">{p.totalWeightKg?.toLocaleString()}</td>
                        <td className="px-5 py-4 text-gray-400">{formatDate(p.createdAt || p.created_at || p.updatedAt)}</td>
                        <td className="px-5 py-4 text-gray-400">{formatDate(p.updatedAt)}</td>
                        <td className="px-5 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => loadProject(p.id)}
                              className="px-4 py-1.5 bg-emerald-600/90 hover:bg-emerald-500 text-white text-xs font-medium rounded-lg transition-colors shadow-sm shadow-emerald-900/50 flex items-center gap-1.5"
                            >
                              <FolderOpen className="w-3.5 h-3.5" />
                              Open
                            </button>
                            <button
                              onClick={() => setProjectToDelete(p)}
                              className="p-1.5 bg-gray-800 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete Project"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {projectToDelete && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl p-6 w-[400px] shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-center w-12 h-12 bg-red-500/10 rounded-full mb-4 mx-auto">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete Project?</h3>
            <p className="text-gray-400 text-center text-sm mb-6">
              Are you sure you want to delete <strong>"{projectToDelete.name}"</strong>? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setProjectToDelete(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl transition-colors shadow-lg shadow-red-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

