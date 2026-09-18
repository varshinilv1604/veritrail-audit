const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

function getToken() {
  return localStorage.getItem('token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json() : null;

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const api = {
  login: (email, password) => request('/api/auth/login', { method: 'POST', body: { email, password } }),
  getClients: () => request('/api/clients'),
  createClient: (name) => request('/api/clients', { method: 'POST', body: { name } }),
  getClient: (clientId) => request(`/api/clients/${clientId}`),
  getClientDocuments: (clientId) => request(`/api/clients/${clientId}/documents`),
  getDocument: (docId) => request(`/api/documents/${docId}`),
  uploadDocument: (docId, file) => {
    const form = new FormData();
    form.append('file', file);
    return request(`/api/documents/${docId}/upload`, { method: 'POST', body: form, isForm: true });
  },
  startReview: (docId) => request(`/api/documents/${docId}/start-review`, { method: 'POST' }),
  approveDocument: (docId) => request(`/api/documents/${docId}/approve`, { method: 'POST' }),
  requestCorrection: (docId, comment) =>
    request(`/api/documents/${docId}/request-correction`, { method: 'POST', body: { comment } }),
  async downloadFile(docId, fileName) {
    // A plain <a href> would need the JWT in the URL (leaks into browser
    // history/server logs), so fetch with the Authorization header instead
    // and hand the browser a blob to save.
    const token = getToken();
    const res = await fetch(`${API_URL}/api/documents/${docId}/file`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error('Could not download file');
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName || 'document';
    link.click();
    URL.revokeObjectURL(url);
  },
};

export { API_URL };
