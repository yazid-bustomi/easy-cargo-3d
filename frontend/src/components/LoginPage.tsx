import React, { useState } from 'react';
import { authService } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('admin@easycargo.local');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authService.login(email, password);
      if (res.data.success) {
        localStorage.setItem('auth_token', res.data.data.token);
        localStorage.setItem('auth_user', JSON.stringify(res.data.data.user));
        onLoginSuccess();
      } else {
        setError(res.data.error || 'Login gagal');
      }
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Login gagal, cek koneksi server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ width: 320, padding: 24, border: '1px solid #ddd', borderRadius: 8 }}>
        <h2>Login</h2>
        {error && <div style={{ color: 'red', marginBottom: 12 }}>{error}</div>}
        <div style={{ marginBottom: 12 }}>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ width: '100%', padding: 8 }}
            required
          />
        </div>
        <button type="submit" disabled={loading} style={{ width: '100%', padding: 10 }}>
          {loading ? 'Loading...' : 'Login'}
        </button>
      </form>
    </div>
  );
};
