import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import { IconBuilding, IconPlus, IconAlert, IconChevronRight } from '../components/icons';

export default function Clients() {
  const { session } = useAuth();
  const [clients, setClients] = useState(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);

  const canCreate = session.user.role === 'staff' || session.user.role === 'admin';

  useEffect(() => {
    api.getClients().then(setClients).catch((err) => setError(err.message));
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const client = await api.createClient(name);
      setClients((prev) => [client, ...prev]);
      setName('');
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>Clients</h1>
          <p className="subtitle">Clients belonging to {session.firm.name}</p>
        </div>
        {canCreate && !showForm && (
          <button className="btn btn-primary" onClick={() => setShowForm(true)}>
            <IconPlus /> Add client
          </button>
        )}
      </div>

      {error && <div className="error-box">{error}</div>}

      {canCreate && showForm && (
        <div className="card">
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Client name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. ABC Traders Pvt. Ltd."
                autoFocus
                required
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" type="submit" disabled={creating}>
                {creating ? 'Creating...' : 'Create client'}
              </button>
              <button className="btn" type="button" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {clients === null && <div className="empty-state">Loading...</div>}
        {clients && clients.length === 0 && <div className="empty-state">No clients yet.</div>}
        {clients && clients.map((c) => {
          const total = c.total_documents || 0;
          const approved = c.approved_documents || 0;
          const needsAttention = c.correction_required_documents > 0;
          return (
            <div className="list-row" key={c.id}>
              <div className="row-icon"><IconBuilding /></div>
              <div className="row-main">
                <div className="title">
                  <Link to={`/clients/${c.id}`}>{c.name}</Link>
                </div>
                <div className="progress-line">
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: total ? `${(approved / total) * 100}%` : '0%' }} />
                  </div>
                  <span className="progress-label">{approved} of {total} documents approved</span>
                </div>
              </div>
              <div className="row-end">
                {needsAttention && (
                  <span className="attention-flag"><IconAlert width={12} height={12} /> Needs attention</span>
                )}
                <Link className="btn" to={`/clients/${c.id}`}>
                  View documents <IconChevronRight width={14} height={14} />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
