const BASE = '/api';

function getToken() {
  return sessionStorage.getItem('au_token') || '';
}

async function req(method, path, body, isForm = false) {
  const opts = { method, headers: { 'Authorization': `Bearer ${getToken()}` } };
  if (isForm) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  if (res.status === 401) {
    // Token expired / invalid — clear session and reload to show login
    sessionStorage.removeItem('au_token');
    sessionStorage.removeItem('au_user');
    window.location.reload();
    return;
  }
  const json = await res.json().catch(() => ({ error: 'Invalid server response' }));
  if (!res.ok) throw new Error(json.error || 'Server error');
  return json;
}

export const api = {
  ping:          ()               => req('GET',  '/ping'),
  listSections:  (form)           => req('POST', '/sections',   form, true),
  loadRecipients:(form)           => req('POST', '/recipients', form, true),
  startSend:     (form)           => req('POST', '/send',       form, true),
  resendJob:     (jobId)          => req('POST', `/send/resend/${jobId}`),
  getJob:        (id)             => req('GET',  `/send/job/${id}`),
  cancelJob:     (id)             => req('POST', `/send/cancel/${id}`),
  getLogs:       (params = {})    => req('GET',  '/logs?' + new URLSearchParams(params)),
  getRecipientHistory: (params = {}) => req('GET', '/logs/recipient-history?' + new URLSearchParams(params)),
  clearLogs:     ()               => req('DELETE', '/logs'),
  getColumns:    (form)           => req('POST', '/send/columns', form, true),
  getStats:      (school)         => req('GET',  '/stats' + (school ? '?schoolFilter=' + encodeURIComponent(school) : '')),
  getTemplates:  ()               => req('GET',  '/templates'),
  saveTemplate:  (t)              => req('POST', '/templates', t),
  suggestContent:(p)              => req('POST', '/templates/suggest-content', p),
  deleteTemplate:(id)             => req('DELETE', `/templates/${id}`),
  getScheduled:  ()               => req('GET',  '/scheduler'),
  createSchedule:(s)              => req('POST', '/scheduler', s),
  deleteSchedule:(id)             => req('DELETE', `/scheduler/${id}`),
  // User management (superadmin only)
  getUsers:      ()               => req('GET',  '/auth/users'),
  createUser:    (u)              => req('POST', '/auth/users', u),
  deleteUser:    (id)             => req('DELETE', `/auth/users/${id}`),
  resetPassword: (id, password)   => req('PUT', `/auth/users/${id}/password`, { password }),
  updateGasUrl:  (id, gas_url)    => req('PUT', `/auth/users/${id}/gas`, { gas_url }),
  getSchools:    ()               => req('GET',  '/auth/schools'),
  getSettings:   ()               => req('GET',  '/settings'),
  updateSettings:(key, value)     => req('PUT',  '/settings', { key, value }),
};

export function sseProgress(jobId, onData, onDone) {
  const token = getToken();
  const es = new EventSource(`/api/send/progress/${jobId}?token=${encodeURIComponent(token)}`);
  es.onmessage = e => {
    const job = JSON.parse(e.data);
    onData(job);
    if (job.finished) { es.close(); onDone?.(job); }
  };
  es.onerror = () => { es.close(); onDone?.({ status: 'Error' }); };
  return () => es.close();
}
