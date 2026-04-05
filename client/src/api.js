const BASE = '/api';

async function req(method, path, body, isForm = false) {
  const opts = { method, headers: {} };
  if (isForm) {
    opts.body = body;
  } else if (body) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, opts);
  const json = await res.json().catch(() => ({ error: 'Invalid server response' }));
  if (!res.ok) throw new Error(json.error || 'Server error');
  return json;
}

export const api = {
  ping:          ()               => req('GET',  '/ping'),
  listSections:  (form)           => req('POST', '/sections',   form, true),
  loadRecipients:(form)           => req('POST', '/recipients', form, true),
  startSend:     (form)           => req('POST', '/send',       form, true),
  getJob:        (id)             => req('GET',  `/send/job/${id}`),
  cancelJob:     (id)             => req('POST', `/send/cancel/${id}`),
  getLogs:       (params = {})    => req('GET',  '/logs?' + new URLSearchParams(params)),
  getStats:      ()               => req('GET',  '/stats'),
  getTemplates:  ()               => req('GET',  '/templates'),
  saveTemplate:  (t)              => req('POST', '/templates', t),
  deleteTemplate:(id)             => req('DELETE', `/templates/${id}`),
  getScheduled:  ()               => req('GET',  '/scheduler'),
  createSchedule:(s)              => req('POST', '/scheduler', s),
  deleteSchedule:(id)             => req('DELETE', `/scheduler/${id}`),
};

export function sseProgress(jobId, onData, onDone) {
  const es = new EventSource(`/api/send/progress/${jobId}`);
  es.onmessage = e => {
    const job = JSON.parse(e.data);
    onData(job);
    if (job.finished) { es.close(); onDone?.(job); }
  };
  es.onerror = () => { es.close(); onDone?.({ status: 'Error' }); };
  return () => es.close();
}
