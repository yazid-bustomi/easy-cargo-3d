import React from 'react';
import { Box, Layers, Truck, ArrowUp, ArrowLeft, ArrowRight } from 'lucide-react';
import { usePlannerStore } from '../store/plannerStore';

export function ContainerStatsOverlay() {
  const { projectConfig, getLayoutStats, cameraView, setCameraView } = usePlannerStore();

  const container = projectConfig?.containerType;
  if (!container) return null;

  const stats = getLayoutStats();

  const containerVolM3 = stats.containerVolume / 1_000_000;
  const usedVolM3 = stats.usedVolume / 1_000_000;

  return (
    <div className="absolute top-4 right-4 z-40 flex flex-col items-end gap-3">
      {/* Stats Table */}
      <div className="text-right text-gray-700 bg-gray-200/90 backdrop-blur-md rounded px-4 py-2 text-sm shadow-sm font-medium" style={{ fontFamily: 'sans-serif' }}>
        <div className="mb-2 font-bold text-gray-900 border-b border-gray-400 pb-1">
          Container {container.name} ({container.length_cm} cm x {container.width_cm} cm x {container.height_cm} cm)
        </div>
        
        <table className="w-full text-right" style={{ borderSpacing: '8px 4px', borderCollapse: 'separate' }}>
          <thead>
            <tr className="text-gray-600 text-xs">
              <th></th>
              <th className="font-bold">Weight:</th>
              <th className="font-bold">Volume:</th>
              <th className="font-bold">Free meters:</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="text-center w-6">
                <Truck className="w-4 h-4 mx-auto text-gray-500" />
              </td>
              <td>{container.max_payload_kg.toLocaleString()} kg</td>
              <td>{containerVolM3.toFixed(2)} m³</td>
              <td>{(container.length_cm / 100).toFixed(2)} m</td>
            </tr>
            <tr>
              <td className="text-center w-6">
                <Box className="w-4 h-4 mx-auto text-gray-500" />
              </td>
              <td>{stats.totalWeight.toLocaleString()} kg</td>
              <td>{usedVolM3.toFixed(2)} m³</td>
              <td></td>
            </tr>
            <tr className="font-bold text-gray-900">
              <td className="text-center w-6">
                <Layers className="w-4 h-4 mx-auto text-gray-700" />
              </td>
              <td>{stats.totalWeight.toLocaleString()} kg</td>
              <td>{usedVolM3.toFixed(2)} m³</td>
              <td>{stats.freeMeters.toFixed(2)} m</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Camera Views */}
      <div className="bg-gray-200/90 backdrop-blur-md rounded px-2 py-1.5 flex flex-col gap-1 shadow-sm">
        <div className="text-xs text-gray-600 font-bold mb-1 px-1">Views</div>
        <button 
          onClick={() => setCameraView('right')}
          className={`flex items-center justify-center p-2 rounded transition-colors ${cameraView === 'right' ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-300'}`}
          title="Right View"
        >
          <Truck className="w-6 h-6 text-gray-700" />
        </button>
        <button 
          onClick={() => setCameraView('left')}
          className={`flex items-center justify-center p-2 rounded transition-colors ${cameraView === 'left' ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-300'}`}
          style={{ transform: 'scaleX(-1)' }}
          title="Left View"
        >
          <Truck className="w-6 h-6 text-gray-700" />
        </button>
        <button 
          onClick={() => setCameraView('top')}
          className={`flex items-center justify-center p-2 rounded transition-colors ${cameraView === 'top' ? 'bg-gray-300 shadow-inner' : 'hover:bg-gray-300'}`}
          title="Top View"
        >
          <div className="relative">
            <div className="w-4 h-8 bg-gray-700 rounded-sm"></div>
            <div className="absolute top-1 w-full flex justify-center gap-0.5">
              <div className="w-1 h-1 bg-gray-400"></div>
              <div className="w-1 h-1 bg-gray-400"></div>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
