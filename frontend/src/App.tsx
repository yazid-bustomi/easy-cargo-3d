import React from 'react';
import { usePlannerStore } from './store/plannerStore';
import { LayoutSelector } from './components/LayoutSelector';
import { PlannerPage } from './pages/PlannerPage';
import { LoginPage } from './pages/LoginPage';

function App() {
  const user = usePlannerStore((s) => s.user);
  const projectPhase = usePlannerStore((s) => s.projectPhase);

  // Jika belum login, tampilkan halaman login
  if (!user) {
    return <LoginPage />;
  }

  // Jika sudah login, cek phase project
  if (projectPhase === 'setup') {
    return <LayoutSelector />;
  }

  return <PlannerPage />;
}

export default App;
