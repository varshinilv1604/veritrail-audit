import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import StatusBadge from '../components/StatusBadge';

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

  return (
    <div className="page">
      <div className="breadcrumbs"><Link to="/">Clients</Link> / {client ? client.name : 'Documents'}</div>
      <h1>Required audit documents</h1>
      <p className="subtitle">{client ? client.name : ''}</p>

      {error && <div className="error-box">{error}</div>}

      {!error && (
      <div className="card">
        {documents === null && <div className="empty-state">Loading...</div>}
        {documents && documents.map((doc) => (
          <div className="list-row" key={doc.id}>
            <div>
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
