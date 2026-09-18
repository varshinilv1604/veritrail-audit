import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';

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
      <h1>Clients</h1>
      <p className="subtitle">Clients belonging to {session.firm.name}</p>

      {error && <div className="error-box">{error}</div>}

      {canCreate && (
        <div className="card">
          {!showForm ? (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Add client</button>
          ) : (
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
          )}
        </div>
      )}

      <div className="card">
        {clients === null && <div className="empty-state">Loading...</div>}
        {clients && clients.length === 0 && <div className="empty-state">No clients yet.</div>}
        {clients && clients.map((c) => (
          <div className="list-row" key={c.id}>
            <div>
              <div className="title">
                <Link to={`/clients/${c.id}`}>{c.name}</Link>
              </div>
              <div className="meta">Added {new Date(c.created_at + 'Z').toLocaleString()}</div>
            </div>
            <Link className="btn" to={`/clients/${c.id}`}>View documents</Link>
          </div>
        ))}
      </div>
    </div>
  );
}
