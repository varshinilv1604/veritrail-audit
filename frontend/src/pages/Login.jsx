import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import Logo from '../components/Logo';
import Splash from '../components/Splash';

const SPLASH_DURATION_MS = 1800;

export default function Login() {
  const { login, applySession } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    // Show the loading screen the moment the form is submitted, for any
    // email - registered or not - so the wait for the server never looks
    // like the app has frozen. It only turns into the branded "welcome"
    // pause once we actually know the sign-in succeeded.
    setShowSplash(true);
    try {
      const authResult = await login(email, password);
      // Hold off committing the session (and letting the router redirect)
      // until the splash has had its moment on screen.
      setTimeout(() => {
        applySession(authResult);
        navigate('/');
      }, SPLASH_DURATION_MS);
    } catch (err) {
      setShowSplash(false);
      setError(err.message);
      setLoading(false);
    }
  }

  if (showSplash) return <Splash />;

  return (
    <div className="login-shell">
      <div className="login-brand-panel">
        <Logo size={46} />
        <div>
          <h1>VeriTrail</h1>
          <p>
            A focused workspace for the audit document review workflow: collect
            from the client, review it, approve or send it back with a reason,
            and keep a clear trail of who did what and when.
          </p>
        </div>
        <div className="brand-footer">&copy; VeriTrail &middot; Mini Audit Document Review System</div>
      </div>

      <div className="login-form-panel">
        <div className="login-card">
          <h2>Sign in</h2>
          <p className="subtitle">Enter your firm credentials to continue.</p>

          {error && <div className="error-box">{error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="field">
              <label>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
            </div>
            <div className="field">
              <label>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="demo-accounts">
            <span className="demo-firm">Firm A &middot; ABC & Co.</span>
            staff: rohit@abcco.test &middot; reviewer: aman@abcco.test
            <span className="demo-firm">Firm B &middot; XYZ & Co.</span>
            staff: neha@xyzco.test &middot; reviewer: karan@xyzco.test
            <span className="demo-firm">Password (all accounts)</span>
            password123
          </div>
        </div>
      </div>
    </div>
  );
}
