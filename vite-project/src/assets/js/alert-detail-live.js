import { get, post } from './api.js';

const params = new URLSearchParams(location.search);
const id = params.get('id');
const metaEl = document.querySelector('#alert-meta');
const historyEl = document.querySelector('#alert-history');

async function refresh() {
  const { alert, history } = await get(`/api/v1/alerts/${id}`);
  metaEl.innerHTML = `
    <div><b>Type:</b> ${alert.type}</div>
    <div><b>Severity:</b> ${alert.severity}</div>
    <div><b>Status:</b> ${alert.status}</div>
    <div><b>Message:</b> ${alert.message || ''}</div>
    <div><b>Created:</b> ${new Date(alert.ts).toLocaleString()}</div>
  `;
  historyEl.innerHTML = history.map(h =>
    `<li>[${new Date(h.ts).toLocaleTimeString()}] ${h.action} — ${h.actor} ${h.note ? '('+h.note+')' : ''}</li>`
  ).join('');
}

document.querySelector('#btn-ack')?.addEventListener('click', async () => {
  await post(`/api/v1/alerts/${id}/ack`, { actor: 'rusheek' });
  await refresh();
});
document.querySelector('#btn-resolve')?.addEventListener('click', async () => {
  await post(`/api/v1/alerts/${id}/resolve`, { actor: 'rusheek' });
  await refresh();
});

refresh();
