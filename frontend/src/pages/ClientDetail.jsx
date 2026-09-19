import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';
import { IconFile } from '../components/icons';

export default function ClientDetail() {
  const { clientId } = useParams();
  const [client, setClient] = useState(null);
  const [documents, setDocuments] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setClient(null);
    setDocuments(null);
    setError('');
    Promise.all([api.getClient(clientId), api.getClientDocuments(clientId)])
      .then(([c, docs]) => {
        setClient(c);
        setDocuments(docs);
      })
      .catch((err) => setError(err.message));
  }, [clientId]);

  const approvedCount = documents ? documents.filter((d) => d.status === 'Approved').length : 0;

  return (
    <div className="page">
      <div className="breadcrumbs">
        <Link to="/">Clients</Link>
        <span className="sep">/</span>
        <span className="current">{client ? client.name : 'Documents'}</span>
      </div>
      <div className="page-header">
        <div>
          <h1>{client ? client.name : 'Required audit documents'}</h1>
          <p className="subtitle">
            {documents ? `${approvedCount} of ${documents.length} required documents approved` : 'Required audit documents'}
          </p>
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {!error && (
        <div className="card">
          {documents === null && <div className="empty-state">Loading...</div>}
          {documents && documents.map((doc) => (
            <div className="list-row" key={doc.id}>
              <div className="row-icon"><IconFile /></div>
              <div className="row-main">
                <div className="title">
                  <Link to={`/documents/${doc.id}`}>{doc.doc_type}</Link>
                </div>
                <div className="meta">
                  {doc.uploaded_by_name ? `Last uploaded by ${doc.uploaded_by_name}` : 'Not uploaded yet'}
                </div>
              </div>
              <StatusBadge status={doc.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
