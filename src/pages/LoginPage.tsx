import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function LoginPage() {
  const { session, signIn } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';
    return <Navigate to={from} replace />;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) setError(error);
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block' }} />
          <span className="heading" style={{ fontSize: 26 }}>FIGHT CAMP</span>
        </div>
        <div className="label" style={{ fontSize: 22, marginBottom: 20 }}>LOG IN</div>
        <input
          className="input"
          style={{ marginBottom: 12 }}
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input"
          style={{ marginBottom: 18 }}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={submitting}>
          {submitting ? 'LOGGING IN…' : 'LOG IN'}
        </button>
        <div style={{ marginTop: 18, fontSize: 13, color: 'var(--muted-2)', textAlign: 'center' }}>
          New here? <Link to="/signup">Create an account</Link>
        </div>
      </form>
    </div>
  );
}
