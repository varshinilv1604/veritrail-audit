import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { IconLogout, IconPencil } from './icons';
import Logo from './Logo';
import EditProfileModal from './EditProfileModal';

function initials(name) {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

export default function TopBar() {
  const { session, logout } = useAuth();
  const [editingProfile, setEditingProfile] = useState(false);
  if (!session) return null;

  return (
    <div className="topbar">
      <div className="brand">
        <Logo size={30} />
        <div className="brand-text">
          <Link to="/">VeriTrail</Link>
          <span className="firm">{session.firm.name}</span>
        </div>
      </div>
      <div className="who">
        <div className="avatar">{initials(session.user.name)}</div>
        <div className="who-text">
          <span className="who-name">{session.user.name}</span>
          <span className="role-pill">{session.user.role}</span>
        </div>
        <button className="icon-link" onClick={() => setEditingProfile(true)} title="Edit profile" aria-label="Edit profile">
          <IconPencil width={16} height={16} />
        </button>
        <button className="icon-link" onClick={logout} title="Log out" aria-label="Log out">
          <IconLogout />
        </button>
      </div>

      {editingProfile && <EditProfileModal onClose={() => setEditingProfile(false)} />}
    </div>
  );
}
