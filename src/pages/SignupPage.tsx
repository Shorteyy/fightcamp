import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export function SignupPage() {
  const { session, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);

  if (session) return <Navigate to="/dashboard" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error, needsEmailConfirmation } = await signUp(email, password, fullName);
    setSubmitting(false);
    if (error) {
      setError(error);
      return;
    }
    if (needsEmailConfirmation) {
      setNeedsConfirmation(true);
    }
  };

  if (needsConfirmation) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
        <div className="card" style={{ width: 380, maxWidth: '100%', textAlign: 'center' }}>
          <div className="heading" style={{ fontSize: 22, marginBottom: 12 }}>CHECK YOUR EMAIL</div>
          <p style={{ fontSize: 14, color: 'var(--muted-2)', lineHeight: 1.5 }}>
            We sent a confirmation link to <strong style={{ color: 'var(--text)' }}>{email}</strong>. Click it, then come back and log in.
          </p>
          <Link to="/login" style={{ display: 'inline-block', marginTop: 16 }}>Go to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 20 }}>
      <form onSubmit={onSubmit} className="card" style={{ width: 380, maxWidth: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
          <span style={{ width: 10, height: 10, background: 'var(--accent)', display: 'inline-block' }} />
          <span className="heading" style={{ fontSize: 26 }}>FIGHT CAMP</span>
        </div>
        <div className="label" style={{ fontSize: 22, marginBottom: 20 }}>SIGN UP</div>
        <input
          className="input"
          style={{ marginBottom: 12 }}
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          required
        />
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
          placeholder="Password (min 6 characters)"
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <div className="error-text" style={{ marginBottom: 12 }}>{error}</div>}
        <button className="btn-primary" style={{ width: '100%' }} type="submit" disabled={submitting}>
          {submitting ? 'CREATING ACCOUNT…' : 'SIGN UP'}
        </button>
        <div style={{ marginTop: 18, fontSize: 13, color: 'var(--muted-2)', textAlign: 'center' }}>
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </form>
    </div>
  );
}
