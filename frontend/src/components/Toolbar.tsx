import React from 'react';
import {
  RotateCcw,
  RotateCw,
  Trash2,
  Download,
  Camera,
  Zap,
  ArrowLeft,
} from 'lucide-react';
import { usePlannerStore } from '../store/plannerStore';

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
  } = usePlannerStore();

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

  return (
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
      </div>

      {/* Right: Loading indicator */}
      <div className="flex items-center gap-2 min-w-[80px] justify-end">
        {isAutoPackLoading && (
          <div className="flex items-center gap-2">
            <div className="animate-spin w-3.5 h-3.5 border-2 border-blue-500 border-t-transparent rounded-full" />
            <span className="text-xs text-gray-400">Processing...</span>
          </div>
        )}
        <div className="text-xs text-gray-500">
          {layoutItems.length} items
        </div>
      </div>
    </div>
  );
}
