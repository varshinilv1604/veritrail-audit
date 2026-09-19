import Logo from './Logo';

export default function Splash() {
  return (
    <div className="splash-shell">
      <div className="splash-logo"><Logo size={64} /></div>
      <div className="splash-word">VeriTrail</div>
      <div className="splash-tag">Verified, every step</div>
    </div>
  );
}
