import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';

export default function TopBar() {
  const { session, logout } = useAuth();
  if (!session) return null;

  return (
    <div className="topbar">
      <div className="brand">
        <Link to="/">OBLIQ-in Audit</Link>
        <span className="firm">{session.firm.name}</span>
      </div>
      <div className="who">
        <span className="role-pill">{session.user.role}</span>
        <span>{session.user.name}</span>
        <button className="link" onClick={logout}>Log out</button>
      </div>
    </div>
  );
}
