import React, { useState, useEffect } from 'react';
import { usePlannerStore } from './store/plannerStore';
import { LayoutSelector } from './components/LayoutSelector';
import { PlannerPage } from './pages/PlannerPage';
import { LoginPage } from './components/LoginPage';

function App() {
  const user = usePlannerStore((s) => s.user);
  const setUser = usePlannerStore((s) => s.setUser);
  const projectPhase = usePlannerStore((s) => s.projectPhase);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  // Cek localStorage saat pertama load
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    const savedUser = localStorage.getItem('auth_user');
    if (token && savedUser) {
      try {
        const parsed = JSON.parse(savedUser);
        setUser(parsed);
        setIsLoggedIn(true);
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      }
    }
  }, [setUser]);

  // Sync isLoggedIn when user changes
  useEffect(() => {
    setIsLoggedIn(!!user);
  }, [user]);

  if (!isLoggedIn) {
    return <LoginPage onLoginSuccess={() => {
      const savedUser = localStorage.getItem('auth_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setIsLoggedIn(true);
    }} />;
  }

  if (projectPhase === 'setup') {
    return <LayoutSelector />;
  }

  return <PlannerPage />;
}

export default App;
