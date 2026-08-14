import { useEffect, useRef } from 'react';
import { usePlannerStore } from '../store/plannerStore';

const AUTO_SAVE_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Auto-save hook. Runs a setInterval that saves the current project
 * to the MySQL database every 2 minutes.
 *
 * Only active when:
 * - projectPhase === 'working'
 * - autoSaveEnabled === true
 * - projectConfig is not null
 */
export function useAutoSave() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const projectPhase = usePlannerStore((s) => s.projectPhase);
  const autoSaveEnabled = usePlannerStore((s) => s.autoSaveEnabled);
  const projectConfig = usePlannerStore((s) => s.projectConfig);
  const isSaving = usePlannerStore((s) => s.isSaving);
  const saveProject = usePlannerStore((s) => s.saveProject);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    // Only auto-save when actively working on a project
    const shouldAutoSave =
      projectPhase === 'working' &&
      autoSaveEnabled &&
      projectConfig !== null;

    if (!shouldAutoSave) return;

    // Start the auto-save interval
    intervalRef.current = setInterval(() => {
      // Check isSaving at invocation time via getState() to avoid stale closure
      const currentState = usePlannerStore.getState();
      if (currentState.isSaving) return;
      if (currentState.projectPhase !== 'working') return;
      if (!currentState.projectConfig) return;

      console.log('[AutoSave] Saving project to database...');
      currentState.saveProject();
    }, AUTO_SAVE_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [projectPhase, autoSaveEnabled, projectConfig, saveProject]);
}
