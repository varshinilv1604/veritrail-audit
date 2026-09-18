import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import StatusBadge from '../components/StatusBadge';

function formatWhen(value) {
  if (!value) return '';
  // sqlite datetime('now') and ISO strings from the server are UTC without
  // a timezone suffix; append Z so the browser doesn't parse them as local.
  const iso = value.includes('T') ? value : value.replace(' ', 'T') + 'Z';
  return new Date(iso).toLocaleString();
}

export default function DocumentDetail() {
  const { docId } = useParams();
  const { session } = useAuth();
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [correctionText, setCorrectionText] = useState('');
  const [showCorrectionForm, setShowCorrectionForm] = useState(false);
  const fileInputRef = useRef(null);

  const role = session.user.role;
  const canUpload = role === 'staff' || role === 'admin';
  const canReview = role === 'reviewer' || role === 'admin';

  function load() {
    return api.getDocument(docId).then(setDoc).catch((err) => setError(err.message));
  }

  useEffect(() => {
    setDoc(null);
    setError('');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docId]);

  async function runAction(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function handleFileChosen(e) {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    runAction(() => api.uploadDocument(docId, file));
  }

  function submitCorrection(e) {
    e.preventDefault();
    if (!correctionText.trim()) return;
    runAction(() => api.requestCorrection(docId, correctionText)).then(() => {
      setCorrectionText('');
      setShowCorrectionForm(false);
    });
  }

  if (error && !doc) {
    return (
      <div className="page">
        <div className="error-box">{error}</div>
        <Link to="/">Back to clients</Link>
      </div>
    );
  }
  if (!doc) return <div className="page"><div className="empty-state">Loading...</div></div>;

  return (
    <div className="page">
      <div className="breadcrumbs">
        <Link to="/">Clients</Link> / <Link to={`/clients/${doc.client.id}`}>{doc.client.name}</Link> / {doc.docType}
      </div>
      <h1>{doc.docType}</h1>
      <div style={{ marginBottom: 20 }}><StatusBadge status={doc.status} /></div>

      {error && <div className="error-box">{error}</div>}

      <div className="card">
        <h2>Details</h2>
        <div className="doc-meta">
          <div>
            <div className="label">Client</div>
            <div className="value">{doc.client.name}</div>
          </div>
          <div>
            <div className="label">Uploaded by</div>
            <div className="value">{doc.uploadedByName || '-'}</div>
          </div>
          <div>
            <div className="label">Upload date/time</div>
            <div className="value">{doc.uploadedAt ? formatWhen(doc.uploadedAt) : '-'}</div>
          </div>
          <div>
            <div className="label">File</div>
            <div className="value">
              {doc.fileName ? (
                <button className="link-btn" onClick={() => api.downloadFile(doc.id, doc.fileName)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0, font: 'inherit' }}>
                  {doc.fileName}
                </button>
              ) : '-'}
            </div>
          </div>
          {doc.reviewComment && (
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="label">Review comment</div>
              <div className="value">{doc.reviewComment}</div>
            </div>
          )}
        </div>

        <div className="btn-row">
          {canUpload && doc.status !== 'Approved' && (
            <>
              <input type="file" ref={fileInputRef} onChange={handleFileChosen} style={{ display: 'none' }} />
              <button className="btn btn-primary" disabled={busy} onClick={() => fileInputRef.current.click()}>
                {doc.status === 'Correction Required' ? 'Upload revised document' : 'Upload document'}
              </button>
            </>
          )}

          {canReview && doc.status === 'Uploaded' && (
            <button className="btn btn-primary" disabled={busy} onClick={() => runAction(() => api.startReview(docId))}>
              Start review
            </button>
          )}

          {canReview && doc.status === 'Under Review' && (
            <>
              <button className="btn btn-primary" disabled={busy} onClick={() => runAction(() => api.approveDocument(docId))}>
                Approve
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => setShowCorrectionForm((v) => !v)}>
                Request correction
              </button>
            </>
          )}
        </div>

        {showCorrectionForm && (
          <form onSubmit={submitCorrection} style={{ marginTop: 16 }}>
            <div className="field">
              <label>Reason for correction</label>
              <textarea
                value={correctionText}
                onChange={(e) => setCorrectionText(e.target.value)}
                placeholder="e.g. Page 3 is missing. Please upload the complete bank statement."
                required
                autoFocus
              />
            </div>
            <button className="btn btn-danger" type="submit" disabled={busy}>Send correction request</button>
          </form>
        )}
      </div>

      <div className="card">
        <h2>Audit history</h2>
        {doc.history.length === 0 && <div className="empty-state">No activity yet.</div>}
        <ul className="timeline">
          {doc.history.map((event) => (
            <li key={event.id}>
              <div className="dot" />
              <div className="body">
                <div className="action">{event.actor_name} {event.action}</div>
                <div className="when">{formatWhen(event.created_at)} &middot; {event.actor_role}</div>
                {event.comment && event.action === 'requested correction' && (
                  <div className="comment">Reason: {event.comment}</div>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
