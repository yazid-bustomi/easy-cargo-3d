import React from 'react';
import { usePlannerStore } from '../store/plannerStore';
import { Toolbar } from '../components/Toolbar';
import { ProductGroupManager } from '../components/ProductGroupManager';
import { ContainerViewer3D } from '../components/ContainerViewer3D';
import { ContainerStatsOverlay } from '../components/ContainerStatsOverlay';
import { LayoutSelector } from '../components/LayoutSelector';

export function PlannerPage() {
  const { projectPhase } = usePlannerStore();

  // ── Phase 1: Project Setup ──────────────────────────────────────
  if (projectPhase === 'setup') {
    return <LayoutSelector />;
  }

  // ── Phase 2: Working ────────────────────────────────────────────
  return (
    <div className="w-full h-screen bg-gray-950 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <Toolbar />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left Panel - Product Groups */}
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col flex-shrink-0 shadow-sm z-10 relative">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="text-base font-bold text-gray-800 flex items-center gap-2">
              📦 Products
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <ProductGroupManager />
          </div>
        </div>

        {/* Center - 3D Viewer + Stats Overlay */}
        <div className="flex-1 relative min-w-0">
          <ContainerViewer3D />
          <ContainerStatsOverlay />
        </div>
      </div>
    </div>
  );
}
