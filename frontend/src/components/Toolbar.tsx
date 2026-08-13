import React, { useState } from 'react';
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Camera,
  Zap,
  ArrowLeft,
  FileText,
  Bot,
  X
} from 'lucide-react';
import { usePlannerStore } from '../store/plannerStore';
import { generatePDFReport, imageUrlToBase64 } from '../utils/reportGenerator';

export function Toolbar() {
  const {
    projectConfig,
    goBackToSetup,
    clearLayoutItems,
    history,
    historyIndex,
    undo,
    redo,
    isAutoPackLoading,
    layoutItems,
    products,
    autoPackAll,
    getLayoutStats,
    setCameraView,
    aiAutoPack,
    aiApiKey,
  } = usePlannerStore();

  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleExportPNG = () => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = `${projectConfig?.name || 'layout'}-${new Date().toISOString().split('T')[0]}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleAutoPack = () => {
    if (products.length === 0) {
      alert('Tambahkan product terlebih dahulu!');
      return;
    }
    autoPackAll();
  };

  const handleGeneratePDF = async () => {
    if (!projectConfig || layoutItems.length === 0) {
      alert('Masukkan product ke container terlebih dahulu!');
      return;
    }

    setIsGeneratingReport(true);

    try {
      // Load logo as base64
      const logoBase64 = await imageUrlToBase64('/label-logo.jpg');
      const stats = getLayoutStats();

      // Capture Right View
      setCameraView('right');
      await new Promise(r => setTimeout(r, 2000));
      const canvas = document.querySelector('canvas') as HTMLCanvasElement;
      if (!canvas) throw new Error('Canvas not found');
      const rightViewImage = canvas.toDataURL('image/png');

      // Capture Left View
      setCameraView('left');
      await new Promise(r => setTimeout(r, 2000));
      const leftViewImage = canvas.toDataURL('image/png');

      // Reset camera
      setCameraView('default');

      // Generate Report
      await generatePDFReport({
        projectConfig,
        products,
        layoutItems,
        stats,
        rightViewImage,
        leftViewImage,
        logoBase64,
      });

    } catch (error) {
      console.error('Report generation error:', error);
      alert('Gagal generate Report: ' + (error as any).message);
    } finally {
      setIsGeneratingReport(false);
    }
  };

  const handleAiPackConfirm = async () => {
    setIsAiModalOpen(false);
    await aiAutoPack(aiPrompt);
  };

  return (
    <>
      <div className="h-12 bg-gray-900/95 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4 gap-3 flex-shrink-0">
      {/* Left: Back + Project name */}
      <div className="flex items-center gap-3">
        <button
          onClick={goBackToSetup}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg text-sm transition-all"
          title="Back to Project Setup"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline text-xs">Setup</span>
        </button>
        {projectConfig && (
          <div className="text-sm">
            <span className="text-white font-medium">{projectConfig.name}</span>
            <span className="text-gray-500 ml-2 text-xs">{projectConfig.containerType.name}</span>
          </div>
        )}
      </div>

      {/* Center: Tools */}
      <div className="flex items-center gap-1">
        <button
          onClick={undo}
          disabled={!canUndo || isAutoPackLoading}
          className="p-2 rounded-lg transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Undo"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={redo}
          disabled={!canRedo || isAutoPackLoading}
          className="p-2 rounded-lg transition-colors text-blue-400 hover:text-blue-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Redo"
        >
          <RotateCw className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1.5" />

        <button
          onClick={handleAutoPack}
          disabled={isAutoPackLoading || products.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-amber-600/20"
          title="Auto Pack — otomatis susun semua product ke container"
        >
          <Zap className="w-3.5 h-3.5" />
          Auto Pack
        </button>

        {/* AI Pack Button */}
        <button
          onClick={() => {
            if (!aiApiKey) {
              alert('Silahkan atur AI API Key di halaman Setup terlebih dahulu.');
              return;
            }
            if (products.length === 0) {
              alert('Tambahkan product terlebih dahulu!');
              return;
            }
            setIsAiModalOpen(true);
          }}
          disabled={isAutoPackLoading || products.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-500 hover:to-fuchsia-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-purple-600/20"
          title="AI Pack — susun otomatis menggunakan AI (Gemini/OpenAI)"
        >
          <Bot className="w-3.5 h-3.5" />
          AI Pack
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1.5" />

        <button
          onClick={clearLayoutItems}
          disabled={isAutoPackLoading || layoutItems.length === 0}
          className="p-2 rounded-lg transition-colors text-red-400 hover:text-red-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Clear All Items"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1.5" />

        <button
          onClick={handleExportPNG}
          disabled={isAutoPackLoading}
          className="p-2 rounded-lg transition-colors text-purple-400 hover:text-purple-300 hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Export PNG"
        >
          <Camera className="w-4 h-4" />
        </button>

        {/* Print Report Button */}
        <button
          onClick={handleGeneratePDF}
          disabled={isAutoPackLoading || isGeneratingReport || layoutItems.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm shadow-emerald-600/20"
          title="Print Report (2 pages — Left & Right view)"
        >
          <FileText className="w-3.5 h-3.5" />
          {isGeneratingReport ? 'Preparing...' : 'Print Report'}
        </button>
      </div>

      {/* Right: Loading indicator */}
      <div className="flex items-center gap-2 min-w-[80px] justify-end">
        {(isAutoPackLoading || isGeneratingReport) && (
          <div className="flex items-center gap-2">
            <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-xs text-gray-400">
              {isGeneratingReport ? 'Preparing Report...' : 'Processing...'}
            </span>
          </div>
        )}
        <div className="text-xs text-gray-500">
          {layoutItems.length} items
        </div>
      </div>
    </div>

    {/* AI Pack Modal */}
    {isAiModalOpen && (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 w-[400px] shadow-2xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-purple-400" />
              AI Auto-Pack
            </h3>
            <button onClick={() => setIsAiModalOpen(false)} className="text-gray-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Custom Instructions (Optional)
            </label>
            <textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="e.g. Tables with thin legs must go on top. Do not stack fragile items."
              className="w-full h-24 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:ring-1 focus:ring-purple-500 focus:border-purple-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => setIsAiModalOpen(false)}
              className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg text-sm transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAiPackConfirm}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-purple-600/20"
            >
              Start AI Packing
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
